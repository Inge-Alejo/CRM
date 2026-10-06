import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDatabase, closeDatabase, getAdvisors, getSegmentationStats, verifyAdvisorCredentials, findAdvisorByEmail, registerNewAdvisor } from './db/database.js';
import { MetaCloudAdapter } from './adapters/metaCloudAdapter.js';
import { SimulatorAdapter } from './adapters/simulatorAdapter.js';
import { ConversationTracker } from './domain/conversationTracker.js';
import { LeadService } from './domain/leadService.js';
import { KnowledgeBaseService } from './domain/knowledgeBase.js';
import { AdvisorNotifier } from './domain/notifier.js';
import { RateLimiter } from './security/rateLimiter.js';
import { SecurityGuardrails } from './security/guardrails.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const rateLimiter = new RateLimiter(60, 60000); // 60 peticiones/minuto por IP

// 1. Inicializar base de datos SQLite
initDatabase();

// 2. Cabeceras de Ciberseguridad (Security by Design)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;"
  );
  next();
});

// 3. Rate Limiting Middleware
app.use((req, res, next) => {
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
  if (!rateLimiter.isAllowed(clientIp)) {
    return res.status(429).json({ error: 'Demasiadas solicitudes. Límite de seguridad alcanzado.' });
  }
  next();
});

// 4. Captura de Raw Body para validación criptográfica de firma HMAC de Meta
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString('utf8');
  }
}));
app.use(express.urlencoded({ extended: true }));

// 5. Servir archivos estáticos del CRM Dashboard
app.use(express.static(path.join(__dirname, '../public')));

// ==========================================
// RUTAS WEBHOOK OFICIAL DE META WHATSAPP
// ==========================================
app.get('/webhook', (req, res) => MetaCloudAdapter.handleVerification(req, res));
app.post('/webhook', (req, res) => MetaCloudAdapter.handleIncomingMessage(req, res));

import { ScraperService } from './domain/scraperService.js';

// ==========================================
// RUTAS API PARA EL DASHBOARD CRM
// ==========================================

// Sincronización automática vía Web Scraping
app.post('/api/knowledge/sync', async (req, res) => {
  try {
    const result = await ScraperService.syncFromWeb();
    res.json(result);
  } catch (err) {
    console.error('Error en sincronización web:', err);
    res.status(500).json({ error: err.message });
  }
});

// Telemetría y contador de las 1.000 conversaciones
app.get('/api/telemetry', (req, res) => {
  const metrics = ConversationTracker.getTelemetryMetrics();
  res.json({
    metrics,
    hasGeminiKey: Boolean(config.geminiApiKey && config.geminiApiKey.trim() !== ''),
    metaConfigured: Boolean(config.meta.phoneNumberId && config.meta.accessToken)
  });
});

// Lista de Leads en el CRM con soporte para filtros avanzados
app.get('/api/leads', (req, res) => {
  const statusFilter = req.query.status || null;
  const advisorFilter = req.query.advisor || null;
  const tempFilter = req.query.temperature || null;
  const profFilter = req.query.profession || null;
  const leads = LeadService.getAllLeads(statusFilter, advisorFilter, tempFilter, profFilter);
  res.json({ leads });
});

// ==================== AUTENTICACIÓN DE ASESORES ====================
app.post('/api/auth/login', (req, res) => {
  const { email, password, firebaseVerified } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Correo institucional requerido.' });
  }

  let advisor = null;
  if (firebaseVerified) {
    advisor = findAdvisorByEmail(email);
    if (!advisor) {
      // Asesor autenticado válidamente en Firebase Auth: aprovisionar perfil en el CRM
      const cleanEmail = email.trim().toLowerCase();
      const rawName = cleanEmail.split('@')[0].replace(/[._]/g, ' ');
      const formattedName = rawName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      advisor = registerNewAdvisor({
        name: formattedName || 'Asesor UdeA',
        email: cleanEmail,
        password: password || 'FirebaseManaged*',
        role: 'Asesor Centro de Extensión',
        phone: '+57 300 000 0000'
      });
    }
  } else {
    advisor = verifyAdvisorCredentials(email, password);
  }

  if (!advisor) {
    return res.status(401).json({ success: false, error: 'Credenciales inválidas. Verifica tu correo y contraseña institucional.' });
  }

  const token = Buffer.from(JSON.stringify({ id: advisor.id, email: advisor.email, time: Date.now() })).toString('base64');
  res.json({ success: true, advisor, token });
});

