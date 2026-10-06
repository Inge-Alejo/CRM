import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { initDatabase, closeDatabase, getAdvisors, getSegmentationStats, verifyAdvisorCredentials, findAdvisorByEmail, registerNewAdvisor, syncFirebaseAdvisor, recordSecurityAudit } from './db/database.js';
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
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com https://*.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-src 'self' https://*.firebaseapp.com https://crm-fdem.firebaseapp.com https://*.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:;"
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

// 5. Middleware de Inspección Activa de Seguridad (Prevención SQLi y Sanitización en APIs)
app.use('/api', (req, res, next) => {
  const isSimulator = req.path === '/simulator/send';

  const checkValue = (val, keyName = '') => {
    if (typeof val === 'string') {
      if (isSimulator && keyName === 'message') {
        return false; // El simulador procesa y neutraliza el mensaje en los guardrails de la IA
      }
      if (SecurityGuardrails.detectSqlInjection(val)) {
        return true;
      }
    } else if (typeof val === 'object' && val !== null) {
      for (const k of Object.keys(val)) {
        if (checkValue(val[k], k)) return true;
      }
    }
    return false;
  };

  if (checkValue(req.query) || checkValue(req.params) || checkValue(req.body)) {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    console.warn(`🚨 [CIBERSEGURIDAD UDEA] Intento de SQL Injection neutralizado desde ${clientIp} en ${req.method} ${req.originalUrl}`);
    recordSecurityAudit('SQLI_ATTEMPT_BLOCKED', {
      ip: clientIp,
      path: req.originalUrl,
      method: req.method,
      query: req.query
    });
    return res.status(400).json({
      error: 'Solicitud rechazada por filtros de seguridad institucional (patrón no seguro detectado).'
    });
  }
  next();
});

// 6. Servir archivos estáticos del CRM Dashboard
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

// ==========================================
// MIDDLEWARES DE AUTORIZACIÓN Y ROLES (RBAC)
// ==========================================
function getAuthUser(req) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader) {
    token = authHeader.replace('Bearer ', '').trim();
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    return findAdvisorByEmail(decoded.email);
  } catch (e) {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Sesión no válida o expirada. Inicie sesión nuevamente.' });
  }
  const isSuperAdmin = (user.role_type === 'admin' || user.email.toLowerCase() === 'proyectostic.med@udea.edu.co');
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Acceso restringido: Esta acción requiere privilegios de Administrador General TIC.' });
  }
  req.user = user;
  next();
}

/**
 * Verificador oficial contra la API REST de Google Firebase Identity Toolkit
 */
