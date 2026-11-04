import { spawn } from 'node:child_process';
import fetch from 'node-fetch';
import { generateAuthToken } from '../src/security/authTokens.js';

const TEST_PORT = 3008;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper SSE
function createSseListener(token, onEvent) {
  const controller = new AbortController();
  fetch(`${BASE_URL}/api/realtime/events`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'text/event-stream'
    },
    signal: controller.signal
  }).then(async res => {
    let buffer = '';
    for await (const chunk of res.body) {
      buffer += chunk.toString();
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const block of parts) {
        if (!block.trim()) continue;
        let eventType = 'message';
        let eventData = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim();
          if (line.startsWith('data: ')) eventData = line.slice(6).trim();
        }
        if (eventData) {
          try {
            onEvent({ event: eventType, data: JSON.parse(eventData) });
          } catch {
            onEvent({ event: eventType, data: eventData });
          }
        }
      }
    }
  }).catch(() => {});

  return { close: () => controller.abort() };
}

async function runGlobalAiTests() {
  console.log('======================================================================');
  console.log('🛡️ PRUEBA AUTOMATIZADA: CONTROL MAESTRO DE IA GLOBAL (KILL-SWITCH)');
  console.log('   Exclusividad Superadmin TIC & Suspensión Global de Respuestas');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      throw new Error(`Fallo de prueba: ${message}`);
    }
  }

  // 1. Iniciar servidor de prueba en puerto 3008
  console.log(`🚀 Iniciando servidor de pruebas en puerto ${TEST_PORT}...`);
  const serverProcess = spawn('node', ['src/server.js'], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe'
  });

  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/config/client`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {}
    await new Promise(r => setTimeout(r, 300));
  }

  if (!serverReady) {
    serverProcess.kill();
    throw new Error('Servidor de prueba no inició.');
  }

  let sseClient = null;

  try {
    const adminToken = generateAuthToken({
      email: 'proyectostic.med@udea.edu.co',
      role_type: 'admin',
      name: 'Super Administrador TIC'
    });

    const advisorToken = generateAuthToken({
      email: 'carolina.martinez@udea.edu.co',
      role_type: 'advisor',
      name: 'Dra. Carolina Martínez'
    });

    const sseEvents = [];
    sseClient = createSseListener(advisorToken, (ev) => sseEvents.push(ev));
    await new Promise(r => setTimeout(r, 600));

    // -------------------------------------------------------------
    // PRUEBA 1: Consulta del estado inicial de la IA Global
    // -------------------------------------------------------------
    console.log('\n--- 1. Consulta del Estado Inicial de IA Global ---');
    const initialRes = await fetch(`${BASE_URL}/api/admin/global-ai`, {
      headers: { 'Authorization': `Bearer ${advisorToken}` }
    });
    const initialData = await initialRes.json();
    assert(initialRes.ok && initialData.success, 'Endpoint GET /api/admin/global-ai responde 200 OK a usuario autenticado');
    console.log(`    Estado actual: ${initialData.enabled ? 'Activa' : 'Pausada'} (por ${initialData.updated_by})`);

    // -------------------------------------------------------------
    // PRUEBA 2: Asesor regular NO PUEDE modificar el estado (403 Forbidden)
    // -------------------------------------------------------------
    console.log('\n--- 2. Verificación de RBAC: Asesor regular bloqueado (403 Forbidden) ---');
    const unauthorizedRes = await fetch(`${BASE_URL}/api/admin/global-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advisorToken}`
      },
      body: JSON.stringify({ enabled: false })
    });
    assert(unauthorizedRes.status === 403, 'Intento de modificar IA Global por asesor regular es rechazado con HTTP 403 Forbidden');
    const unauthorizedData = await unauthorizedRes.json();
    assert(unauthorizedData.error && unauthorizedData.error.includes('Administrador General TIC'), 'Mensaje de error institucional devuelto al asesor');

    // -------------------------------------------------------------
    // PRUEBA 3: Superadmin TIC puede pausar la IA globalmente (200 OK)
    // -------------------------------------------------------------
    console.log('\n--- 3. Pausa Global de IA por Superadministrador TIC ---');
    const pauseRes = await fetch(`${BASE_URL}/api/admin/global-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ enabled: false })
    });
    const pauseData = await pauseRes.json();
    assert(pauseRes.status === 200 && pauseData.success, 'Superadmin TIC pausa exitosamente la IA global con HTTP 200 OK');
    assert(pauseData.enabled === false, 'Respuesta confirma enabled: false');

    // -------------------------------------------------------------
    // PRUEBA 4: Notificación SSE en tiempo real a los asesores
    // -------------------------------------------------------------
    console.log('\n--- 4. Difusión en Tiempo Real a Asesores Conectados (SSE) ---');
    await new Promise(r => setTimeout(r, 300));
    const pauseEvent = sseEvents.find(e => e.event === 'system:global_ai' && e.data?.enabled === false);
    assert(pauseEvent !== undefined, 'Asesores reciben evento system:global_ai informando la pausa en tiempo real');

    // -------------------------------------------------------------
    // PRUEBA 5: Chatbot no responde automáticamente cuando la IA está pausada
    // -------------------------------------------------------------
    console.log('\n--- 5. Supresión de Respuestas Automáticas ante Mensajes Entrantes ---');
    const simRes = await fetch(`${BASE_URL}/api/simulator/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: '573105556677',
        message: 'Hola, información sobre cursos de medicina'
      })
    });
    const simData = await simRes.json();
    assert(simRes.ok, 'Simulador procesa mensaje sin colapsar');
    assert(simData.aiPaused === true, 'El simulador indica aiPaused: true');
    assert(simData.globalPaused === true, 'El simulador reporta globalPaused: true');
    assert(simData.replyText.includes('transfiriendo a un asesor') && simData.replyText.includes('asesor tomará tu caso'), 'Mensaje informa la transferencia a un asesor');
    const hasEmojis = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(simData.replyText);
    assert(!hasEmojis, 'El mensaje institucional de transferencia está 100% libre de emojis');

    // -------------------------------------------------------------
    // PRUEBA 5.1: Bloqueo de reactivación individual en chat mientras IA esté pausada globalmente
    // -------------------------------------------------------------
    console.log('\n--- 5.1. Bloqueo de Activación Individual de IA en Chat (403 Forbidden) ---');
    const toggleAttemptRes = await fetch(`${BASE_URL}/api/leads/573105556677/toggle-ai`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advisorToken}`
      },
      body: JSON.stringify({ aiEnabled: true })
    });
    const toggleAttemptData = await toggleAttemptRes.json();
    assert(toggleAttemptRes.status === 403, 'Intento de reactivar IA en un chat individual es bloqueado con HTTP 403 Forbidden');
    assert(toggleAttemptData.globalPaused === true, 'Respuesta confirma que la IA está bloqueada por pausa global TIC');

    // -------------------------------------------------------------
    // PRUEBA 6: Superadmin reactiva la IA globalmente (200 OK)
    // -------------------------------------------------------------
    console.log('\n--- 6. Reactivación Global de IA por Superadministrador TIC ---');
    const resumeRes = await fetch(`${BASE_URL}/api/admin/global-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ enabled: true })
    });
    const resumeData = await resumeRes.json();
    assert(resumeRes.status === 200 && resumeData.success, 'Superadmin TIC reactiva exitosamente la IA global con HTTP 200 OK');
    assert(resumeData.enabled === true, 'Respuesta confirma enabled: true');

    // Verificar evento SSE de reactivación
    await new Promise(r => setTimeout(r, 300));
    const resumeEvent = sseEvents.find(e => e.event === 'system:global_ai' && e.data?.enabled === true);
    assert(resumeEvent !== undefined, 'Asesores reciben evento SSE de reactivación en tiempo real');

    // -------------------------------------------------------------
    // PRUEBA 7: Saludo automático oficial en la primera interacción
    // -------------------------------------------------------------
    console.log('\n--- 7. Saludo Automático Institucional en Primera Interacción ---');
    const resetInitRes = await fetch(`${BASE_URL}/api/simulator/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '573109998877', reset: true })
    });
    const initData = await resetInitRes.json();
    assert(resetInitRes.ok, 'Inicialización de primera interacción completada');
    assert(initData.replyText.includes('¡Hola!') && initData.replyText.includes('bienvenida al Centro de Extensión de la Facultad de Medicina UdeA 🩺. ¿En qué podemos ayudarte?'), 'Primer mensaje responde exactamente con el saludo oficial solicitado');

    console.log('\n======================================================================');
    console.log(`🎉 TODAS LAS PRUEBAS DE CONTROL MAESTRO DE IA PASARON: ${passed}/${total}`);
    console.log('======================================================================\n');

  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS DE IA GLOBAL:', err);
    process.exitCode = 1;
  } finally {
    if (sseClient) sseClient.close();
    serverProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 400));
  }
}

runGlobalAiTests();

