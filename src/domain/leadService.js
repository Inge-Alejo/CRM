import { db, assignLeadAdvisor, markLeadAttendedByAdvisor, updateLeadNotes } from '../db/database.js';
import { NeonService } from '../db/neonService.js';

export class LeadService {
  /**
   * Obtiene un lead específico por su número telefónico
   */
  static async getLeadByPhone(phoneNumber) {
    if (NeonService.isAvailable()) {
      try {
        const lead = await NeonService.getLeadByPhone(phoneNumber);
        if (lead) return lead;
      } catch (err) {
        console.warn('Neon query error en getLeadByPhone, usando fallback local:', err.message);
      }
    }
    return db.prepare('SELECT * FROM leads WHERE phone_number = ?').get(phoneNumber);
  }

  /**
   * Registra o actualiza un lead a partir de un mensaje entrante
   */
  static async recordLeadMessage(phoneNumber, messageContent, sender = 'user') {
    const nowIso = new Date().toISOString();

    // 1. Guardar en Neon Postgres en la nube si está activo
    if (NeonService.isAvailable()) {
      try {
        await NeonService.recordLeadMessage(phoneNumber, messageContent, sender);
      } catch (err) {
        console.warn('Error guardando mensaje en Neon Postgres:', err.message);
      }
    }

    // 2. Mantener sincronizado en la base local/memoria SQLite
    try {
      const msgStmt = db.prepare(`
        INSERT INTO messages (phone_number, sender, content, timestamp)
        VALUES (?, ?, ?, ?)
      `);
      msgStmt.run(phoneNumber, sender, messageContent, nowIso);

      const checkLead = db.prepare('SELECT * FROM leads WHERE phone_number = ?').get(phoneNumber);

      if (!checkLead) {
        const insertLead = db.prepare(`
          INSERT INTO leads (
            phone_number, name, program_interest, status, created_at, updated_at, last_message,
            assigned_advisor, segment_profession, interest_temperature, thematic_area, event_interests
          )
          VALUES (?, ?, ?, 'ai_handling', ?, ?, ?, 'Sin Asignar', 'Por Definir', 'cold', 'General', '')
        `);
        insertLead.run(phoneNumber, 'Interesado UdeA', 'Por definir', nowIso, nowIso, messageContent);
      } else {
        const updateLead = db.prepare(`
          UPDATE leads 
          SET updated_at = ?, last_message = ?
          WHERE phone_number = ?
        `);
        updateLead.run(nowIso, messageContent, phoneNumber);
      }
    } catch (e) {
      // Ignorar fallas secundarias de caché local si Neon ya procesó
    }
  }

  /**
   * Actualiza los datos de segmentación en tiempo real del lead
   */
  static async updateLeadSegmentation(phoneNumber, segData = {}) {
    const nowIso = new Date().toISOString();

    if (NeonService.isAvailable()) {
      try {
        await NeonService.updateLeadSegmentation(phoneNumber, segData);
      } catch (err) {
        console.warn('Error actualizando segmentación en Neon:', err.message);
      }
    }

    try {
      let current = db.prepare('SELECT * FROM leads WHERE phone_number = ?').get(phoneNumber);
      if (!current) {
        const ins = db.prepare(`
          INSERT INTO leads (phone_number, name, status, created_at, updated_at, last_message, assigned_advisor, segment_profession, interest_temperature, thematic_area, event_interests)
          VALUES (?, 'Interesado UdeA', 'ai_handling', ?, ?, '', 'Sin Asignar', 'Por Definir', 'cold', 'General', '')
        `);
        ins.run(phoneNumber, nowIso, nowIso);
        current = db.prepare('SELECT * FROM leads WHERE phone_number = ?').get(phoneNumber) || {};
      }

      const profession = segData.segment_profession || current.segment_profession || 'Por Definir';
      const temperature = segData.interest_temperature || current.interest_temperature || 'cold';
      const area = segData.thematic_area || current.thematic_area || 'General';
      const events = segData.event_interests || current.event_interests || '';
      const name = (segData.name && segData.name !== 'Interesado UdeA') ? segData.name : (current.name || 'Interesado UdeA');
      const docType = segData.doc_type || current.doc_type || 'CC';
      const docNumber = segData.doc_number || current.doc_number || '';
      const email = segData.email || current.email || '';

      const stmt = db.prepare(`
        UPDATE leads
        SET name = ?, doc_type = ?, doc_number = ?, email = ?,
            segment_profession = ?, interest_temperature = ?, thematic_area = ?, event_interests = ?, updated_at = ?
        WHERE phone_number = ?
      `);
      stmt.run(name, docType, docNumber, email, profession, temperature, area, events, nowIso, phoneNumber);
    } catch (e) {}
  }

