import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.VERCEL 
  ? path.join('/tmp', 'crm_database.sqlite') 
  : path.resolve(__dirname, '../../crm_database.sqlite');

export const db = new DatabaseSync(dbPath);

// Inicializar tablas con esquema seguro, relacional y migraciones automáticas
export function initDatabase() {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      window_started_at TEXT NOT NULL,
      window_expires_at TEXT NOT NULL,
      year_month TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL UNIQUE,
      name TEXT,
      doc_type TEXT DEFAULT 'CC',
      doc_number TEXT DEFAULT '',
      email TEXT DEFAULT '',
      program_interest TEXT,
      status TEXT DEFAULT 'ai_handling',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_message TEXT,
      assigned_advisor TEXT DEFAULT 'Sin Asignar',
      attended_by TEXT,
      attended_at TEXT,
      segment_profession TEXT DEFAULT 'Por Definir',
      interest_temperature TEXT DEFAULT 'cold',
      thematic_area TEXT DEFAULT 'General',
      event_interests TEXT DEFAULT '',
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_number TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      target_audience TEXT,
      modality TEXT,
      duration_hours INTEGER,
      investment TEXT,
      registration_link TEXT,
      contact_email TEXT,
      description TEXT NOT NULL,
      start_date TEXT,
      schedule TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS advisors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      email TEXT UNIQUE,
      password TEXT DEFAULT 'UdeA2026*',
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    -- Índices optimizados para alto rendimiento
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(phone_number, status, window_expires_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_ym ON conversations(year_month);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone_number, timestamp);
    CREATE INDEX IF NOT EXISTS idx_knowledge_active ON knowledge_items(is_active, category);
  `);

  applySchemaMigrations();

  // Índices para columnas migradas
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_advisor ON leads(assigned_advisor);
    CREATE INDEX IF NOT EXISTS idx_leads_segment ON leads(segment_profession, interest_temperature);
  `);

  seedAdvisors();
  seedKnowledgeBase();
  updateDefaultCourseDates();
}

/**
 * Migraciones idempotentes para bases de datos SQLite preexistentes
 */
function applySchemaMigrations() {
  // 1. Migración para knowledge_items (start_date, schedule)
  const kiCols = db.prepare('PRAGMA table_info(knowledge_items)').all().map(c => c.name);
  if (!kiCols.includes('start_date')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN start_date TEXT;`);
  }
  if (!kiCols.includes('schedule')) {
    db.exec(`ALTER TABLE knowledge_items ADD COLUMN schedule TEXT;`);
  }

  // 2. Migración para leads (asesores, segmentación y notas)
  const leadCols = db.prepare('PRAGMA table_info(leads)').all().map(c => c.name);
  if (!leadCols.includes('assigned_advisor')) {
    db.exec(`ALTER TABLE leads ADD COLUMN assigned_advisor TEXT DEFAULT 'Sin Asignar';`);
  }
  if (!leadCols.includes('attended_by')) {
    db.exec(`ALTER TABLE leads ADD COLUMN attended_by TEXT;`);
  }
  if (!leadCols.includes('attended_at')) {
    db.exec(`ALTER TABLE leads ADD COLUMN attended_at TEXT;`);
  }
  if (!leadCols.includes('segment_profession')) {
    db.exec(`ALTER TABLE leads ADD COLUMN segment_profession TEXT DEFAULT 'Por Definir';`);
  }
  if (!leadCols.includes('interest_temperature')) {
    db.exec(`ALTER TABLE leads ADD COLUMN interest_temperature TEXT DEFAULT 'cold';`);
  }
  if (!leadCols.includes('thematic_area')) {
    db.exec(`ALTER TABLE leads ADD COLUMN thematic_area TEXT DEFAULT 'General';`);
  }
  if (!leadCols.includes('event_interests')) {
    db.exec(`ALTER TABLE leads ADD COLUMN event_interests TEXT DEFAULT '';`);
  }
  if (!leadCols.includes('notes')) {
    db.exec(`ALTER TABLE leads ADD COLUMN notes TEXT DEFAULT '';`);
  }
  if (!leadCols.includes('doc_type')) {
    db.exec(`ALTER TABLE leads ADD COLUMN doc_type TEXT DEFAULT 'CC';`);
  }
  if (!leadCols.includes('doc_number')) {
    db.exec(`ALTER TABLE leads ADD COLUMN doc_number TEXT DEFAULT '';`);
  }
  if (!leadCols.includes('email')) {
    db.exec(`ALTER TABLE leads ADD COLUMN email TEXT DEFAULT '';`);
  }

  // 3. Migración para advisors (password)
  const advCols = db.prepare('PRAGMA table_info(advisors)').all().map(c => c.name);
  if (!advCols.includes('password')) {
    db.exec(`ALTER TABLE advisors ADD COLUMN password TEXT DEFAULT 'UdeA2026*';`);
  }
}

/**
 * Siembra los 4 asesores oficiales del equipo de extensión
 */
function seedAdvisors() {
  const count = db.prepare('SELECT COUNT(*) as c FROM advisors').get()?.c || 0;
  if (count > 0) return;

  const advisors = [
    {
      name: 'Dra. Carolina Martínez',
      role: 'Coordinadora de Educación Médica Continua',
      email: 'carolina.martinez@udea.edu.co',
      password: 'UdeA2026*',
      phone: '+57 300 456 7890',
      avatar: 'CM'
    },
    {
      name: 'Dr. Alejandro Gómez',
      role: 'Líder Simulación Clínica y Urgencias',
      email: 'alejandro.gomez@udea.edu.co',
      password: 'UdeA2026*',
      phone: '+57 311 234 5678',
      avatar: 'AG'
    },
    {
      name: 'Lic. Valeria Restrepo',
      role: 'Especialista en Admisiones y Matrículas',
      email: 'valeria.restrepo@udea.edu.co',
      password: 'UdeA2026*',
      phone: '+57 315 678 9012',
      avatar: 'VR'
    },
    {
      name: 'Dr. Felipe Morales',
      role: 'Asesor de Posgrados y Diplomados Clínicos',
      email: 'felipe.morales@udea.edu.co',
      password: 'UdeA2026*',
      phone: '+57 320 890 1234',
      avatar: 'FM'
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO advisors (name, role, email, password, phone, avatar)
    VALUES (@name, @role, @email, @password, @phone, @avatar)
  `);

  for (const adv of advisors) {
    stmt.run(adv);
  }
}