// Por máxima seguridad institucional: Registro público deshabilitado
app.post('/api/auth/register', (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Acceso restringido: El autoregistro público está inhabilitado por directrices de seguridad institucional.'
  });
});

app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ authenticated: false });
  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    const advisor = findAdvisorByEmail(decoded.email);
    if (!advisor) return res.status(401).json({ authenticated: false });
    res.json({ authenticated: true, advisor });
  } catch (e) {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Lista de asesores oficiales del equipo de extensión
app.get('/api/advisors', (req, res) => {
  const advisors = getAdvisors();
  res.json({ advisors });
});

// Asignar asesor a un lead
app.patch('/api/leads/:phone/advisor', (req, res) => {
  const phone = req.params.phone;
  const { advisor } = req.body;
  if (!advisor) return res.status(400).json({ error: 'Nombre del asesor es requerido' });
  LeadService.assignAdvisor(phone, advisor);
  res.json({ success: true, advisor });
});

// Marcar que un asesor atendió al lead
app.patch('/api/leads/:phone/attend', (req, res) => {
  const phone = req.params.phone;
  const { advisor } = req.body;
  LeadService.markAttended(phone, advisor || 'Asesor UdeA');
  res.json({ success: true, advisor: advisor || 'Asesor UdeA' });
});

// Guardar notas internas de un lead
app.patch('/api/leads/:phone/notes', (req, res) => {
  const phone = req.params.phone;
  const { notes } = req.body;
  LeadService.saveNotes(phone, notes || '');
  res.json({ success: true });
});

// Métricas de segmentación y base de audiencias en tiempo real
app.get('/api/segmentation', (req, res) => {
  const stats = getSegmentationStats();
  const filterProfession = req.query.profession || null;
  const filterTemperature = req.query.temperature || null;
  const filterAdvisor = req.query.advisor || null;
  const leads = LeadService.getAllLeads(null, filterAdvisor, filterTemperature, filterProfession);
  res.json({ stats, leads });
});

// Exportar base de datos segmentada a CSV (compatible con Excel)
app.get('/api/segmentation/export', (req, res) => {
  const filterProfession = req.query.profession || null;
  const filterTemperature = req.query.temperature || null;
  const filterAdvisor = req.query.advisor || null;
  const leads = LeadService.getAllLeads(null, filterAdvisor, filterTemperature, filterProfession);

  let csv = '\uFEFF'; // BOM para que Excel abra acentos UTF-8 correctamente
  csv += 'ID,Nombre,Tipo_Documento,Numero_Documento,Correo,Telefono,Profesion_Detectada,Temperatura,Area_Tematica,Eventos_Consultados,Asesor_Asignado,Atendido_Por,Fecha_Atencion,Estado,Notas,Ultimo_Mensaje,Fecha_Registro\n';

  for (const l of leads) {
    const row = [
      l.id,
      `"${(l.name || 'Interesado UdeA').replace(/"/g, '""')}"`,
      `"${(l.doc_type || 'CC').replace(/"/g, '""')}"`,
      `"${(l.doc_number || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.phone_number || '').replace(/"/g, '""')}"`,
      `"${(l.segment_profession || 'Por Definir').replace(/"/g, '""')}"`,
      `"${(l.interest_temperature || 'cold').toUpperCase()}"`,
      `"${(l.thematic_area || 'General').replace(/"/g, '""')}"`,
      `"${(l.event_interests || l.program_interest || '').replace(/"/g, '""')}"`,
      `"${(l.assigned_advisor || 'Sin Asignar').replace(/"/g, '""')}"`,
      `"${(l.attended_by || 'Pendiente').replace(/"/g, '""')}"`,
      `"${(l.attended_at || '—').replace(/"/g, '""')}"`,
      `"${(l.status || 'ai_handling').replace(/"/g, '""')}"`,
      `"${(l.notes || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(l.last_message || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(l.created_at || '').replace(/"/g, '""')}"`
    ];
    csv += row.join(',') + '\n';
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="audiencia_segmentada_udea_${Date.now()}.csv"`);
  res.send(csv);
});

// Historial de conversación de un lead
app.get('/api/leads/:phone/chat', (req, res) => {
  const phone = req.params.phone;
  const messages = LeadService.getLeadConversation(phone);
  const leadData = LeadService.getLeadByPhone(phone);
  res.json({ phone, messages, lead: leadData });
});

// Actualizar estado de un lead (Contactado, Cerrado, etc.)
app.patch('/api/leads/:phone/status', (req, res) => {
  const phone = req.params.phone;
  const { status, programInterest, name } = req.body;
  LeadService.updateLeadStatus(phone, status, programInterest, name);
  res.json({ success: true });
});

// Portafolio de Conocimiento UdeA
app.get('/api/knowledge', (req, res) => {
  const items = KnowledgeBaseService.getActiveItems();
  res.json({ items });
});

app.post('/api/knowledge', (req, res) => {
  try {
    const { code, title, category, target_audience, modality, duration_hours, investment, start_date, schedule, registration_link, contact_email, description } = req.body;
    KnowledgeBaseService.addItem({
      code: SecurityGuardrails.sanitizeInput(code),
      title: SecurityGuardrails.sanitizeInput(title),
      category: SecurityGuardrails.sanitizeInput(category || 'Curso'),
      target_audience: SecurityGuardrails.sanitizeInput(target_audience),
      modality: SecurityGuardrails.sanitizeInput(modality || 'Virtual'),
      duration_hours: parseInt(duration_hours || 0, 10),
      investment: SecurityGuardrails.sanitizeInput(investment),
      start_date: SecurityGuardrails.sanitizeInput(start_date || 'Inicia: Noviembre 2026'),
      schedule: SecurityGuardrails.sanitizeInput(schedule || 'Encuentros sincrónicos virtuales'),
      registration_link: SecurityGuardrails.sanitizeInput(registration_link),
      contact_email: SecurityGuardrails.sanitizeInput(contact_email),
      description: SecurityGuardrails.sanitizeInput(description)
    });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Alertas de asesores en tiempo real
app.get('/api/alerts', (req, res) => {
  const alerts = AdvisorNotifier.getRecentAlerts();
  res.json({ alerts });
});

// Simulador interactivo de WhatsApp (Sandbox)
app.post('/api/simulator/send', async (req, res) => {
  const { phoneNumber, message } = req.body;
  const result = await SimulatorAdapter.simulateMessage(phoneNumber, message);
  res.json(result);
});

// Guardar temporalmente la Gemini API Key desde la UI para pruebas
app.post('/api/settings/gemini-key', (req, res) => {
  const { apiKey } = req.body;
  if (apiKey && typeof apiKey === 'string') {
    config.geminiApiKey = apiKey.trim();
    res.json({ success: true, message: 'Gemini API Key actualizada en tiempo de ejecución' });
  } else {
    res.status(400).json({ error: 'Clave inválida' });
  }
});

// Configuración pública para el cliente (Firebase Auth desde variables de entorno Vercel)
app.get('/api/config/client', (req, res) => {
  res.json({
    firebase: {
      apiKey: config.firebase.apiKey,
      authDomain: config.firebase.authDomain,
      projectId: config.firebase.projectId
    },
    hasGeminiKey: !!config.geminiApiKey
  });
});

// Middleware Global de Manejo de Errores (sin filtrar trazas sensibles al cliente)
app.use((err, req, res, next) => {
  console.error('💥 Error no controlado en la aplicación:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).json({ error: 'Ha ocurrido un error interno en el servidor.' });
});

// Iniciar servidor standalone si no es entorno serverless (Vercel)
const PORT = config.port;
let server = null;

if (!process.env.VERCEL) {
  server = app.listen(PORT, () => {
    console.log(`\n=============================================================`);
    console.log(`🩺 CRM & CHATBOT WHATSAPP - FACULTAD DE MEDICINA UDEA`);
    console.log(`🌐 Servidor activo en: http://localhost:${PORT}`);
    console.log(`🛡️  Modo de seguridad: Kill-Switch activado a ${config.conversationLimit} conv/mes`);
    console.log(`📱 Simulador en vivo disponible en el panel web`);
    console.log(`=============================================================\n`);
  });

  // Cierre elegante (Graceful Shutdown)
  function shutdown(signal) {
    console.log(`\n🛑 Recibida señal ${signal}. Cerrando servidor y base de datos...`);
    rateLimiter.destroy();
    if (server) {
      server.close(() => {
        closeDatabase();
        console.log('✅ Base de datos cerrada y conexiones finalizadas con éxito.');
        process.exit(0);
      });
    }

    setTimeout(() => {
      console.error('⚠️ Forzando cierre del proceso tras 5 segundos.');
      process.exit(1);
    }, 5000).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
