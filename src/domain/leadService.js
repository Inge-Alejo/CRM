import { db, assignLeadAdvisor, markLeadAttendedByAdvisor, updateLeadNotes } from '../db/database.js';

export class LeadService {
  /**
   * Obtiene un lead específico por su número telefónico
   */
  static getLeadByPhone(phoneNumber) {
    return db.prepare('SELECT * FROM leads WHERE phone_number = ?').get(phoneNumber);
  }

  /**
   * Registra o actualiza un lead a partir de un mensaje entrante
   */
  static recordLeadMessage(phoneNumber, messageContent, sender = 'user') {
    const nowIso = new Date().toISOString();

    // 1. Guardar mensaje en el historial
    const msgStmt = db.prepare(`
      INSERT INTO messages (phone_number, sender, content, timestamp)
      VALUES (?, ?, ?, ?)
    `);
    msgStmt.run(phoneNumber, sender, messageContent, nowIso);

    // 2. Comprobar si ya existe el lead
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
  }

  /**
   * Actualiza los datos de segmentación en tiempo real del lead
   */
  static updateLeadSegmentation(phoneNumber, segData = {}) {
    const nowIso = new Date().toISOString();
    const current = this.getLeadByPhone(phoneNumber) || {};

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
  }

  /**
   * Asigna un asesor específico a un lead
   */
  static assignAdvisor(phoneNumber, advisorName) {
    assignLeadAdvisor(phoneNumber, advisorName);
  }

  /**
   * Marca al lead como contactado por un asesor
   */
  static markAttended(phoneNumber, advisorName) {
    markLeadAttendedByAdvisor(phoneNumber, advisorName);
  }

  /**
   * Guarda notas internas del asesor
   */
  static saveNotes(phoneNumber, notes) {
    updateLeadNotes(phoneNumber, notes);
  }

  /**
   * Actualiza el estado de un lead (ej: al solicitar asesor)
   */
  static updateLeadStatus(phoneNumber, status, programInterest = null, name = null) {
    const nowIso = new Date().toISOString();
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
  }

  /**
   * Obtiene todos los leads con filtros opcionales de estado, asesor y segmentación
   */
  static getAllLeads(filterStatus = null, filterAdvisor = null, filterTemperature = null, filterProfession = null) {
    let query = 'SELECT * FROM leads WHERE 1=1';
    const params = [];

    if (filterStatus) {
      query += ' AND status = ?';
      params.push(filterStatus);
    }
    if (filterAdvisor) {
      query += ' AND assigned_advisor = ?';
      params.push(filterAdvisor);
    }
    if (filterTemperature) {
      query += ' AND interest_temperature = ?';
      params.push(filterTemperature);
    }
    if (filterProfession) {
      query += ' AND segment_profession = ?';
      params.push(filterProfession);
    }

    query += ' ORDER BY updated_at DESC';
    return db.prepare(query).all(...params);
  }

  /**
   * Obtiene el historial completo de mensajes de un lead
   */
  static getLeadConversation(phoneNumber) {
    const stmt = db.prepare(`
      SELECT sender, content, timestamp 
      FROM messages 
      WHERE phone_number = ? 
      ORDER BY id ASC
    `);
    return stmt.all(phoneNumber);
  }
}