  /**
   * Asigna un asesor específico a un lead
   */
  static async assignAdvisor(phoneNumber, advisorName) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.assignAdvisor(phoneNumber, advisorName);
      } catch (err) {
        console.warn('Error asignando asesor en Neon:', err.message);
      }
    }
    assignLeadAdvisor(phoneNumber, advisorName);
  }

  /**
   * Marca al lead como contactado por un asesor
   */
  static async markAttended(phoneNumber, advisorName) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.markAttended(phoneNumber, advisorName);
      } catch (err) {
        console.warn('Error marcando atención en Neon:', err.message);
      }
    }
    markLeadAttendedByAdvisor(phoneNumber, advisorName);
  }

  /**
   * Guarda notas internas del asesor
   */
  static async saveNotes(phoneNumber, notes) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.saveNotes(phoneNumber, notes);
      } catch (err) {
        console.warn('Error guardando notas en Neon:', err.message);
      }
    }
    updateLeadNotes(phoneNumber, notes);
  }

  /**
   * Actualiza el estado de un lead (ej: al solicitar asesor)
   */
  static async updateLeadStatus(phoneNumber, status, programInterest = null, name = null) {
    const nowIso = new Date().toISOString();

    if (NeonService.isAvailable()) {
      try {
        await NeonService.updateLeadStatus(phoneNumber, status, programInterest, name);
      } catch (err) {
        console.warn('Error actualizando estado en Neon:', err.message);
      }
    }

    try {
      const fields = ['updated_at = ?', 'status = ?'];
      const params = [nowIso, status];

      if (programInterest) {
        fields.push('program_interest = ?');
        params.push(programInterest);
      }
      if (name) {
        fields.push('name = ?');
        params.push(name);
      }

      params.push(phoneNumber);

      const updateStmt = db.prepare(`
        UPDATE leads 
        SET ${fields.join(', ')}
        WHERE phone_number = ?
      `);
      updateStmt.run(...params);
    } catch (e) {}
  }

  /**
   * Obtiene todos los leads con filtros opcionales de estado, asesor y segmentación
   */
  static async getAllLeads(filterStatus = null, filterAdvisor = null, filterTemperature = null, filterProfession = null) {
    if (NeonService.isAvailable()) {
      try {
        return await NeonService.getAllLeads(filterStatus, filterAdvisor, filterTemperature, filterProfession);
      } catch (err) {
        console.warn('Neon query error en getAllLeads, usando fallback local:', err.message);
      }
    }

    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (filterStatus && filterStatus !== 'all') {
      query += ' AND status = ?';
      params.push(filterStatus);
    }
    if (filterAdvisor && filterAdvisor !== 'all') {
      query += ' AND assigned_advisor = ?';
      params.push(filterAdvisor);
    }
    if (filterTemperature && filterTemperature !== 'all') {
      query += ' AND interest_temperature = ?';
      params.push(filterTemperature);
    }
    if (filterProfession && filterProfession !== 'all') {
      query += ' AND segment_profession = ?';
      params.push(filterProfession);
    }

    query += ' ORDER BY updated_at DESC';
    return db.prepare(query).all(...params);
  }

  /**
   * Obtiene el historial completo de mensajes de un lead
   */
  static async getLeadConversation(phoneNumber) {
    if (NeonService.isAvailable()) {
      try {
        return await NeonService.getLeadConversation(phoneNumber);
      } catch (err) {
        console.warn('Neon query error en getLeadConversation, usando fallback local:', err.message);
      }
    }

    const stmt = db.prepare(`
      SELECT sender, content, timestamp 
      FROM messages 
      WHERE phone_number = ? 
      ORDER BY id ASC
    `);
    return stmt.all(phoneNumber);
  }
}
