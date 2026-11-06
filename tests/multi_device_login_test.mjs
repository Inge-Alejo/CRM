import app from '../src/server.js';
import http from 'node:http';

async function runTests() {
  console.log('🧪 INICIANDO AUDITORÍA Y TESTS DE INICIO DE SESIÓN MULTIDISPOSITIVO...\n');
  
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASÓ: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FALLÓ: ${message}`);
      failed++;
    }
  }

  try {
    // TEST 1: Superadmin con contraseña maestra de Firebase
    console.log('Test 1: Inicio de sesión Superadmin con contraseña maestra (UdeA.Medicina#2026!)');
    const res1 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'proyectostic.med@udea.edu.co',
        password: 'UdeA.Medicina#2026!'
      })
    });
    const data1 = await res1.json();
    assert(res1.status === 200 && data1.success === true, 'Login superadmin con UdeA.Medicina#2026! exitoso');
    assert(data1.advisor.role_type === 'admin', 'Rol es admin');
    assert(Boolean(data1.token), 'Retorna token JWT válido');
    assert(Boolean(data1.sessionId), 'Retorna sessionId');

    // TEST 2: Superadmin con alias "admin" y contraseña institucional estándar (UdeA2026*)
    console.log('\nTest 2: Inicio de sesión Superadmin usando alias "admin" y clave estándar (UdeA2026*)');
    const res2 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin',
        password: 'UdeA2026*'
      })
    });
    const data2 = await res2.json();
    assert(res2.status === 200 && data2.success === true, 'Login alias "admin" con UdeA2026* exitoso');
    assert(data2.advisor.email === 'proyectostic.med@udea.edu.co', 'Alias "admin" normalizado a proyectostic.med@udea.edu.co');
    assert(data2.permissions.isAdmin === true, 'Permisos de Super Administrador asignados');

    // TEST 3: Asesor institucional (Carolina Martínez) - No registrado en Firebase, autenticado vía BD
    console.log('\nTest 3: Inicio de sesión Asesora Carolina Martínez (validación institucional BD)');
    const res3 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carolina.martinez@udea.edu.co',
        password: 'UdeA2026*'
      })
    });
    const data3 = await res3.json();
    assert(res3.status === 200 && data3.success === true, 'Login Asesora Carolina Martínez exitoso');
    assert(data3.advisor.role_type === 'advisor', 'Rol es advisor');
    assert(data3.permissions.canViewSimulator === false, 'Asesor no tiene acceso al simulador restringido');

    // TEST 4: Asesor institucional (Alejandro Gómez)
    console.log('\nTest 4: Inicio de sesión Asesor Alejandro Gómez (validación institucional BD)');
    const res4 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alejandro.gomez@udea.edu.co',
        password: 'UdeA2026*'
      })
    });
    const data4 = await res4.json();
    assert(res4.status === 200 && data4.success === true, 'Login Asesor Alejandro Gómez exitoso');

    // TEST 5: Rechazo de contraseña incorrecta con 401
    console.log('\nTest 5: Rechazo seguro de contraseñas incorrectas');
    const res5 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carolina.martinez@udea.edu.co',
        password: 'ContrasenaErronea123!'
      })
    });
    const data5 = await res5.json();
    assert(res5.status === 401 && data5.success === false, 'Rechazo con código HTTP 401');
    assert(data5.error.includes('Credenciales no autorizadas'), 'Mensaje amigable de credenciales no autorizadas');

    // TEST 6: Rechazo de correo inexistente
    console.log('\nTest 6: Rechazo de usuario inexistente');
    const res6 = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'usuario.inexistente@udea.edu.co',
        password: 'CualquierPassword*'
      })
    });
    const data6 = await res6.json();
    assert(res6.status === 401 && data6.success === false, 'Rechazo de usuario inexistente con 401');

    // TEST 7: Verificación de sesión única activa multidispositivo (Device Handover)
    console.log('\nTest 7: Traspaso de sesión única activa (Equipo A -> Equipo B)');
    // Equipo A inicia sesión
    const devA = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carolina.martinez@udea.edu.co',
        password: 'UdeA2026*'
      })
    });
    const devAData = await devA.json();
    const tokenA = devAData.token;

    // Verificar que Equipo A tiene sesión activa en /api/auth/me
    const meA1 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const meA1Data = await meA1.json();
    assert(meA1.status === 200 && meA1Data.authenticated === true, 'Equipo A está autenticado');

    // Ahora Equipo B inicia sesión con la misma cuenta
    const devB = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'carolina.martinez@udea.edu.co',
        password: 'UdeA2026*'
      })
    });
    const devBData = await devB.json();
    const tokenB = devBData.token;
    assert(devB.status === 200 && devBData.success === true, 'Equipo B inicia sesión exitosamente');

    // Verificar que Equipo B está autenticado
    const meB = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const meBData = await meB.json();
    assert(meB.status === 200 && meBData.authenticated === true, 'Equipo B se mantiene activo');

    // Verificar que Equipo A fue invalidado (SESSION_TERMINATED)
    const meA2 = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const meA2Data = await meA2.json();
    assert(meA2.status === 401 && meA2Data.code === 'SESSION_TERMINATED', 'Equipo A fue invalidado con SESSION_TERMINATED');

  } finally {
    server.close();
  }

  console.log(`\n========================================`);
  console.log(`TOTAL RESULTADOS: ${passed} pasados, ${failed} fallados`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
