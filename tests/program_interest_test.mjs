import { spawn } from 'node:child_process';
import fetch from 'node-fetch';
import { generateAuthToken } from '../src/security/authTokens.js';

const TEST_PORT = 3010;
const BASE_URL = `http://localhost:${TEST_PORT}`;

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

async function runProgramInterestTests() {
  console.log('======================================================================');
  console.log('🎓 PRUEBA AUTOMATIZADA: LISTA DESPLEGABLE DE PROGRAMA DE INTERÉS (FICHA 360)');
  console.log('   Actualización por Asesor, Persistencia & Difusión en Tiempo Real (SSE)');
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

  // 1. Iniciar servidor de prueba en puerto 3010
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
  const sseEvents = [];

  try {
    const advisorToken = generateAuthToken({
      email: 'carolina.martinez@udea.edu.co',
      role_type: 'advisor',
      name: 'Carolina Martínez'
    });

    // Conectar escucha SSE
    sseClient = createSseListener(advisorToken, (evt) => {
      sseEvents.push(evt);
    });
    await new Promise(r => setTimeout(r, 400));

    const testPhone = '573007776655';

    // -------------------------------------------------------------
    // PRUEBA 1: Crear o inicializar lead de prueba
    // -------------------------------------------------------------
    console.log('\n--- 1. Inicialización de Lead de Prueba ---');
    const initRes = await fetch(`${BASE_URL}/api/simulator/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneNumber: testPhone,
        message: 'Hola, buenas tardes'
      })
    });
    assert(initRes.ok, 'Lead creado exitosamente mediante mensaje inicial');

    // -------------------------------------------------------------
    // PRUEBA 2: Consulta inicial del lead (programa 'Por definir')
    // -------------------------------------------------------------
    console.log('\n--- 2. Consulta de Estado Inicial en Ficha 360 ---');
    const chatRes = await fetch(`${BASE_URL}/api/leads/${testPhone}/chat`);
    const chatData = await chatRes.json();
    assert(chatRes.ok, 'Endpoint /api/leads/:phone/chat responde 200 OK');
    assert(chatData.lead !== undefined, 'Ficha del prospecto recuperada');
    console.log(`    Programa actual: ${chatData.lead.program_interest || 'Por definir'}`);

    // -------------------------------------------------------------
    // PRUEBA 3: Asesor actualiza el programa de interés mediante la lista desplegable
    // -------------------------------------------------------------
    console.log('\n--- 3. Asesor Selecciona Programa de Interés desde la Ficha 360 ---');
    const targetProgram = 'Diplomado en Medicina del Sueño';
    const updateRes = await fetch(`${BASE_URL}/api/leads/${testPhone}/program`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advisorToken}`
      },
      body: JSON.stringify({ programInterest: targetProgram })
    });
    const updateData = await updateRes.json();
    assert(updateRes.ok && updateData.success, 'Endpoint PATCH /api/leads/:phone/program responde exitosamente con 200 OK');
    assert(updateData.lead.program_interest === targetProgram, 'Programa actualizado correctamente a "Diplomado en Medicina del Sueño"');

    // -------------------------------------------------------------
    // PRUEBA 4: Difusión en Tiempo Real a Otros Asesores Conectados (SSE)
    // -------------------------------------------------------------
    console.log('\n--- 4. Verificación de Notificación SSE (lead:updated) ---');
    await new Promise(r => setTimeout(r, 400));
    const sseEvent = sseEvents.find(e => 
      e.event === 'lead:updated' && 
      e.data?.action === 'program_interest' && 
      e.data?.lead?.phone_number === testPhone
    );
    assert(sseEvent !== undefined, 'Evento SSE lead:updated recibido en tiempo real con action: "program_interest"');
    assert(sseEvent.data?.lead?.program_interest === targetProgram, 'Evento SSE contiene el nuevo programa seleccionado');

    // -------------------------------------------------------------
    // PRUEBA 5: Persistencia comprobada en llamadas posteriores
    // -------------------------------------------------------------
    console.log('\n--- 5. Comprobación de Persistencia en Base de Datos ---');
    const verifyRes = await fetch(`${BASE_URL}/api/leads/${testPhone}/chat`);
    const verifyData = await verifyRes.json();
    assert(verifyData.lead.program_interest === targetProgram, 'La base de datos mantiene persistentemente el nuevo programa de interés');

    // -------------------------------------------------------------
    // PRUEBA 6: Validación de campos requeridos (error 400 ante entrada vacía)
    // -------------------------------------------------------------
    console.log('\n--- 6. Validación de Robustez ante Datos Inválidos ---');
    const badRes = await fetch(`${BASE_URL}/api/leads/${testPhone}/program`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${advisorToken}`
      },
      body: JSON.stringify({ programInterest: '' })
    });
    assert(badRes.status === 400, 'Petición con programa vacío es rechazada con HTTP 400 Bad Request');

    console.log('\n======================================================================');
    console.log(`🎉 TODAS LAS PRUEBAS DE PROGRAMA DE INTERÉS PASARON: ${passed}/${total}`);
    console.log('======================================================================\n');

  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBAS DE PROGRAMA DE INTERÉS:', err);
    process.exitCode = 1;
  } finally {
    if (sseClient) sseClient.close();
    serverProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 400));
  }
}

runProgramInterestTests();

