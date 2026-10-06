import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function initPostgresDatabase() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.warn('⚠️ POSTGRES_URL no definida, omitiendo inicialización de Postgres.');
    return false;
  }

  const sql = neon(url);
  console.log('🚀 Inicializando esquema relacional en Neon Serverless Postgres...');

  // 1. Crear tablas
  await sql`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      phone_number TEXT NOT NULL,
      window_started_at TEXT NOT NULL,
      window_expires_at TEXT NOT NULL,
      year_month TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
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
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      phone_number TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id SERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      target_audience TEXT,
      modality TEXT,
      duration_hours INTEGER,
      investment TEXT,
      registration_link TEXT,
      payment_link TEXT,
      contact_email TEXT,
      description TEXT NOT NULL,
      start_date TEXT,
      schedule TEXT,
      is_active INTEGER DEFAULT 1
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS advisors (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      role_type TEXT DEFAULT 'advisor',
      email TEXT UNIQUE,
      password TEXT DEFAULT 'UdeA2026*',
      phone TEXT,
      avatar TEXT,
      is_active INTEGER DEFAULT 1
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      event TEXT NOT NULL,
      details TEXT,
      timestamp TEXT NOT NULL
    );
  `;

  // Índices
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(phone_number, status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_conversations_ym ON conversations(year_month);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone_number);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_messages_phone ON messages(phone_number);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_code ON knowledge_items(code);`;

  // 2. Sembrar Super Administrador TIC oficial si no existe
  const adminCheck = await sql`SELECT id FROM advisors WHERE LOWER(email) = 'proyectostic.med@udea.edu.co' LIMIT 1;`;
  if (adminCheck.length === 0) {
    await sql`
      INSERT INTO advisors (name, role, role_type, email, password, phone, avatar, is_active)
      VALUES (
        'Administrador General TIC', 
        'Super Administrador TIC', 
        'admin', 
        'proyectostic.med@udea.edu.co', 
        'UdeA2026*', 
        '+57 300 000 0000', 
        'TIC', 
        1
      );
    `;
    console.log('✅ Super Administrador TIC sembrado en Neon Postgres.');
  }

  // 3. Sembrar catálogo oficial de 25 programas desde knowledge_backup.json
  const coursesCount = await sql`SELECT count(*)::int as count FROM knowledge_items;`;
  if (coursesCount[0].count === 0) {
    const backupFile = path.resolve(__dirname, 'knowledge_backup.json');
    if (fs.existsSync(backupFile)) {
      const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
      console.log(`📦 Sembrando ${backupData.length} programas del catálogo en Neon Postgres...`);
      for (const item of backupData) {
        await sql`
          INSERT INTO knowledge_items (
            code, title, category, target_audience, modality, duration_hours,
            investment, registration_link, payment_link, contact_email, description,
            start_date, schedule, is_active
          ) VALUES (
            ${item.code}, ${item.title}, ${item.category}, ${item.target_audience || ''},
            ${item.modality || ''}, ${item.duration_hours || 0}, ${item.investment || ''},
            ${item.registration_link || ''}, ${item.payment_link || ''}, ${item.contact_email || ''},
            ${item.description || ''}, ${item.start_date || ''}, ${item.schedule || ''}, 1
          ) ON CONFLICT (code) DO NOTHING;
        `;
      }
      console.log('✅ Catálogo oficial sincronizado exitosamente en Neon Postgres.');
    }
  }

  // 4. Registrar evento de inicio en la bitácora de auditoría
  const nowIso = new Date().toISOString();
  await sql`
    INSERT INTO audit_logs (event, details, timestamp)
    VALUES ('NEON_POSTGRES_CONNECTED', 'Conexión e inicialización de esquema completada exitosamente en la nube', ${nowIso});
  `;

  console.log('🎉 Neon Postgres 100% configurado, sembrado y operativo.');
  return true;
}

if (process.argv[1] && process.argv[1].endsWith('migrateToNeon.js')) {
  initPostgresDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Error migrando a Neon:', err);
      process.exit(1);
    });
}
