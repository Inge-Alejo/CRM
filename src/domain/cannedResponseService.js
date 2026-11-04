// ==========================================================================
// CANNED RESPONSE SERVICE (RESPUESTAS RÁPIDAS & MACROS DE ASESOR)
// Persistencia híbrida (Neon Cloud Postgres + SQLite + JSON Backup)
// Sincronización en tiempo real para todos los asesores y sesiones
// ==========================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, recordSecurityAudit } from '../db/database.js';
import { NeonService } from '../db/neonService.js';
import { RealtimeService } from './realtimeService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_FILE = path.join(__dirname, '../db/canned_responses.json');

const DEFAULT_RESPONSES = [
  {
    id: 'macro_saludo',
    title: 'Saludo Oficial',
    shortcut: '👋 Saludo',
    message: '¡Hola! Te saluda un asesor del equipo de Extensión y Educación Continua de la Facultad de Medicina UdeA. Con mucho gusto te acompaño en tu proceso de información y matrícula. ¿En qué programa estás interesado?',
    category: 'saludos',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'macro_requisitos',
    title: 'Requisitos de Inscripción',
    shortcut: '📋 Requisitos',
    message: '📋 Requisitos de Inscripción:\n1. Copia de documento de identidad al 150%.\n2. Acta de grado o tarjeta profesional (según el perfil requerido del curso).\n3. Comprobante de pago oficial emitido por la UdeA.\n\n¿Tienes alguna duda sobre la documentación?',
    category: 'inscripcion',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'macro_horarios',
    title: 'Horarios y Modalidad',
    shortcut: '⏰ Horarios',
    message: '⏰ Horarios y Modalidad:\nNuestros diplomados y cursos combinan sesiones sincrónicas los fines de semana (viernes de 5:00 p.m. a 9:00 p.m. y sábados de 8:00 a.m. a 12:00 m.) con trabajo en plataforma virtual y talleres prácticos en el Campus de la Salud UdeA.',
    category: 'academico',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'macro_despedida',
    title: 'Despedida Institucional',
    shortcut: '🎓 Despedida',
    message: '¡Ha sido un placer orientarte! Quedamos atentos a cualquier inquietud adicional. Recuerda que en la Facultad de Medicina de la Universidad de Antioquia transformamos el conocimiento en bienestar para la comunidad. ¡Feliz día! 🎓👨‍⚕️',
    category: 'cierre',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

class CannedResponseService {
  constructor() {
    this.initStorage();
  }

  initStorage() {
    try {
      // 1. Inicializar tabla SQLite local si no existe
      db.exec(`
        CREATE TABLE IF NOT EXISTS canned_responses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          shortcut TEXT NOT NULL,
          message TEXT NOT NULL,
          category TEXT DEFAULT 'general',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      // Verificar si hay registros locales; si no, sembrar por defecto o desde backup
      const count = db.prepare('SELECT COUNT(*) as count FROM canned_responses').get();
      if (!count || count.count === 0) {
        let initialData = DEFAULT_RESPONSES;
        if (fs.existsSync(BACKUP_FILE)) {
          try {
            initialData = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
          } catch (e) {
            initialData = DEFAULT_RESPONSES;
          }
        }
        const insertStmt = db.prepare(`
          INSERT INTO canned_responses (id, title, shortcut, message, category, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        for (const item of initialData) {
          insertStmt.run(item.id, item.title, item.shortcut, item.message, item.category || 'general', item.created_at, item.updated_at);
        }
      }
      this.syncBackupFile();
    } catch (err) {
      console.warn('Advertencia inicializando tabla canned_responses:', err.message);
    }
  }

  syncBackupFile() {
    try {
      const rows = db.prepare('SELECT * FROM canned_responses ORDER BY created_at ASC').all();
      // Solo escribir si no es entorno de solo lectura o serverless
      if (!process.env.VERCEL) {
        fs.writeFileSync(BACKUP_FILE, JSON.stringify(rows, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('Aviso sincronizando canned_responses.json (posible FS de solo lectura):', e.message);
    }
  }

  async getAll() {
    // 1. Intentar consultar desde Neon Cloud Postgres
    if (NeonService.isAvailable()) {
      try {
        const cloudRows = await NeonService.getCannedResponses();
        if (cloudRows && cloudRows.length > 0) {
          return cloudRows;
        }
      } catch (err) {
        console.warn('Aviso consultando canned_responses en Neon, usando fallback local:', err.message);
      }
    }

    // 2. Fallback a SQLite local
    try {
      const rows = db.prepare('SELECT * FROM canned_responses ORDER BY created_at ASC').all();
      return rows;
    } catch (e) {
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          return JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
        } catch (err) {}
      }
      return DEFAULT_RESPONSES;
    }
  }

  async create({ title, shortcut, message, category }) {
    if (!title || !message) {
      throw new Error('El título y el mensaje son obligatorios.');
    }
    const id = 'macro_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const now = new Date().toISOString();
    const cleanShortcut = (shortcut && shortcut.trim()) ? shortcut.trim() : title.substring(0, 15);
    const cleanCategory = category ? category.trim().toLowerCase() : 'general';

    // 1. Guardar en Neon Cloud
    let createdRecord = null;
    if (NeonService.isAvailable()) {
      try {
        createdRecord = await NeonService.createCannedResponse({
          id,
          title: title.trim(),
          shortcut: cleanShortcut,
          message: message.trim(),
          category: cleanCategory,
          created_at: now,
          updated_at: now
        });
      } catch (err) {
        console.warn('Error guardando canned_response en Neon:', err.message);
      }
    }

    // 2. Guardar en SQLite local
    try {
      db.prepare(`
        INSERT INTO canned_responses (id, title, shortcut, message, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, title.trim(), cleanShortcut, message.trim(), cleanCategory, now, now);
      this.syncBackupFile();
    } catch (e) {}

    recordSecurityAudit('CANNED_RESPONSE_CREATED', { id, title: title.trim(), shortcut: cleanShortcut });
    const finalRecord = createdRecord || { id, title: title.trim(), shortcut: cleanShortcut, message: message.trim(), category: cleanCategory, created_at: now, updated_at: now };
    RealtimeService.notifyCannedUpdate('create', finalRecord);
    return finalRecord;
  }

  async update(id, { title, shortcut, message, category }) {
    let existing = null;
    if (NeonService.isAvailable()) {
      try {
        const rows = await NeonService.getCannedResponses();
        existing = rows.find(r => r.id === id);
      } catch (e) {}
    }
    if (!existing) {
      existing = db.prepare('SELECT * FROM canned_responses WHERE id = ?').get(id);
    }
    if (!existing) {
      throw new Error('Respuesta rápida no encontrada.');
    }

    const now = new Date().toISOString();
    const newTitle = title !== undefined ? title.trim() : existing.title;
    const newShortcut = shortcut !== undefined ? shortcut.trim() : existing.shortcut;
    const newMessage = message !== undefined ? message.trim() : existing.message;
    const newCategory = category !== undefined ? category.trim().toLowerCase() : existing.category;

    let updatedRecord = null;
    if (NeonService.isAvailable()) {
      try {
        updatedRecord = await NeonService.updateCannedResponse(id, {
          title: newTitle,
          shortcut: newShortcut,
          message: newMessage,
          category: newCategory,
          updated_at: now
        });
      } catch (err) {
        console.warn('Error actualizando canned_response en Neon:', err.message);
      }
    }

    try {
      db.prepare(`
        UPDATE canned_responses
        SET title = ?, shortcut = ?, message = ?, category = ?, updated_at = ?
        WHERE id = ?
      `).run(newTitle, newShortcut, newMessage, newCategory, now, id);
      this.syncBackupFile();
    } catch (e) {}

    recordSecurityAudit('CANNED_RESPONSE_UPDATED', { id, title: newTitle, shortcut: newShortcut });
    const finalUpdated = updatedRecord || { id, title: newTitle, shortcut: newShortcut, message: newMessage, category: newCategory, created_at: existing.created_at, updated_at: now };
    RealtimeService.notifyCannedUpdate('update', finalUpdated);
    return finalUpdated;
  }

  async delete(id) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.deleteCannedResponse(id);
      } catch (err) {
        console.warn('Error eliminando canned_response en Neon:', err.message);
      }
    }

    try {
      db.prepare('DELETE FROM canned_responses WHERE id = ?').run(id);
      this.syncBackupFile();
    } catch (e) {}

    recordSecurityAudit('CANNED_RESPONSE_DELETED', { id });
    RealtimeService.notifyCannedUpdate('delete', { id });
    return { success: true, deletedId: id };
  }
}

export const cannedResponseService = new CannedResponseService();
