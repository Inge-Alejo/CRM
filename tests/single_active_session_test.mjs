import { spawn } from 'node:child_process';
import fetch from 'node-fetch';
import { generateAuthToken } from '../src/security/authTokens.js';
import { updateAdvisorSession } from '../src/db/database.js';
import { NeonService } from '../src/db/neonService.js';

const TEST_PORT = 3009;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper: SSE listener
function createSseClient(name, token, onEvent) {
  const controller = new AbortController();
  let isClosed = false;

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
        onEvent({ event: 'http_error', status: res.status });
        return;
      }

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
    } catch (err) {
      if (err.name !== 'AbortError' && !isClosed) {
        onEvent({ event: 'stream_closed', error: err.message });
      }
    }
  })();

  return {
    name,
    close: () => {
      isClosed = true;
      controller.abort();
    }
  };
}

async function runSingleSessionTests() {
  console.log('======================================================================');
  console.log('🔒 PRUEBA AUTOMATIZADA: CONTROL DE SESIÓN ÚNICA ACTIVA POR USUARIO');
  console.log('   Incompatibilidad de Sesiones Concurrentes & Expulsión Automática');
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

  let sseClientA = null;
  let sseClientB = null;

  try {
    const testEmail = 'carolina.martinez@udea.edu.co';
    const otherAdvisorEmail = 'alejandro.gomez@udea.edu.co';

    // -------------------------------------------------------------
    // CASO 1: Inicio de Sesión Inicial (Dispositivo A)
    // -------------------------------------------------------------
    console.log('--- 1. Asesor Inicia Sesión en Dispositivo A ---');
    const sessionIdA = `sess_A_${Date.now()}`;
    const tokenA = generateAuthToken({
      email: testEmail,
      role_type: 'advisor',
      name: 'Dra. Carolina Martínez',
      sessionId: sessionIdA
    });

    // Simular que el backend registró la sesión A al iniciar sesión
    if (NeonService.isAvailable()) {
      await NeonService.updateAdvisorSession(testEmail, sessionIdA);
    }
    updateAdvisorSession(testEmail, sessionIdA);

    const eventsA = [];
    sseClientA = createSseClient('Dispositivo A', tokenA, (ev) => eventsA.push(ev));
    await new Promise(r => setTimeout(r, 600));

    assert(eventsA.some(e => e.event === 'connected'), 'Dispositivo A conectado exitosamente vía SSE');

    // Verificar que tokenA funciona en la API
    const meResA = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(meResA.ok, 'Dispositivo A tiene acceso autorizado a /api/auth/me (200 OK)');

    // -------------------------------------------------------------
    // CASO 2: Mismo Asesor Inicia Sesión en Dispositivo B (Concurrencia)
    // -------------------------------------------------------------
    console.log('\n--- 2. Mismo Asesor Inicia Sesión en Dispositivo B (Nuevo Navegador) ---');
    const sessionIdB = `sess_B_${Date.now()}`;
    const tokenB = generateAuthToken({
      email: testEmail,
      role_type: 'advisor',
      name: 'Dra. Carolina Martínez',
      sessionId: sessionIdB
    });

    // Al iniciar sesión en B, se actualiza el sessionId en la BD
    if (NeonService.isAvailable()) {
      await NeonService.updateAdvisorSession(testEmail, sessionIdB);
    }
    updateAdvisorSession(testEmail, sessionIdB);

    // Dispositivo B se conecta a SSE (lo que dispara la expulsión de la sesión anterior)
    const eventsB = [];
    sseClientB = createSseClient('Dispositivo B', tokenB, (ev) => eventsB.push(ev));
    await new Promise(r => setTimeout(r, 800));

    // -------------------------------------------------------------
    // CASO 3: Dispositivo A Recibe Expulsión en Tiempo Real (session:terminated)
    // -------------------------------------------------------------
    console.log('\n--- 3. Verificación de Expulsión en Tiempo Real de Dispositivo A ---');
    const terminatedEvent = eventsA.find(e => e.event === 'session:terminated');
    assert(terminatedEvent !== undefined, 'Dispositivo A recibió el evento SSE session:terminated en tiempo real');
    assert(terminatedEvent.data?.reason === 'concurrent_session', 'Motivo del evento indica sesión concurrente');

    // -------------------------------------------------------------
    // CASO 4: Token Antiguo (Dispositivo A) Queda Inmediatamente Invalidado
    // -------------------------------------------------------------
    console.log('\n--- 4. Invalidación Inmediata de Credenciales de Dispositivo A ---');
    const staleRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(staleRes.status === 401, 'Dispositivo A es rechazado con HTTP 401 Unauthorized');
    const staleData = await staleRes.json();
    assert(staleData.code === 'SESSION_TERMINATED', 'Respuesta contiene código SESSION_TERMINATED');

    // Intentar reconectar SSE con el token antiguo debe ser rechazado
    const reconnectRes = await fetch(`${BASE_URL}/api/realtime/events`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    assert(reconnectRes.status === 401, 'Reconexión SSE con token antiguo es rechazada con HTTP 401');

    // -------------------------------------------------------------
    // CASO 5: Dispositivo B Sigue Operando como Única Sesión Válida
    // -------------------------------------------------------------
    console.log('\n--- 5. Dispositivo B Opera como Única Sesión Activa ---');
    const meResB = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    assert(meResB.ok, 'Dispositivo B mantiene acceso activo y autorizado (200 OK)');
    assert(eventsB.some(e => e.event === 'connected'), 'Dispositivo B permanece conectado al bus SSE');

    // -------------------------------------------------------------
    // CASO 6: Asesores Distintos SÍ Pueden Coexistir Simultáneamente
    // -------------------------------------------------------------
    console.log('\n--- 6. Coexistencia Multiusuario de Asesores Diferentes ---');
    const sessionIdOther = `sess_other_${Date.now()}`;
    const tokenOther = generateAuthToken({
      email: otherAdvisorEmail,
      role_type: 'advisor',
      name: 'Dr. Alejandro Gómez',
      sessionId: sessionIdOther
    });
    if (NeonService.isAvailable()) {
      await NeonService.updateAdvisorSession(otherAdvisorEmail, sessionIdOther);
    }
    updateAdvisorSession(otherAdvisorEmail, sessionIdOther);

    const otherRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenOther}` }
    });
    assert(otherRes.ok, 'Segundo asesor (Alejandro Gómez) opera sin interferencias simultáneamente');

    console.log('\n======================================================================');
    console.log(`🎉 TODAS LAS PRUEBAS DE SESIÓN ÚNICA PASARON CON ÉXITO: ${passed}/${total}`);
    console.log('======================================================================\n');

  } catch (err) {
    console.error('\n❌ ERROR EN PRUEBA DE SESIÓN ÚNICA:', err);
    process.exitCode = 1;
  } finally {
    if (sseClientA) sseClientA.close();
    if (sseClientB) sseClientB.close();
    serverProcess.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 400));
  }
}

runSingleSessionTests();