/**
 * Asigna fechas y horarios específicos a todos los programas que no los tengan
 */
/**
 * Asigna fechas, horarios e inversiones oficiales verificadas desde el portal de Medicina UdeA
 */
function updateDefaultCourseDates() {
  const items = db.prepare('SELECT id, code, title, modality, start_date, schedule, investment FROM knowledge_items').all();
  
  const updateStmt = db.prepare(`
    UPDATE knowledge_items
    SET start_date = ?, schedule = ?, investment = ?
    WHERE id = ?
  `);

  for (const item of items) {
    const titleLower = item.title.toLowerCase();
    const codeLower = (item.code || '').toLowerCase();

    let startDate = item.start_date;
    let schedule = item.schedule;
    let investment = item.investment;

    if (codeLower.includes('pediatria') || titleLower.includes('pediatría')) {
      startDate = 'Inicia: 11 al 13 de febrero de 2027';
      schedule = 'Jornadas académicas en Auditorio Centro Comercial San Diego, Medellín';
      investment = '$300.000 COP';
    } else if (codeLower.includes('anestesi') || titleLower.includes('anestesiología')) {
      startDate = 'Inicia: 12 al 14 de noviembre de 2026';
      schedule = 'Campus Medellín UdeA (Carrera 51D # 62-29)';
      investment = '$300.000 COP';
    } else if (codeLower.includes('neuro') || titleLower.includes('neurocirugía')) {
      startDate = 'Fecha: 23 de octubre de 2026';
      schedule = 'Jornada académica intensiva (Campus UdeA)';
      investment = '$170.000 COP';
    } else if (codeLower.includes('sueno') || titleLower.includes('sueño')) {
      startDate = 'Inicia: 1 de febrero al 30 de junio de 2027';
      schedule = 'Virtual sincrónico los Jueves 6:00 p.m. - 9:00 p.m. + Plataforma 24/7';
      investment = '$3.350.000 COP';
    } else if (codeLower.includes('acls') || titleLower.includes('avanzado') || titleLower.includes('soporte vital básico y avanzado')) {
      startDate = 'Inicia: 22 al 30 de octubre de 2026';
      schedule = 'Centro de Simulación Médica UdeA Sede Robledo';
      investment = '$850.000 COP';
    } else if (codeLower.includes('soporte vital básico') || (titleLower.includes('soporte vital') && !titleLower.includes('avanzado'))) {
      startDate = 'Inicia: 9 al 16 de octubre de 2026';
      schedule = 'Práctica intensiva en Centro de Simulación Médica Robledo';
      investment = '$250.000 COP';
    } else if (codeLower.includes('fucsia') || titleLower.includes('fucsia')) {
      startDate = 'Inicia: 2 al 28 de noviembre de 2026';
      schedule = 'Virtual con acompañamiento docente en AprendeEnLínea UdeA';
      investment = '$150.000 COP';
    } else if (codeLower.includes('buenas practicas') || titleLower.includes('buenas prácticas')) {
      startDate = 'Inicia: 2 al 28 de noviembre de 2026';
      schedule = 'Virtual a través de la plataforma de la Facultad de Medicina';
      investment = '$150.000 COP';
    } else if (codeLower.includes('organos') || titleLower.includes('donante')) {
      startDate = 'Inicia: 2 al 28 de noviembre de 2026';
      schedule = 'Virtual con encuentros sincrónicos';
      investment = '$300.000 COP';
    } else if (codeLower.includes('papsivi') || titleLower.includes('conflicto armado')) {
      startDate = 'Inicia: 2 al 27 de noviembre de 2026';
      schedule = 'Virtual con enfoque psicosocial y tutoría especializada';
      investment = '$150.000 COP';
    } else if (codeLower.includes('omicas') || titleLower.includes('ómicas')) {
      startDate = 'Inicia: 25 de julio al 12 de diciembre de 2026';
      schedule = 'Miércoles y Viernes 6:00 p.m. - 8:30 p.m. (AprendeEnLínea UdeA)';
      investment = '$3.100.000 COP';
    } else if (codeLower.includes('parto') || titleLower.includes('parto')) {
      startDate = 'Inicia: 13 de julio al 31 de octubre de 2026';
      schedule = 'Martes 5:00 p.m. - 9:00 p.m. + Talleres en Centro de Simulación';
      investment = '$1.800.000 COP';
    } else if (codeLower.includes('endocrino') || titleLower.includes('endocrinología')) {
      startDate = 'Inicia: 1 de junio al 20 de noviembre de 2026';
      schedule = 'Viernes 5:00 p.m. - 9:00 p.m.';
      investment = '$2.800.000 COP';
    } else if (!startDate || startDate.includes('Noviembre 2026')) {
      startDate = 'Inscripciones abiertas (Ver cohorte y calendario en enlace oficial)';
      schedule = 'Consultar programación detallada en el portal de extensión';
    }

    updateStmt.run(startDate, schedule, investment, item.id);
  }
}

