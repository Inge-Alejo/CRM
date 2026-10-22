import fetch from 'node-fetch';
import { spawn } from 'child_process';
import assert from 'assert';

console.log('🧪 INICIANDO VERIFICACIÓN DE AUTENTICACIÓN FIREBASE PURA Y RECUPERACIÓN');

const PORT = 3099;
const env = { ...process.env, PORT: String(PORT) };
const serverProcess = spawn('node', ['src/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });

serverProcess.stdout.on('data', (d) => {
  // console.log('[SERVER]', d.toString());
});
serverProcess.stderr.on('data', (d) => {
  // console.error('[SERVER ERR]', d.toString());
});

async function waitServerReady() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/telemetry`);
      if (res.ok) return true;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('Servidor no respondió a tiempo');
}

async function runTests() {
  try {
    await waitServerReady();
    console.log('✅ Servidor de prueba listo en puerto', PORT);

    // TEST 1: Registro desde la app inhabilitado
    console.log('\n--- 1. Verificar bloqueo de registro público ---');
    const regRes = await fetch(`http://localhost:${PORT}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nuevo@udea.edu.co', password: 'password123' })
    });
    const regData = await regRes.json();
    assert.strictEqual(regRes.status, 403, 'El registro debe retornar 403 Forbidden');
    assert.strictEqual(regData.success, false, 'success debe ser false');
    console.log('✅ [PASS] Registro público bloqueado con código 403');

    // TEST 2: Intento de login con clave falsa o no registrada en Firebase
    console.log('\n--- 2. Verificar rechazo de credenciales incorrectas en Firebase ---');
    const loginFailRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usuario.inexistente.fdem@udea.edu.co', password: 'ClaveInvalida99*' })
    });
    const loginFailData = await loginFailRes.json();
    assert.strictEqual(loginFailRes.status, 401, 'Debe retornar 401 Unauthorized');
    assert.strictEqual(loginFailData.success, false, 'success debe ser false');
    console.log('✅ [PASS] Rechazo de usuario inexistente o clave incorrecta (401):', loginFailData.error);

    // TEST 3: Intento de bypass con UdeA2026* eliminado
    console.log('\n--- 3. Verificar que no existe bypass para UdeA2026* si no es la clave de Firebase ---');
    const bypassRes = await fetch(`http://localhost:${PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'usuario.prueba.bypass@udea.edu.co', password: 'UdeA2026*' })
    });
    assert.strictEqual(bypassRes.status, 401, 'Bypass UdeA2026* debe ser rechazado si no está en Firebase');
    console.log('✅ [PASS] Ningún bypass local permitido: La clave debe ser la correcta de Firebase');

    // TEST 4: Recuperación de contraseña vía Firebase Identity Toolkit
    console.log('\n--- 4. Verificar endpoint de recuperación de contraseña ---');
    // Caso a: correo inválido
    const forgotInvalid = await fetch(`http://localhost:${PORT}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'correonoesvalido' })
    });
    assert.strictEqual(forgotInvalid.status, 400, 'Debe retornar 400 para correo mal formado');

    // Caso b: solicitud oficial de reseteo para cuenta institucional
    const forgotValid = await fetch(`http://localhost:${PORT}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'proyectostic.med@udea.edu.co' })
    });
    const forgotData = await forgotValid.json();
    console.log('Respuesta forgot-password:', forgotData);
    assert.strictEqual(forgotValid.status, 200, 'Debe retornar 200 OK');
    assert.strictEqual(forgotData.success, true, 'Debe ser exitoso');
    assert.ok(forgotData.message.includes('proyectostic.med@udea.edu.co'), 'Mensaje debe incluir el correo destinatario');
    console.log('✅ [PASS] Solicitud oficial de recuperación de contraseña enviada a Firebase con éxito');

    console.log('\n🎉 TODAS LAS VERIFICACIONES DE AUTENTICACIÓN Y RECUPERACIÓN PASARON (4/4)');
  } finally {
    serverProcess.kill();
  }
}

runTests().catch(err => {
  console.error('❌ Error en pruebas:', err);
  serverProcess.kill();
  process.exit(1);
});
