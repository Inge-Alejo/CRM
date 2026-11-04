import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runRealtimeMigration() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ POSTGRES_URL no definida en .env');
    process.exit(1);
  }

  const sql = neon(url);
  console.log('🚀 Ejecutando Migración V2 (Concurrencia, Presencia y Respuestas Rápidas en Neon)...');

  // 1. Columnas de versión y control en leads
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;`;
  await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_enabled INTEGER DEFAULT 1;`;
  console.log('✅ Columnas `version` y `ai_enabled` verificadas en `leads`.');

  // 2. Columnas de presencia en advisors
  await sql`ALTER TABLE advisors ADD COLUMN IF NOT EXISTS presence_status TEXT DEFAULT 'offline';`;
  await sql`ALTER TABLE advisors ADD COLUMN IF NOT EXISTS last_seen TEXT;`;
  await sql`ALTER TABLE advisors ADD COLUMN IF NOT EXISTS viewing_lead TEXT;`;
  console.log('✅ Columnas de presencia verificadas en `advisors`.');

  // 3. Crear tabla canned_responses en Neon
  await sql`
    CREATE TABLE IF NOT EXISTS canned_responses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      shortcut TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `;
  console.log('✅ Tabla `canned_responses` verificada en Neon.');

  // 4. Sembrar canned_responses si está vacía
  const countCanned = await sql`SELECT count(*)::int as count FROM canned_responses;`;
  if (countCanned[0].count === 0) {
    const cannedFile = path.resolve(__dirname, '../src/db/canned_responses.json');
    if (fs.existsSync(cannedFile)) {
      const cannedData = JSON.parse(fs.readFileSync(cannedFile, 'utf8'));
      console.log(`📦 Sembrando ${cannedData.length} respuestas rápidas en Neon...`);
      for (const item of cannedData) {
        await sql`
          INSERT INTO canned_responses (id, title, shortcut, message, category, created_at, updated_at)
          VALUES (${item.id}, ${item.title}, ${item.shortcut}, ${item.message}, ${item.category || 'general'}, ${item.created_at || new Date().toISOString()}, ${item.updated_at || new Date().toISOString()})
          ON CONFLICT (id) DO NOTHING;
        `;
      }
      console.log('✅ Respuestas rápidas sembradas en Neon.');
    }
  }

  // 5. Índices de optimización creados en Neon
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_updated_at ON leads(updated_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_advisor ON leads(assigned_advisor);`;
  await sql`CREATE INDEX IF NOT EXISTS idx_leads_temperature ON leads(interest_temperature);`;
  console.log('✅ Índices de optimización creados en Neon.');

  // 6. Tabla system_settings (Configuraciones maestras y Kill-Switch IA)
  await sql`
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by VARCHAR(255) DEFAULT 'system'
    );
  `;
  await sql`
    INSERT INTO system_settings (setting_key, setting_value, updated_at, updated_by)
    VALUES ('global_ai_enabled', 'true', ${new Date().toISOString()}, 'system')
    ON CONFLICT (setting_key) DO NOTHING;
  `;
  console.log('✅ Tabla `system_settings` verificada en Neon con global_ai_enabled.');

  // 7. Columnas de control de sesión única concurrente en advisors
  await sql`ALTER TABLE advisors ADD COLUMN IF NOT EXISTS current_session_id TEXT;`;
  await sql`ALTER TABLE advisors ADD COLUMN IF NOT EXISTS last_login_at TEXT;`;
  console.log('✅ Columnas de sesión única (current_session_id) verificadas en Neon.');

  console.log('🎉 Migración V2 completada exitosamente.');
}

runRealtimeMigration().catch(err => {
  console.error('❌ Error en migración V2:', err);
  process.exit(1);
});