function seedKnowledgeBase() {
  const existingCount = db.prepare('SELECT COUNT(*) as c FROM knowledge_items').get()?.c || 0;
  if (existingCount > 0) return;

  const seedData = [
    {
      code: 'DIP-SUENO-2026',
      title: 'Diplomado en Medicina del Sueño',
      category: 'Diplomado',
      target_audience: 'Médicos generales, neurólogos, neumólogos, psiquiatras y profesionales afines.',
      modality: 'Virtual con encuentros sincrónicos',
      duration_hours: 120,
      investment: '$2.900.000 COP',
      start_date: 'Inicia: 14 de Noviembre 2026 (Cohorte Virtual)',
      schedule: 'Jueves 6:00 p.m. - 9:00 p.m. + Plataforma 24/7',
      registration_link: 'https://extension.medicinaudea.co/eventos/medicina-del-sueno/',
      contact_email: 'aprendizajes.med@udea.edu.co',
      description: 'Aborda la fisiología del sueño, polisomnografía, diagnóstico y tratamiento de trastornos respiratorios del sueño, insomnio y parasomnias.'
    },
    {
      code: 'DIP-OMICAS-2026',
      title: 'Diplomado en Ciencias Ómicas y Medicina de Precisión',
      category: 'Diplomado',
      target_audience: 'Médicos, biólogos, bacteriólogos, bioinformáticos y profesionales biomédicos.',
      modality: 'Virtual (Plataforma AprendeEnLínea UdeA)',
      duration_hours: 100,
      investment: '$2.600.000 COP',
      start_date: 'Inicia: 28 de Noviembre 2026',
      schedule: 'Miércoles y Viernes 6:00 p.m. - 8:30 p.m.',
      registration_link: 'https://extension.medicinaudea.co/eventos/ciencias-omicas-aplicadas/',
      contact_email: 'aprendizajes.med@udea.edu.co',
      description: 'Genómica, transcriptómica, proteómica y bioinformática para el análisis de secuenciación de nueva generación (NGS) en salud humana.'
    },
    {
      code: 'DIP-PARTO-2026',
      title: 'Diplomado en Buenas Prácticas de Atención al Parto Seguro',
      category: 'Diplomado',
      target_audience: 'Ginecoobstetras, médicos generales, parteras y enfermeros profesionales.',
      modality: 'Híbrida (Virtual + Talleres de simulación en Medellín)',
      duration_hours: 80,
      investment: '$1.800.000 COP',
      start_date: 'Inicia: 18 de Noviembre 2026',
      schedule: 'Martes 5:00 p.m. - 9:00 p.m. + Talleres en Centro de Simulación',
      registration_link: 'https://extension.medicinaudea.co/eventos/parto-seguro/',
      contact_email: 'aprendizajes.med@udea.edu.co',
      description: 'Reducción de morbimortalidad materna y perinatal, humanización del parto, código rojo (hemorragia), preeclampsia y reanimación neonatal.'
    },
    {
      code: 'CUR-ACLS-2026',
      title: 'Curso Soporte Vital Básico y Avanzado (ACLS / BLS - AHA)',
      category: 'Curso',
      target_audience: 'Médicos, enfermeros profesionales y personal asistencial de áreas críticas.',
      modality: 'Presencial (Centro de Simulación Médica UdeA Sede Robledo)',
      duration_hours: 16,
      investment: '$980.000 COP (Incluye certificación oficial AHA por 2 años y libro)',
      start_date: 'Próxima cohorte: 21 y 22 de Noviembre 2026 (Presencial Robledo)',
      schedule: 'Sábado y Domingo intensivo 8:00 a.m. - 5:00 p.m. (16 horas prácticas)',
      registration_link: 'https://extension.medicinaudea.co/eventos/soporte-vital-basico-y-avanzado-4/',
      contact_email: 'simulacionmedicina@udea.edu.co',
      description: 'Certificación oficial de la American Heart Association en RCP de alta calidad, arritmias peri-paro, síndromes coronarios agudos y ACV.'
    },
    {
      code: 'CUR-COD-FUCSIA-2026',
      title: 'Curso Código Fucsia: Atención a Víctimas de Violencia Sexual',
      category: 'Curso',
      target_audience: 'Personal médico, enfermería, trabajo social y psicología.',
      modality: 'Virtual (Plataforma AprendeEnLínea)',
      duration_hours: 40,
      investment: '$380.000 COP',
      start_date: 'Inscripciones permanentes 2026 (Inicio inmediato autogestionado)',
      schedule: 'Virtual 100% asincrónico a tu propio ritmo (40 horas certificadas)',
      registration_link: 'https://extension.medicinaudea.co/eventos/codigo-fucsia/',
      contact_email: 'aprendizajes.med@udea.edu.co',
      description: 'Capacitación obligatoria según Resolución 459: profilaxis postexposición, cadena de custodia y primeros auxilios psicológicos.'
    }
  ];

  const insertStmt = db.prepare(`
    INSERT INTO knowledge_items (
      code, title, category, target_audience, modality,
      duration_hours, investment, start_date, schedule, registration_link, contact_email, description
    ) VALUES (
      @code, @title, @category, @target_audience, @modality,
      @duration_hours, @investment, @start_date, @schedule, @registration_link, @contact_email, @description
    )
  `);

  for (const item of seedData) {
    insertStmt.run(item);
  }
}

