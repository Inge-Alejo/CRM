import assert from 'node:assert';
import { initDatabase, closeDatabase, getSegmentationStats, getDb } from '../src/db/database.js';
import { GeminiService } from '../src/ai/geminiService.js';
import { ScraperService } from '../src/domain/scraperService.js';
import { BusinessHoursService } from '../src/domain/businessHoursService.js';
import { UnattendedAlertService } from '../src/domain/unattendedAlertService.js';
import { LeadService } from '../src/domain/leadService.js';
import { SimulatorAdapter } from '../src/adapters/simulatorAdapter.js';
import { generateAuthToken, verifyAuthToken } from '../src/security/authTokens.js';
import { RateLimiter } from '../src/security/rateLimiter.js';

async function runComprehensiveVerification() {
  console.log('======================================================================');
  console.log('🩺 INICIO DE VERIFICACIÓN TÉCNICA Y FUNCIONAL RIGUROSA');
  console.log('======================================================================\n');

  initDatabase();
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`✅ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] Test ${total}: ${name}`);
      console.error('   Error:', err.message);
      throw err;
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`✅ [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] Test ${total}: ${name}`);
      console.error('   Error:', err.message);
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // 1. SIMPLIFICACIÓN DEL PRIMER MENSAJE DEL CHATBOT
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Pruebas de Saludo Inicial Breve y Pertinencia de Cursos ---');

  await testAsync('Saludo inicial ante "Hola" genera respuesta breve y no listados extensos de cursos', async () => {
    const res = await GeminiService.generateReply('Hola', '573009991101');
    const reply = res && res.replyText ? res.replyText : '';
    console.log('   [DEBUG Test 1 Reply]:', JSON.stringify(reply));
    assert(typeof reply === 'string' && reply.length > 0, 'La respuesta debe ser un string con contenido');
    assert(reply.toLowerCase().includes('hola') || reply.toLowerCase().includes('bienvenido'), 'Debe incluir saludo y bienvenida');
    assert(reply.includes('¿En qué curso estás interesado?') || reply.includes('curso'), 'Debe preguntar amablemente en qué curso está interesado');
    
    // No debe volcar listados masivos de cursos
    const countDiplomados = (reply.match(/diplomado/gi) || []).length;
    assert(countDiplomados <= 1, `No debe listar múltiples diplomados automáticamente en un saludo inicial simple (encontrados: ${countDiplomados})`);
    assert(!reply.includes('$'), 'No debe mostrar precios en un simple saludo inicial');
  });

  await testAsync('Consulta sobre un curso específico responde con información pertinente', async () => {
    const res = await GeminiService.generateReply('Quiero información sobre Medicina del Sueño', '573009991101');
    const reply = res && res.replyText ? res.replyText : '';
    assert(reply.toLowerCase().includes('sueño') || reply.toLowerCase().includes('medicina del sueño'), 'Debe responder con información del curso consultado');
    assert(reply.includes('http') || reply.includes('extension.medicinaudea.co'), 'Debe proveer enlace relevante');
  });

  await testAsync('No repite saludo si la conversación ya está iniciada', async () => {
    // Pasar historial con mensaje previo para simular conversación ya iniciada
    const priorHistory = [
      { sender: 'user', content: 'Quiero información sobre Medicina del Sueño' },
      { sender: 'bot', content: '¡Con gusto! El Diplomado en Medicina del Sueño es 100% virtual.' }
    ];
    const res = await GeminiService.generateReply('¿Cuál es la modalidad?', '573009991101', priorHistory);
    const reply = res && res.replyText ? res.replyText : '';
    // En una segunda interacción sobre modalidad no debe empezar con "¡Hola! Bienvenido al Centro de Extensión..."
    assert(!reply.startsWith('¡Hola! 👋 Bienvenido al Centro de Extensión'), 'No debe repetir el saludo de bienvenida en mensajes posteriores');
  });

  // -------------------------------------------------------------------------
  // 2. CORREGIR IDENTIFICACIÓN DE SEDES MEDIANTE SCRAPING
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Pruebas de Normalización de Sedes y Scraping ---');

  test('La base de datos no contiene Sede Robledo erróneamente en cursos virtuales o de otras sedes', () => {
    const db = getDb();
    const rows = db.prepare('SELECT code, title, modality, schedule FROM knowledge_items').all();
    
    for (const r of rows) {
      if (r.title.toLowerCase().includes('virtual') || r.modality.toLowerCase().includes('virtual')) {
        assert(!r.modality.includes('Sede Robledo'), `El curso virtual ${r.title} no debe tener Sede Robledo`);
        assert(!r.schedule.includes('Centro de Simulación Médica Robledo'), `El curso virtual ${r.title} no debe tener horario presencial en Robledo`);
      }
    }
  });

  test('Cursos presenciales que no son de simulación tienen sede diferenciada o pendiente de validación', () => {
    const db = getDb();
    const sanIgnacio = db.prepare("SELECT * FROM knowledge_items WHERE title LIKE '%Paliativos%'").get();
    if (sanIgnacio) {
      assert(!sanIgnacio.modality.includes('Robledo'), 'Cuidados Paliativos no debe estar asignado a Sede Robledo');
    }
    const sanDiego = db.prepare("SELECT * FROM knowledge_items WHERE title LIKE '%Genética%'").get();
    if (sanDiego) {
      assert(!sanDiego.modality.includes('Robledo'), 'Genética no debe estar asignado a Sede Robledo');
    }
  });

  // -------------------------------------------------------------------------
  // 3. CAPACIDAD DE ASESORES SIMULTÁNEOS (CONCURRENCIA)
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Pruebas de Concurrencia con 5 o más Asesores Simultáneos ---');

  await testAsync('5 asesores distintos pueden autenticarse y operar concurrentemente', async () => {
    const advisorEmails = [
      'carolina.martinez@medicinaudea.co',
      'alejandro.gomez@medicinaudea.co',
      'valeria.restrepo@medicinaudea.co',
      'felipe.morales@medicinaudea.co',
      'asesor.medicina@udea.edu.co'
    ];

    const tokens = advisorEmails.map((email, idx) => {
      return generateAuthToken({ id: idx + 10, email, role_type: 'advisor' });
    });

    // Validar tokens
    tokens.forEach((token, idx) => {
      const decoded = verifyAuthToken(token);
      assert(decoded && decoded.email === advisorEmails[idx], `Token de asesor ${advisorEmails[idx]} debe ser válido`);
    });

    // Simular 5 operaciones paralelas simultáneas
    const promises = advisorEmails.map(async (email, idx) => {
      const phone = `57300777000${idx}`;
      await LeadService.recordLeadMessage(phone, `Mensaje de prueba simultáneo ${idx}`, 'user');
      await LeadService.assignAdvisor(phone, email);
      await LeadService.markAttended(phone, email);
      const lead = await LeadService.getLeadByPhone(phone);
      return lead;
    });

    const results = await Promise.all(promises);
    assert.strictEqual(results.length, 5, 'Deben procesarse las 5 operaciones simultáneas');
    results.forEach((lead, idx) => {
      assert(lead && lead.assigned_advisor === advisorEmails[idx], `El lead ${idx} debe tener asignado su asesor correspondiente sin colisiones`);
      assert(lead.attended_by === advisorEmails[idx], `El lead ${idx} debe estar atendido por su asesor sin interferencias`);
    });
  });

  test('RateLimiter ampliado soporta más de 300 solicitudes por minuto desde la misma IP', () => {
    const testLimiter = new RateLimiter(360, 60000);
    const clientIp = '192.168.1.100'; // IP compartida institucional
    let allowedCount = 0;
    for (let i = 0; i < 300; i++) {
      if (testLimiter.isAllowed(clientIp)) {
        allowedCount++;
      }
    }
    assert.strictEqual(allowedCount, 300, 'Debe permitir al menos 300 peticiones continuas sin 429');
    testLimiter.destroy();
  });

  // -------------------------------------------------------------------------
  // 4. CONDICIONES DE USO DE ENLACES DE PAGO
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Pruebas de Enlaces de Pago y Advertencia de Computador ---');

  await testAsync('Respuesta de pago incluye advertencia explícita de apertura desde computador', async () => {
    const testPhone = '573008883344';
    await LeadService.recordLeadMessage(testPhone, 'Quiero inscribirme en toxicología clínica', 'user');
    await LeadService.updateLeadSegmentation(testPhone, { program_interest: 'Diplomado en Toxicología Clínica' });
    
    const res = await GeminiService.generateReply('¿Dónde puedo pagar el Diplomado en Medicina del Sueño? Envíame el link de pago', testPhone);
    const reply = res && res.replyText ? res.replyText : '';
    console.log('   [DEBUG Test 8 Reply]:', JSON.stringify(reply));
    assert(reply.includes('computador') || reply.includes('computadora'), 'Debe advertir que se debe abrir desde un computador');
    assert(reply.includes('celulares') || reply.includes('móviles'), 'Debe advertir que no es compatible con dispositivos móviles');
    assert(reply.includes('http'), 'Debe incluir el enlace oficial intacto');
  });

  // -------------------------------------------------------------------------
  // 5. MANTENER DESACTIVADA LA IA EN EL CHAT DEL ASESOR
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Pruebas de Desactivación Persistente de la IA ---');

  await testAsync('Cuando la IA se desactiva (ai_enabled = 0), el bot no responde automáticamente', async () => {
    const phone = '573005554433';
    await SimulatorAdapter.initConversation(phone, true);

    // Desactivar IA explícitamente
    await LeadService.setLeadAiStatus(phone, false);
    await LeadService.updateLeadStatus(phone, 'advisor_handling');

    const leadBefore = await LeadService.getLeadByPhone(phone);
    console.log('   [DEBUG Test 9 leadBefore]:', leadBefore);
    console.log('   [DEBUG Test 9 pragma]:', getDb().prepare('PRAGMA table_info(leads)').all().map(c => c.name));
    assert.strictEqual(leadBefore.ai_enabled, 0, 'ai_enabled debe ser 0 en la BD');

    // Simular que el usuario envía un mensaje
    const result = await SimulatorAdapter.simulateMessage(phone, 'Hola, tengo una pregunta urgente');
    assert(result.aiPaused === true, 'El simulador debe indicar que la IA está pausada');
    assert(result.replyText.includes('pausada') || result.replyText.includes('asesor'), 'No debe generar respuesta automática de contenido');

    // Verificar que el estado se mantuvo intacto
    const leadAfter = await LeadService.getLeadByPhone(phone);
    assert.strictEqual(leadAfter.ai_enabled, 0, 'ai_enabled debe continuar siendo 0');
  });

  await testAsync('Reactivación de la IA solo ocurre mediante acción explícita autorizada', async () => {
    const phone = '573005554433';
    // Reactivar explícitamente
    await LeadService.setLeadAiStatus(phone, true);
    await LeadService.updateLeadStatus(phone, 'ai_handling');

    const lead = await LeadService.getLeadByPhone(phone);
    assert.strictEqual(lead.ai_enabled, 1, 'ai_enabled debe reactivarse a 1 tras acción explícita');
  });

  // -------------------------------------------------------------------------
  // 6. ALERTAR CONVERSACIONES CON MÁS DE 12 HORAS SIN RESPUESTA
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Pruebas de Detección de Conversaciones > 12h sin Respuesta ---');

  await testAsync('Detección correcta de conversaciones atrasadas > 12 horas', async () => {
    const db = getDb();
    const phoneOverdue = '573001239999';
    await LeadService.recordLeadMessage(phoneOverdue, 'Necesito ayuda por favor', 'user');
    
    // Forzar timestamp en el pasado (hace 14 horas)
    const fourteenHoursAgo = new Date(Date.now() - (14 * 60 * 60 * 1000)).toISOString();
    db.prepare('UPDATE leads SET updated_at = ?, status = ?, attended_by = NULL WHERE phone_number = ?')
      .run(fourteenHoursAgo, 'advisor_requested', phoneOverdue);
    db.prepare('UPDATE messages SET timestamp = ? WHERE phone_number = ?')
      .run(fourteenHoursAgo, phoneOverdue);

    const alerts = await UnattendedAlertService.detectOverdueConversations();
    const foundAlert = alerts.find(a => a.phoneNumber === phoneOverdue);
    assert(foundAlert !== undefined, 'Debe detectar la conversación con >12h sin respuesta');
    assert(foundAlert.hoursUnattended >= 13, `Las horas desatendidas deben ser >= 13 (actual: ${foundAlert.hoursUnattended})`);

    // Limpieza
    db.prepare('DELETE FROM leads WHERE phone_number = ?').run(phoneOverdue);
    db.prepare('DELETE FROM messages WHERE phone_number = ?').run(phoneOverdue);
  });

  // -------------------------------------------------------------------------
  // 7. HORARIO DE ATENCIÓN DE LOS ASESORES
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Pruebas de Horario de Atención Institucional ---');

  test('Configuración predeterminada L-V 8:00 a 17:00 en America/Bogota', () => {
    const status = BusinessHoursService.getStatus();
    assert.strictEqual(status.config.startHour, 8, 'Hora inicio debe ser 8');
    assert.strictEqual(status.config.endHour, 17, 'Hora fin debe ser 17');
    assert.strictEqual(status.config.timezone, 'America/Bogota', 'Zona horaria debe ser America/Bogota');
    assert(Array.isArray(status.config.workDays) && status.config.workDays.length === 5, 'Debe incluir lunes a viernes');
  });

  test('Diferenciación entre horario institucional y disponibilidad de asesores', () => {
    const availability = BusinessHoursService.getAdvisorAvailability('Dra. Carolina Martínez');
    assert(typeof availability.isOfficeOpen === 'boolean', 'Debe reportar si el horario general está abierto');
    assert(typeof availability.isAdvisorActive === 'boolean', 'Debe reportar disponibilidad real del asesor individual');
  });

  // -------------------------------------------------------------------------
  // 8. SEPARACIÓN DE OPCIONES DE ESTADO Y AUTOMATIZACIÓN DE ATENDIDO
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Pruebas de Separación de Estados y Finalizado -> Atendido ---');

  await testAsync('Cada estado independiente se puede almacenar y recuperar correctamente', async () => {
    const phone = '573004445566';
    await LeadService.recordLeadMessage(phone, 'Prueba de estados', 'user');
    const independentStatuses = [
      'ai_handling',
      'advisor_requested',
      'contacted',
      'attended',
      'follow_up',
      'enrolled',
      'closed',
      'not_interested'
    ];

    for (const st of independentStatuses) {
      await LeadService.updateLeadStatus(phone, st);
      const lead = await LeadService.getLeadByPhone(phone);
      assert.strictEqual(lead.status, st, `El estado debe guardarse independientemente como ${st}`);
    }
  });

  await testAsync('Al seleccionar "Finalizado", el lead se marca automáticamente como Atendido', async () => {
    const phone = '573004445566';
    // Reiniciar attended
    await LeadService.unmarkAttended(phone);
    let lead = await LeadService.getLeadByPhone(phone);
    assert(!lead.attended_by, 'Debe iniciar sin atendido');

    // Cambiar a finalized (marca automáticamente como atendido)
    await LeadService.updateLeadStatus(phone, 'finalized', null, null, 'Dr. Alejandro Gómez');

    lead = await LeadService.getLeadByPhone(phone);
    assert.strictEqual(lead.status, 'finalized', 'El estado del lead debe ser finalized');
    assert(lead.attended_by !== null && lead.attended_by !== undefined, 'Debe tener attended_by asignado');
    assert(lead.attended_at !== null && lead.attended_at !== undefined, 'Debe tener attended_at asignado');
    assert.strictEqual(lead.ai_enabled, 0, 'La IA debe quedar desactivada al finalizar');
  });

  test('getSegmentationStats desglosa atendidos y en seguimiento de forma separada', () => {
    const stats = getSegmentationStats();
    assert(stats.statuses !== undefined, 'Debe tener objeto statuses');
    assert(stats.statuses.attended !== undefined, 'Debe contabilizar attended independientemente');
    assert(stats.statuses.follow_up !== undefined, 'Debe contabilizar follow_up independientemente');
    assert(stats.statuses.closed !== undefined, 'Debe contabilizar closed independientemente');
    assert(stats.statuses.not_interested !== undefined, 'Debe contabilizar not_interested independientemente');
    assert(stats.statuses.finalized !== undefined, 'Debe contabilizar finalized independientemente');
  });

  console.log('\n======================================================================');
  console.log(`🎉 TODAS LAS PRUEBAS COMPLETADAS EXITOSAMENTE: ${passed}/${total}`);
  console.log('======================================================================\n');
}

runComprehensiveVerification().then(() => {
  closeDatabase();
  process.exit(0);
}).catch((err) => {
  console.error('Fallo en la suite de verificación:', err);
  closeDatabase();
  process.exit(1);
});