async function verifyFirebaseViaRest(email, password) {
  const apiKey = config.firebase.apiKey || 'AIzaSyCTwp8PaJvGlTYjJnBV7ktvnDeHd8aYemk';
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    const data = await res.json();
    if (data && data.idToken) {
      return { success: true, user: data };
    }
    return { success: false, error: data.error ? data.error.message : 'Auth error' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Sincronización automática vía Web Scraping (Exclusivo Administrador General)
app.post('/api/knowledge/sync', requireAdmin, async (req, res) => {
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

// Configuración pública para el cliente (Firebase Auth)
app.get('/api/config/client', (req, res) => {
  res.json({
    firebase: {
      apiKey: config.firebase.apiKey,
      authDomain: config.firebase.authDomain,
      projectId: config.firebase.projectId,
      storageBucket: config.firebase.storageBucket,
      appId: config.firebase.appId
    }
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

// ==================== AUTENTICACIÓN Y ROLES EN TIEMPO REAL ====================
app.post('/api/auth/login', async (req, res) => {
  const { email, password, firebaseVerified, displayName, firebaseUid } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: 'Correo institucional requerido.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password ? password.trim() : '';
  const isTargetAdmin = (cleanEmail === 'proyectostic.med@udea.edu.co');

  let advisor = null;

  // 1. Si vino verificado por el SDK cliente de Firebase
  if (firebaseVerified) {
    advisor = syncFirebaseAdvisor({ email: cleanEmail, displayName, firebaseUid, password: cleanPassword });
  } else {
    // 2. Si no vino verificado por cliente (ej: bloqueo de dominio Vercel, CSP o ad-blocker),
    // validar en tiempo real directamente con la API REST de Google Firebase Identity Toolkit
    const fbCheck = await verifyFirebaseViaRest(cleanEmail, cleanPassword);
    if (fbCheck.success) {
      advisor = syncFirebaseAdvisor({
        email: cleanEmail,
        displayName: fbCheck.user.displayName || displayName,
        firebaseUid: fbCheck.user.localId,
        password: cleanPassword
      });
    } else {
      // 3. Verificación institucional (para garantizar acceso sin bloqueos al Super Admin o credenciales locales)
      advisor = verifyAdvisorCredentials(cleanEmail, cleanPassword);
      
      // Si es el Administrador General proyectostic.med@udea.edu.co, garantizar su existencia y acceso total
      if (!advisor && isTargetAdmin) {
        advisor = syncFirebaseAdvisor({ email: cleanEmail, displayName: 'Administrador General TIC', password: cleanPassword });
      }
    }
  }

  if (!advisor) {
    return res.status(401).json({
      success: false,
      error: 'Credenciales no autorizadas. Verifica tu correo y contraseña institucional registrados en Firebase.'
    });
  }

  const isAdmin = (advisor.role_type === 'admin' || isTargetAdmin);
  advisor.role_type = isAdmin ? 'admin' : 'advisor';
  advisor.role = isAdmin ? 'Super Administrador TIC' : (advisor.role || 'Asesor de Extensión UdeA');
  advisor.name = isAdmin ? 'Administrador General TIC' : advisor.name;
  advisor.avatar = isAdmin ? 'TIC' : advisor.avatar;

  const permissions = {
    isAdmin,
    canViewOverview: true,
    canViewLeads: true,
    canViewPortfolio: true,
    canViewSegmentation: isAdmin,
    canViewSimulator: isAdmin,
    canViewSettings: isAdmin,
    canSyncPortfolio: isAdmin,
    canEditPortfolio: isAdmin,
    canExportData: isAdmin
  };

  const token = Buffer.from(JSON.stringify({ id: advisor.id, email: advisor.email, role_type: advisor.role_type, time: Date.now() })).toString('base64');
  res.json({ success: true, advisor, permissions, token });
});

// Por máxima seguridad institucional: Registro público deshabilitado
app.post('/api/auth/register', (req, res) => {
  return res.status(403).json({
    success: false,
    error: 'Acceso restringido: El autoregistro público está inhabilitado por directrices de seguridad institucional.'
  });
});

app.get('/api/auth/me', (req, res) => {
  const advisor = getAuthUser(req);
  if (!advisor) return res.status(401).json({ authenticated: false });
  const isAdmin = (advisor.role_type === 'admin' || advisor.email.toLowerCase() === 'proyectostic.med@udea.edu.co');
  advisor.role_type = isAdmin ? 'admin' : 'advisor';
  advisor.role = isAdmin ? 'Super Administrador TIC' : (advisor.role || 'Asesor de Extensión UdeA');
  advisor.name = isAdmin ? 'Administrador General TIC' : advisor.name;
  advisor.avatar = isAdmin ? 'TIC' : advisor.avatar;
  const permissions = {
    isAdmin,
    canViewOverview: true,
    canViewLeads: true,
    canViewPortfolio: true,
    canViewSegmentation: isAdmin,
    canViewSimulator: isAdmin,
    canViewSettings: isAdmin,
    canSyncPortfolio: isAdmin,
    canEditPortfolio: isAdmin,
    canExportData: isAdmin
  };
  res.json({ authenticated: true, advisor, permissions });
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
  res.json({ success: true, stats, audience: leads, leads });
});

// Exportar base de datos segmentada a CSV (Exclusivo Administrador General)
app.get('/api/segmentation/export', requireAdmin, (req, res) => {
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

app.post('/api/knowledge', requireAdmin, (req, res) => {
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
  if (res.headersSent) {
    return next(err);
  }
  if (err.status === 400 || err.statusCode === 400) {
    return res.status(400).json({ error: 'Formato de solicitud o JSON inválido.' });
  }
  console.error('💥 Error no controlado en la aplicación:', err);
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