/**
 * Obtener los asesores disponibles
 */
export function getAdvisors() {
  return db.prepare('SELECT * FROM advisors WHERE is_active = 1 ORDER BY id ASC').all();
}

/**
 * Asigna un asesor a un lead y registra la trazabilidad
 */
export function assignLeadAdvisor(phoneNumber, advisorName) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE leads
    SET assigned_advisor = ?, updated_at = ?
    WHERE phone_number = ?
  `);
  stmt.run(advisorName, nowIso, phoneNumber);

  // Registro de auditoría
  const audit = db.prepare(`
    INSERT INTO audit_logs (event, details, timestamp)
    VALUES ('LEAD_ADVISOR_ASSIGNED', ?, ?)
  `);
  audit.run(JSON.stringify({ phoneNumber, advisor: advisorName }), nowIso);
}

/**
 * Marca que un asesor atendió al lead
 */
export function markLeadAttendedByAdvisor(phoneNumber, advisorName) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE leads
    SET status = 'contacted', attended_by = ?, attended_at = ?, updated_at = ?
    WHERE phone_number = ?
  `);
  stmt.run(advisorName, nowIso, nowIso, phoneNumber);

  const audit = db.prepare(`
    INSERT INTO audit_logs (event, details, timestamp)
    VALUES ('LEAD_ATTENDED_BY_ADVISOR', ?, ?)
  `);
  audit.run(JSON.stringify({ phoneNumber, advisor: advisorName }), nowIso);
}

/**
 * Actualiza las notas internas de un asesor para un lead
 */
