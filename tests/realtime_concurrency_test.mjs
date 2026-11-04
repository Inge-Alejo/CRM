import { spawn } from 'node:child_process';
import fetch from 'node-fetch';
import { generateAuthToken } from '../src/security/authTokens.js';

const TEST_PORT = 3005;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper: SSE Connection via native fetch streaming
function createSseClient(name, token, onEvent) {
  const controller = new AbortController();
  let connected = false;

  const promise = (async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/realtime/events`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream'
        },
        signal: controller.signal
      });

      if (!res.ok) {
        console.error(`SSE client [${name}] HTTP Error: status ${res.status}`);
        return;
      }

      connected = true;
      let buffer = '';

      res.body.on('data', chunk => {
        buffer += chunk.toString();
        const parts = buffer.split('\n\n');
        buffer = parts.pop();

        for (const block of parts) {
          if (!block.trim()) continue;
          let eventType = 'message';
          let eventData = '';

          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim();
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);
              onEvent({ event: eventType, data: parsed, raw: eventData });
            } catch {
              onEvent({ event: eventType, data: eventData, raw: eventData });
            }
          }
        }
      });

      res.body.on('error', err => {
        if (err.name !== 'AbortError') {
          // console.error(`SSE client [${name}] error:`, err.message);
        }
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(`SSE client [${name}] exception:`, err.message);
      }
    }
  })();

  return {
    name,
    close: () => controller.abort(),
    promise
  };
}

async function runRealtimeConcurrencyTests() {
  console.log('======================================================================');
  console.log('⚡ AUDITORÍA DE CONCURRENCIA, SINCRONIZACIÓN Y LATENCIA EN TIEMPO REAL');
  console.log('   CRM & Chatbot - Facultad de Medicina Universidad de Antioquia');
  console.log('======================================================================\n');

  let passed = 0;
  let total = 0;
  const latencies = [];

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

  // 1. Iniciar servidor de prueba en puerto 3005
  console.log(`🚀 Iniciando servidor de pruebas en puerto ${TEST_PORT}...`);
  const serverProcess = spawn('node', ['src/server.js'], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'pipe'
  });

  serverProcess.stderr.on('data', data => {
    // Silenciar avisos benignos
    const msg = data.toString();
    if (!msg.includes('ExperimentalWarning') && !msg.includes('punycode')) {
      // console.error('[Server Error]:', msg);
    }
  });

  // Esperar a que el servidor esté listo
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
    throw new Error('El servidor de pruebas no inició en el tiempo esperado.');
  }
  console.log('🌐 Servidor de pruebas iniciado y respondiendo correctamente.\n');

  let sseClient1 = null;
  let sseClient2 = null;

  try {
    // Credenciales y Tokens HMAC de prueba para 2 asesores simultáneos
    const tokenAdvisor1 = generateAuthToken({ email: 'carolina.martinez@udea.edu.co', role_type: 'advisor', name: 'Dra. Carolina Martínez' });
    const tokenAdvisor2 = generateAuthToken({ email: 'alejandro.gomez@udea.edu.co', role_type: 'advisor', name: 'Dr. Alejandro Gómez' });
    const testLeadPhone = '573008889911';

    // 0. Asegurar que el lead de prueba existe en la base de datos
    console.log(`🌱 Inicializando prospecto de prueba (${testLeadPhone})...`);
    const seedRes = await fetch(`${BASE_URL}/api/simulator/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testLeadPhone,
        message: 'Hola, deseo inscribirme en el diplomado'
      })
    });
    if (!seedRes.ok) throw new Error('No se pudo inicializar el lead de prueba.');
    await new Promise(r => setTimeout(r, 500));

    // -----------------------------------------------------------------
    // PRUEBA 1: CONEXIÓN SSE MULTIUSUARIO Y REGISTRO DE EVENTOS
    // -----------------------------------------------------------------
    console.log('--- 1. Establecimiento de Canales SSE para Múltiples Asesores ---');
    const eventsAdvisor1 = [];
    const eventsAdvisor2 = [];

    sseClient1 = createSseClient('Asesor 1', tokenAdvisor1, (ev) => eventsAdvisor1.push(ev));
    sseClient2 = createSseClient('Asesor 2', tokenAdvisor2, (ev) => eventsAdvisor2.push(ev));

    // Esperar a recibir el evento de confirmación de conexión
    await new Promise(r => setTimeout(r, 1000));
    assert(eventsAdvisor1.some(e => e.event === 'connected'), 'Asesor 1 conectado y autenticado vía Server-Sent Events');
    assert(eventsAdvisor2.some(e => e.event === 'connected'), 'Asesor 2 conectado y autenticado vía Server-Sent Events');

    // -----------------------------------------------------------------
    // PRUEBA 2: PRESENCIA Y DETECCIÓN DE ASESORES VIENDO EL MISMO LEAD
    // -----------------------------------------------------------------
    console.log('\n--- 2. Presencia de Asesores y Detección de Concurrencia ---');
    const tPresenceStart = Date.now();

    // Asesor 1 abre el lead en su modal
    const presenceRes = await fetch(`${BASE_URL}/api/realtime/presence`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdvisor1}`
      },
      body: JSON.stringify({ viewingLead: testLeadPhone })
    });
    assert(presenceRes.ok, 'Asesor 1 reporta que está visualizando el prospecto');

    // Esperar a que el Asesor 2 reciba la notificación de presencia vía SSE
    let presenceEventReceived = false;
    let tPresenceReceived = 0;

    for (let i = 0; i < 40; i++) {
      const found = eventsAdvisor2.find(e => e.event === 'advisor:presence' && (e.data?.email === 'carolina.martinez@udea.edu.co' || e.data?.advisorEmail === 'carolina.martinez@udea.edu.co'));
      if (found) {
        presenceEventReceived = true;
        tPresenceReceived = Date.now();
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    const presenceLatency = presenceEventReceived ? (tPresenceReceived - tPresenceStart) : 9999;
    latencies.push({ action: 'Detección de Asesor Concurrente (Presencia)', latencyMs: presenceLatency });
    console.log(`    ⏱️  Latencia de propagación de presencia: ${presenceLatency} ms`);
    assert(presenceEventReceived, 'Asesor 2 recibe en tiempo real que Asesor 1 está revisando el prospecto');
    assert(presenceLatency < 2000, `Latencia de presencia cumple con el objetivo (< 2000 ms): ${presenceLatency} ms`);

    // -----------------------------------------------------------------
    // PRUEBA 3: PROPAGACIÓN DE NOTAS EN TIEMPO REAL ENTRE SESIONES
    // -----------------------------------------------------------------
    console.log('\n--- 3. Sincronización Inmediata de Notas Internas (< 2s) ---');
    const tNotesStart = Date.now();
    const newNoteText = `Nota clínica y académica guardada a las ${new Date().toLocaleTimeString('es-CO')}`;

    const saveNoteRes = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}/notes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdvisor1}`
      },
      body: JSON.stringify({ notes: newNoteText })
    });
    const saveNoteData = await saveNoteRes.json();
    assert(saveNoteRes.ok && saveNoteData.success, 'Asesor 1 guarda notas internas exitosamente');

    // Asesor 2 debe recibir el evento 'lead:updated' vía SSE
    let noteUpdatedInAdvisor2 = false;
    let tNoteReceived = 0;

    for (let i = 0; i < 40; i++) {
      const found = eventsAdvisor2.find(e => e.event === 'lead:updated' && e.data?.phone === testLeadPhone && (e.data?.action === 'notes' || e.data?.changeType === 'notes'));
      if (found) {
        noteUpdatedInAdvisor2 = true;
        tNoteReceived = Date.now();
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    const notesLatency = noteUpdatedInAdvisor2 ? (tNoteReceived - tNotesStart) : 9999;
    latencies.push({ action: 'Propagación de Notas Internas', latencyMs: notesLatency });
    console.log(`    ⏱️  Latencia de sincronización de notas: ${notesLatency} ms`);
    assert(noteUpdatedInAdvisor2, 'Asesor 2 recibe la nota actualizada sin recargar la página');
    assert(notesLatency < 2000, `Latencia de sincronización de notas (< 2000 ms): ${notesLatency} ms`);

    // -----------------------------------------------------------------
    // PRUEBA 4: CONFLICTO DE CONCURRENCIA Y BLOQUEO OPTIMISTA (409 CONFLICT)
    // -----------------------------------------------------------------
    console.log('\n--- 4. Control de Concurrencia Optimista (Prevención de Sobrescritura) ---');
    // Consultar el lead actual para obtener su versión actual
    const currentLeadRes = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}`, {
      headers: { 'Authorization': `Bearer ${tokenAdvisor1}` }
    });
    const leadState = await currentLeadRes.json();
    const originalVersion = leadState.lead ? (leadState.lead.version || 1) : 1;
    console.log(`    ℹ️  Versión actual del lead en la base de datos: v${originalVersion}`);

    // Asesor 1 guarda un cambio válido con la versión original
    const update1Res = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}/notes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdvisor1}`
      },
      body: JSON.stringify({
        notes: 'Cambio legítimo del Asesor 1 con versión correcta',
        version: originalVersion
      })
    });
    assert(update1Res.ok, `Asesor 1 actualiza exitosamente con versión esperada v${originalVersion}`);

    // Asesor 2 intenta guardar con la versión antigua (desactualizada)
    console.log(`    ⚠️  Asesor 2 intenta sobrescribir enviando la versión obsoleta v${originalVersion}...`);
    const update2Res = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}/notes`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdvisor2}`
      },
      body: JSON.stringify({
        notes: 'Intento de sobrescritura accidental del Asesor 2',
        version: originalVersion // Versión obsoleta
      })
    });

    const update2Data = await update2Res.json();
    assert(update2Res.status === 409, 'El servidor rechaza la edición concurrente con código HTTP 409 Conflict');
    assert(update2Data.conflict === true, 'La respuesta contiene conflict: true para alertar al cliente');
    assert(update2Data.lead && update2Data.lead.version > originalVersion, 'El servidor devuelve el estado actual y versión actualizada del lead');

    // Verificar que las notas del Asesor 1 no fueron destruidas
    const verifyLeadRes = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}`, {
      headers: { 'Authorization': `Bearer ${tokenAdvisor1}` }
    });
    const verifyData = await verifyLeadRes.json();
    assert(verifyData.lead.notes.includes('Cambio legítimo del Asesor 1'), 'Los datos del Asesor 1 permanecen protegidos e íntegros');

    // -----------------------------------------------------------------
    // PRUEBA 5: PROPAGACIÓN DE MENSAJES Y ASIGNACIÓN DE ASESOR
    // -----------------------------------------------------------------
    console.log('\n--- 5. Notificación en Tiempo Real de Asignación de Asesor ---');
    const tAssignStart = Date.now();
    const assignRes = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}/advisor`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdvisor1}`
      },
      body: JSON.stringify({ advisor: 'Dr. Carlos Builes' })
    });
    assert(assignRes.ok, 'Asesor 1 asigna el prospecto al Dr. Carlos Builes');

    let assignReceivedByAdvisor2 = false;
    let tAssignReceived = 0;

    for (let i = 0; i < 40; i++) {
      const found = eventsAdvisor2.find(e => e.event === 'lead:updated' && e.data?.phone === testLeadPhone && (e.data?.action === 'assignment' || e.data?.changeType === 'assignment' || e.data?.changeType === 'advisor_assigned'));
      if (found) {
        assignReceivedByAdvisor2 = true;
        tAssignReceived = Date.now();
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    const assignLatency = assignReceivedByAdvisor2 ? (tAssignReceived - tAssignStart) : 9999;
    latencies.push({ action: 'Asignación de Asesor en Tiempo Real', latencyMs: assignLatency });
    console.log(`    ⏱️  Latencia de asignación de asesor: ${assignLatency} ms`);
    assert(assignReceivedByAdvisor2, 'Asesor 2 recibe en tiempo real el evento de asignación');
    assert(assignLatency < 2000, `Latencia de asignación (< 2000 ms): ${assignLatency} ms`);

    // -----------------------------------------------------------------
    // PRUEBA 6: RECEPCIÓN Y TRANSMISIÓN DE MENSAJES EN CHAT EN VIVO
    // -----------------------------------------------------------------
    console.log('\n--- 6. Retransmisión de Mensajes de Chat a Todas las Sesiones ---');
    const advisorMessageText = 'Estimado prospecto, soy la Dra. Carolina Martínez, ¿en qué podemos orientarle hoy? 🩺✨';
    const tMsgStart = Date.now();

    // Asesor 1 envía un mensaje manual al lead desde la consola de chat
    const sendMsgRes = await fetch(`${BASE_URL}/api/leads/${testLeadPhone}/send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAdvisor1}`
      },
      body: JSON.stringify({
        message: advisorMessageText,
        advisorName: 'Dra. Carolina Martínez'
      })
    });
    assert(sendMsgRes.ok, 'Asesor 1 envía mensaje al prospecto desde su consola');

    let msgReceivedByAdvisor2 = false;
    let tMsgReceived = 0;

    for (let i = 0; i < 40; i++) {
      const f2 = eventsAdvisor2.find(e => e.event === 'message:received' && e.data?.phone === testLeadPhone && e.data?.message?.content === advisorMessageText);
      if (f2) {
        msgReceivedByAdvisor2 = true;
        tMsgReceived = Date.now();
        break;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    const msgLatency = msgReceivedByAdvisor2 ? (tMsgReceived - tMsgStart) : 9999;
    latencies.push({ action: 'Broadcast de Mensaje de Asesor a Colegas', latencyMs: msgLatency });
    console.log(`    ⏱️  Latencia de broadcast de mensaje: ${msgLatency} ms`);
    assert(msgReceivedByAdvisor2, 'El Asesor 2 visualiza el mensaje del Asesor 1 sin recargar la página');
    assert(msgLatency < 2000, `Latencia de broadcast de mensaje (< 2000 ms): ${msgLatency} ms`);

    // -----------------------------------------------------------------
    // PRUEBA 7: DESCONEXIÓN LIMPIA Y ACTUALIZACIÓN DE DISPONIBILIDAD
    // -----------------------------------------------------------------
    console.log('\n--- 7. Cierre de Sesión / Desconexión y Actualización de Disponibilidad ---');
    // Cerrar sesión del Asesor 1
    sseClient1.close();

    // Esperar propagación del cierre
    await new Promise(r => setTimeout(r, 600));

    const activeListRes = await fetch(`${BASE_URL}/api/realtime/active-advisors`);
    const activeListData = await activeListRes.json();
    assert(activeListRes.ok, 'Endpoint /api/realtime/active-advisors responde correctamente');
    
    // Asesor 2 debe seguir activo, Asesor 1 ya no debe estar activo
    const advisor1Active = activeListData.activeAdvisors.some(a => a.email === 'carolina.martinez@udea.edu.co');
    assert(!advisor1Active, 'El Asesor 1 fue removido limpiamente del registro de presencia activa');

    // -----------------------------------------------------------------
    // RESUMEN Y MÉTRICAS DE LATENCIA
    // -----------------------------------------------------------------
    console.log('\n======================================================================');
    console.log('📊 TABLA DE RENDIMIENTO Y LATENCIA REAL-TIME MEDIDA');
    console.log('======================================================================');
    for (const item of latencies) {
      console.log(`  🔹 ${item.action.padEnd(46)}: ${String(item.latencyMs).padStart(4)} ms  (Objetivo: < 2000 ms)`);
    }

    const avgLatency = Math.round(latencies.reduce((acc, curr) => acc + curr.latencyMs, 0) / latencies.length);
    console.log(`\n  ⭐ Latencia Promedio del Bus SSE en Concurrencia: ${avgLatency} ms`);
    console.log(`🎉 TODAS LAS PRUEBAS DE CONCURRENCIA Y TIEMPO REAL PASARON: ${passed}/${total}`);
    console.log('======================================================================\n');

  } catch (err) {
    console.error('\n❌ ERROR DURANTE LA AUDITORÍA DE CONCURRENCIA:', err);
    process.exitCode = 1;
  } finally {
    if (sseClient1) sseClient1.close();
    if (sseClient2) sseClient2.close();
    console.log('🛑 Deteniendo servidor de pruebas...');
    serverProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
  }
}

runRealtimeConcurrencyTests();