export function updateLeadNotes(phoneNumber, notes) {
  const nowIso = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE leads
    SET notes = ?, updated_at = ?
    WHERE phone_number = ?
  `);
  return stmt.run(notes, nowIso, phoneNumber);
}

/**
 * Estadísticas de segmentación en tiempo real para el dashboard
 */
export function getSegmentationStats() {
  const totalLeads = db.prepare('SELECT COUNT(*) as c FROM leads').get()?.c || 0;
  
  // Por temperatura
  const tempRows = db.prepare(`
    SELECT interest_temperature, COUNT(*) as count 
    FROM leads 
    GROUP BY interest_temperature
  `).all();
  
  const tempMap = { hot: 0, warm: 0, cold: 0 };
  tempRows.forEach(r => { if (tempMap[r.interest_temperature] !== undefined) tempMap[r.interest_temperature] = r.count; });

  // Por profesión
  const profRows = db.prepare(`
    SELECT segment_profession, COUNT(*) as count 
    FROM leads 
    GROUP BY segment_profession 
    ORDER BY count DESC
  `).all();

  // Por área temática
  const areaRows = db.prepare(`
    SELECT thematic_area, COUNT(*) as count 
    FROM leads 
    GROUP BY thematic_area 
    ORDER BY count DESC
  `).all();

  // Por asesor
  const advisorStats = db.prepare(`
    SELECT assigned_advisor, COUNT(*) as total_assigned,
           SUM(CASE WHEN status = 'contacted' OR status = 'closed' THEN 1 ELSE 0 END) as total_attended
    FROM leads
    GROUP BY assigned_advisor
  `).all();

  return {
    totalLeads,
    temperatures: tempMap,
    professions: profRows,
    thematicAreas: areaRows,
    advisorStats
  };
}

/**
 * Valida credenciales de inicio de sesión de un asesor
 */
export function verifyAdvisorCredentials(email, password) {
  if (!email || !password) return null;
  const cleanEmail = email.trim().toLowerCase();
  const advisor = db.prepare('SELECT id, name, role, email, password, phone, avatar, is_active FROM advisors WHERE LOWER(email) = ? AND is_active = 1').get(cleanEmail);
  if (!advisor) return null;
  if (advisor.password !== password.trim()) return null;
  const { password: _, ...safeAdvisor } = advisor;
  return safeAdvisor;
}

/**
 * Busca un asesor por su correo electrónico
 */
export function findAdvisorByEmail(email) {
  if (!email) return null;
  const advisor = db.prepare('SELECT id, name, role, email, phone, avatar, is_active FROM advisors WHERE LOWER(email) = ?').get(email.trim().toLowerCase());
  if (!advisor) return null;
  const { password: _, ...safeAdvisor } = advisor;
  return safeAdvisor;
}

/**
 * Registra un nuevo asesor en la base de datos
 */
export function registerNewAdvisor({ name, email, password, role, phone }) {
  if (!name || !email || !password) throw new Error('Nombre, correo y contraseña son obligatorios');
  const cleanEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM advisors WHERE LOWER(email) = ?').get(cleanEmail);
  if (existing) {
    throw new Error('Ya existe un asesor registrado con este correo electrónico.');
  }

  const initials = name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const insertStmt = db.prepare(`
    INSERT INTO advisors (name, role, email, password, phone, avatar, is_active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  insertStmt.run(
    name.trim(),
    role ? role.trim() : 'Asesor de Extensión UdeA',
    cleanEmail,
    password.trim(),
    phone ? phone.trim() : '+57 300 000 0000',
    initials
  );

  return findAdvisorByEmail(cleanEmail);
}

/**
 * Actualiza los datos de identidad capturados por la IA (nombre, doc, email, perfil)
 */
export function updateLeadIdentity(phoneNumber, data = {}) {
  const nowIso = new Date().toISOString();
  const current = db.prepare('SELECT * FROM leads WHERE phone_number = ?').get(phoneNumber);
  if (!current) return null;

  const name = data.name || current.name;
  const docType = data.doc_type || current.doc_type || 'CC';
  const docNumber = data.doc_number || current.doc_number || '';
  const email = data.email || current.email || '';
  const profession = data.segment_profession || current.segment_profession || 'Por Definir';

  const stmt = db.prepare(`
    UPDATE leads
    SET name = ?, doc_type = ?, doc_number = ?, email = ?, segment_profession = ?, updated_at = ?
    WHERE phone_number = ?
  `);
  stmt.run(name, docType, docNumber, email, profession, nowIso, phoneNumber);
}

export function closeDatabase() {
  try {
    db.close();
  } catch (err) {
    console.error('Error cerrando base de datos:', err.message);
  }
}
