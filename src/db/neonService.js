import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const getSql = () => {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
};

export class NeonService {
  static isAvailable() {
    return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
  }

  // ==================== ASESORES & AUTENTICACIÓN ====================
  static async getAdvisors() {
    const sql = getSql();
    const rows = await sql`SELECT id, name, role, email, phone, avatar, role_type, is_active FROM advisors ORDER BY id ASC;`;
    return rows;
  }

  static async findAdvisorByEmail(email) {
    if (!email) return null;
    const sql = getSql();
    const cleanEmail = email.trim().toLowerCase();
    const rows = await sql`
      SELECT id, name, role, role_type, email, phone, avatar, is_active 
      FROM advisors 
      WHERE LOWER(email) = ${cleanEmail} 
      LIMIT 1;
    `;
    if (rows.length === 0) return null;
    const advisor = rows[0];
    if (cleanEmail === 'proyectostic.med@udea.edu.co') {
      advisor.role_type = 'admin';
      advisor.role = 'Super Administrador TIC';
    }
    return advisor;
  }

  static async verifyAdvisorCredentials(email, password) {
    if (!email || !password) return null;
    const sql = getSql();
    const cleanEmail = email.trim().toLowerCase();
    const rows = await sql`
      SELECT id, name, role, email, password, phone, avatar, role_type, is_active 
      FROM advisors 
      WHERE LOWER(email) = ${cleanEmail} AND is_active = 1
      LIMIT 1;
    `;
    if (rows.length === 0) return null;
    const advisor = rows[0];
    if (advisor.password !== password.trim()) return null;
    const { password: _, ...safeAdvisor } = advisor;
    return safeAdvisor;
  }

  static async syncFirebaseAdvisor({ email, displayName, firebaseUid, password }) {
    if (!email) throw new Error('Correo institucional obligatorio');
    const sql = getSql();
    const cleanEmail = email.trim().toLowerCase();
    const isAdmin = (cleanEmail === 'proyectostic.med@udea.edu.co');

    const defaultName = isAdmin ? 'Administrador General TIC' : (displayName || cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    const defaultRole = isAdmin ? 'Super Administrador TIC' : 'Asesor de Extensión UdeA';
    const roleType = isAdmin ? 'admin' : 'advisor';
    const avatar = isAdmin ? 'TIC' : defaultName.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

    const existing = await sql`SELECT id FROM advisors WHERE LOWER(email) = ${cleanEmail} LIMIT 1;`;

    if (existing.length > 0) {
      if (password && password.trim()) {
        await sql`
          UPDATE advisors 
          SET role_type = ${roleType}, role = ${defaultRole}, 
              name = CASE WHEN LOWER(email) = 'proyectostic.med@udea.edu.co' THEN 'Administrador General TIC' ELSE ${defaultName} END, 
              avatar = ${avatar}, password = ${password.trim()}
          WHERE id = ${existing[0].id};
        `;
      } else {
        await sql`
          UPDATE advisors 
          SET role_type = ${roleType}, role = ${defaultRole}, 
              name = CASE WHEN LOWER(email) = 'proyectostic.med@udea.edu.co' THEN 'Administrador General TIC' ELSE ${defaultName} END, 
              avatar = ${avatar}
          WHERE id = ${existing[0].id};
        `;
      }
      const updated = await sql`SELECT id, name, role, email, phone, avatar, role_type, is_active FROM advisors WHERE id = ${existing[0].id};`;
      return updated[0];
    } else {
      const pwdToSave = (password && password.trim()) ? password.trim() : 'UdeA2026*';
      const inserted = await sql`
        INSERT INTO advisors (name, role, email, password, phone, avatar, role_type, is_active)
        VALUES (${defaultName}, ${defaultRole}, ${cleanEmail}, ${pwdToSave}, '+57 300 000 0000', ${avatar}, ${roleType}, 1)
        RETURNING id, name, role, email, phone, avatar, role_type, is_active;
      `;
      return inserted[0];
    }
  }

  // ==================== PROSPECTOS (LEADS) ====================
  static async getAllLeads(statusFilter = null, advisorFilter = null, tempFilter = null, profFilter = null) {
    const sql = getSql();
    let rows = await sql`SELECT * FROM leads ORDER BY updated_at DESC;`;

    if (statusFilter && statusFilter !== 'all') {
      rows = rows.filter(l => l.status === statusFilter);
    }
    if (advisorFilter && advisorFilter !== 'all') {
      rows = rows.filter(l => l.assigned_advisor === advisorFilter);
    }
    if (tempFilter && tempFilter !== 'all') {
      rows = rows.filter(l => l.interest_temperature === tempFilter);
    }
    if (profFilter && profFilter !== 'all') {
      rows = rows.filter(l => l.segment_profession === profFilter);
    }

    return rows;
  }

  static async getLeadByPhone(phoneNumber) {
    const sql = getSql();
    const rows = await sql`SELECT * FROM leads WHERE phone_number = ${phoneNumber} LIMIT 1;`;
    return rows.length > 0 ? rows[0] : null;
  }

  static async getLeadConversation(phoneNumber) {
    const sql = getSql();
    const rows = await sql`
      SELECT sender, content, timestamp 
      FROM messages 
      WHERE phone_number = ${phoneNumber} 
      ORDER BY id ASC;
    `;
    return rows;
  }

  static async recordLeadMessage(phoneNumber, messageContent, sender = 'user') {
    const sql = getSql();
    const nowIso = new Date().toISOString();

    await sql`
      INSERT INTO messages (phone_number, sender, content, timestamp)
      VALUES (${phoneNumber}, ${sender}, ${messageContent}, ${nowIso});
    `;

    const checkLead = await sql`SELECT id FROM leads WHERE phone_number = ${phoneNumber} LIMIT 1;`;

    if (checkLead.length === 0) {
      await sql`
        INSERT INTO leads (
          phone_number, name, program_interest, status, created_at, updated_at, last_message,
          assigned_advisor, segment_profession, interest_temperature, thematic_area, event_interests
        )
        VALUES (${phoneNumber}, 'Interesado UdeA', 'Por definir', 'ai_handling', ${nowIso}, ${nowIso}, ${messageContent}, 'Sin Asignar', 'Por Definir', 'cold', 'General', '')
        ON CONFLICT (phone_number) DO NOTHING;
      `;
    } else {
      await sql`
        UPDATE leads 
        SET updated_at = ${nowIso}, last_message = ${messageContent}
        WHERE phone_number = ${phoneNumber};
      `;
    }
  }

  static async updateLeadStatus(phoneNumber, status, programInterest = null, name = null) {
    const sql = getSql();
    const nowIso = new Date().toISOString();
    const lead = await this.getLeadByPhone(phoneNumber);
    if (!lead) return;

    const newProg = programInterest || lead.program_interest;
    const newName = name || lead.name;

    await sql`
      UPDATE leads 
      SET status = ${status}, program_interest = ${newProg}, name = ${newName}, updated_at = ${nowIso}
      WHERE phone_number = ${phoneNumber};
    `;
  }

  static async updateLeadSegmentation(phoneNumber, segData = {}) {
    const sql = getSql();
    const nowIso = new Date().toISOString();
    let current = await this.getLeadByPhone(phoneNumber);
    if (!current) {
      await this.recordLeadMessage(phoneNumber, '', 'user');
      current = await this.getLeadByPhone(phoneNumber) || {};
    }

    const profession = segData.segment_profession || current.segment_profession || 'Por Definir';
    const temperature = segData.interest_temperature || current.interest_temperature || 'cold';
    const area = segData.thematic_area || current.thematic_area || 'General';
    const events = segData.event_interests || current.event_interests || '';
    const name = (segData.name && segData.name !== 'Interesado UdeA') ? segData.name : (current.name || 'Interesado UdeA');
    const docType = segData.doc_type || current.doc_type || 'CC';
    const docNumber = segData.doc_number || current.doc_number || '';
    const email = segData.email || current.email || '';

    await sql`
      UPDATE leads
      SET name = ${name}, doc_type = ${docType}, doc_number = ${docNumber}, email = ${email},
          segment_profession = ${profession}, interest_temperature = ${temperature}, 
          thematic_area = ${area}, event_interests = ${events}, updated_at = ${nowIso}
      WHERE phone_number = ${phoneNumber};
    `;
  }

  static async assignAdvisor(phoneNumber, advisorName) {
    const sql = getSql();
    const nowIso = new Date().toISOString();
    await sql`
      UPDATE leads 
      SET assigned_advisor = ${advisorName}, updated_at = ${nowIso}
      WHERE phone_number = ${phoneNumber};
    `;
    await this.recordSecurityAudit('ADVISOR_ASSIGNED', { phone: phoneNumber, advisor: advisorName });
  }

  static async markAttended(phoneNumber, advisorName) {
    const sql = getSql();
    const nowIso = new Date().toISOString();
    await sql`
      UPDATE leads 
      SET status = 'attended', attended_by = ${advisorName}, attended_at = ${nowIso}, updated_at = ${nowIso}
      WHERE phone_number = ${phoneNumber};
    `;
    await this.recordSecurityAudit('LEAD_ATTENDED', { phone: phoneNumber, advisor: advisorName });
  }

  static async saveNotes(phoneNumber, notes) {
    const sql = getSql();
    const nowIso = new Date().toISOString();
    await sql`
      UPDATE leads 
      SET notes = ${notes}, updated_at = ${nowIso}
      WHERE phone_number = ${phoneNumber};
    `;
  }

  // ==================== PORTAFOLIO DE EXTENSIÓN ====================
  static async getActiveItems() {
    const sql = getSql();
    return await sql`SELECT * FROM knowledge_items WHERE is_active = 1 ORDER BY id ASC;`;
  }

  static async getItemByCode(code) {
    const sql = getSql();
    const rows = await sql`SELECT * FROM knowledge_items WHERE code = ${code} LIMIT 1;`;
    return rows.length > 0 ? rows[0] : null;
  }

  static async updateKnowledgeItem(code, data) {
    const sql = getSql();
    await sql`
      UPDATE knowledge_items
      SET title = ${data.title}, category = ${data.category}, modality = ${data.modality},
          start_date = ${data.start_date}, schedule = ${data.schedule}, investment = ${data.investment},
          registration_link = ${data.registration_link}, payment_link = ${data.payment_link},
          contact_email = ${data.contact_email}, description = ${data.description}
      WHERE code = ${code};
    `;
  }

  static async addKnowledgeItem(data) {
    const sql = getSql();
    await sql`
      INSERT INTO knowledge_items (
        code, title, category, target_audience, modality, duration_hours,
        investment, registration_link, payment_link, contact_email, description,
        start_date, schedule, is_active
      ) VALUES (
        ${data.code}, ${data.title}, ${data.category}, ${data.target_audience || ''},
        ${data.modality || ''}, ${data.duration_hours || 0}, ${data.investment || ''},
        ${data.registration_link || ''}, ${data.payment_link || ''}, ${data.contact_email || ''},
        ${data.description || ''}, ${data.start_date || ''}, ${data.schedule || ''}, 1
      ) ON CONFLICT (code) DO NOTHING;
    `;
  }

  static async updateKnowledgeItemById(id, data) {
    const sql = getSql();
    await sql`
      UPDATE knowledge_items
      SET title = ${data.title}, category = ${data.category}, target_audience = ${data.target_audience || ''},
          modality = ${data.modality || 'Virtual'}, duration_hours = ${data.duration_hours || 0}, investment = ${data.investment || ''},
          start_date = ${data.start_date || ''}, schedule = ${data.schedule || ''},
          registration_link = ${data.registration_link || ''}, payment_link = ${data.payment_link || ''},
          contact_email = ${data.contact_email || ''}, description = ${data.description || ''}
      WHERE id = ${id};
    `;
  }

  static async deleteKnowledgeItemById(id) {
    const sql = getSql();
    await sql`UPDATE knowledge_items SET is_active = 0 WHERE id = ${id};`;
  }

  // ==================== CONVERSACIONES & KILL-SWITCH ====================
  static async getMonthlyUsage(yearMonth) {
    const sql = getSql();
    const rows = await sql`SELECT count(*)::int as total FROM conversations WHERE year_month = ${yearMonth};`;
    return rows.length > 0 ? rows[0].total : 0;
  }

  static async evaluateConversationWindow(phoneNumber, limit = 950) {
    const sql = getSql();
    const now = new Date();
    const nowIso = now.toISOString();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // 1. Verificar si hay ventana de 24h activa
    const activeRows = await sql`
      SELECT * FROM conversations
      WHERE phone_number = ${phoneNumber}
        AND status = 'active'
        AND window_expires_at > ${nowIso}
      ORDER BY id DESC LIMIT 1;
    `;

    if (activeRows.length > 0) {
      const activeWindow = activeRows[0];
      const currentCount = await this.getMonthlyUsage(yearMonth);
      return {
        allowed: true,
        consumesNewQuota: false,
        activeWindowExpiresAt: activeWindow.window_expires_at,
        currentCount,
        limit
      };
    }

    // 2. Comprobar cuota mensual
    const currentUsage = await this.getMonthlyUsage(yearMonth);

    // 3. Kill-Switch
    if (currentUsage >= limit) {
      await this.recordSecurityAudit('KILL_SWITCH_TRIGGERED', {
        phoneNumber,
        currentUsage,
        limit
      });
      return {
        allowed: false,
        consumesNewQuota: false,
        currentCount: currentUsage,
        limit,
        reason: `Límite mensual alcanzado (${currentUsage}/${limit}). El Kill-Switch bloqueó la respuesta para evitar cobros de Meta.`
      };
    }

    // 4. Abrir nueva ventana de 24 horas
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    await sql`
      INSERT INTO conversations (phone_number, window_started_at, window_expires_at, year_month, status)
      VALUES (${phoneNumber}, ${nowIso}, ${expiresAt}, ${yearMonth}, 'active');
    `;

    return {
      allowed: true,
      consumesNewQuota: true,
      currentCount: currentUsage + 1,
      limit,
      activeWindowExpiresAt: expiresAt
    };
  }

  static async getTelemetryMetrics(limit = 950) {
    const sql = getSql();
    const now = new Date();
    const nowIso = now.toISOString();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const used = await this.getMonthlyUsage(currentMonth);
    const remaining = Math.max(0, limit - used);
    const percentage = Math.min(100, Math.round((used / limit) * 100));

    let riskLevel = 'safe';
    if (percentage >= 95) riskLevel = 'blocked';
    else if (percentage >= 80) riskLevel = 'warning';

    const activeRows = await sql`
      SELECT count(*)::int as count FROM conversations
      WHERE status = 'active' AND window_expires_at > ${nowIso};
    `;
    const activeWindows = activeRows.length > 0 ? activeRows[0].count : 0;

    return {
      currentMonth,
      used,
      limit,
      remaining,
      percentage,
      riskLevel,
      activeWindows,
      officialMetaFreeTier: 1000,
      safetyBuffer: 1000 - limit
    };
  }

  // ==================== SEGMENTACIÓN & REPORTES ====================
  static async getSegmentationStats() {
    const sql = getSql();
    const allLeads = await sql`SELECT * FROM leads;`;
    const totalLeads = allLeads.length;

    const tempMap = { hot: 0, warm: 0, cold: 0 };
    const profMap = {};
    const areaMap = {};
    const advisorMap = {};

    allLeads.forEach(l => {
      tempMap[l.interest_temperature] = (tempMap[l.interest_temperature] || 0) + 1;
      profMap[l.segment_profession] = (profMap[l.segment_profession] || 0) + 1;
      areaMap[l.thematic_area] = (areaMap[l.thematic_area] || 0) + 1;
      
      const adv = l.assigned_advisor || 'Sin Asignar';
      if (!advisorMap[adv]) advisorMap[adv] = { assigned_advisor: adv, total_assigned: 0, total_attended: 0 };
      advisorMap[adv].total_assigned++;
      if (l.status === 'attended' || l.status === 'closed') {
        advisorMap[adv].total_attended++;
      }
    });

    const professionsList = Object.keys(profMap).map(p => ({ segment_profession: p, count: profMap[p] })).sort((a,b) => b.count - a.count);
    const thematicAreasList = Object.keys(areaMap).map(a => ({ thematic_area: a, count: areaMap[a] })).sort((a,b) => b.count - a.count);
    const advisorStats = Object.values(advisorMap);

    return {
      totalLeads,
      total_leads: totalLeads,
      temperatures: tempMap,
      professions: profMap,
      professionsList,
      thematicAreas: areaMap,
      thematicAreasList,
      advisorStats
    };
  }

  // ==================== AUDITORÍA & BITÁCORA ====================
  static async recordSecurityAudit(eventType, details) {
    try {
      const sql = getSql();
      const nowIso = new Date().toISOString();
      const detailStr = typeof details === 'string' ? details : JSON.stringify(details);
      await sql`
        INSERT INTO audit_logs (event, details, timestamp)
        VALUES (${eventType}, ${detailStr}, ${nowIso});
      `;
    } catch (err) {
      console.warn('Error registrando auditoría en Neon:', err.message);
    }
  }

  static async getRecentAuditLogs(limit = 20) {
    const sql = getSql();
    return await sql`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ${limit};`;
  }

  // ==================== MÉTRICAS DEL SISTEMA ====================
  static async getDetailedMetrics(currentYearMonth) {
    const sql = getSql();
    const [leadsTotal, leadsHot, leadsWarm, leadsCold, leadsUnassigned] = await Promise.all([
      sql`SELECT count(*)::int as c FROM leads;`,
      sql`SELECT count(*)::int as c FROM leads WHERE interest_temperature = 'hot';`,
      sql`SELECT count(*)::int as c FROM leads WHERE interest_temperature = 'warm';`,
      sql`SELECT count(*)::int as c FROM leads WHERE interest_temperature = 'cold';`,
      sql`SELECT count(*)::int as c FROM leads WHERE assigned_advisor = 'Sin Asignar' OR assigned_advisor IS NULL;`
    ]);

    const [msgsTotal, msgsUser, msgsBot, msgsAdvisor] = await Promise.all([
      sql`SELECT count(*)::int as c FROM messages;`,
      sql`SELECT count(*)::int as c FROM messages WHERE sender = 'user';`,
      sql`SELECT count(*)::int as c FROM messages WHERE sender = 'bot';`,
      sql`SELECT count(*)::int as c FROM messages WHERE sender = 'advisor';`
    ]);

    const [convCount, kiTotal, kiDip, kiCur, kiPay, advCount, auditCount, recentAudit] = await Promise.all([
      sql`SELECT count(*)::int as c FROM conversations WHERE year_month = ${currentYearMonth};`,
      sql`SELECT count(*)::int as c FROM knowledge_items WHERE is_active = 1;`,
      sql`SELECT count(*)::int as c FROM knowledge_items WHERE is_active = 1 AND category = 'Diplomado';`,
      sql`SELECT count(*)::int as c FROM knowledge_items WHERE is_active = 1 AND category != 'Diplomado';`,
      sql`SELECT count(*)::int as c FROM knowledge_items WHERE is_active = 1 AND payment_link IS NOT NULL AND payment_link != '';`,
      sql`SELECT count(*)::int as c FROM advisors WHERE is_active = 1;`,
      sql`SELECT count(*)::int as c FROM audit_logs;`,
      sql`SELECT id, event, details, timestamp FROM audit_logs ORDER BY id DESC LIMIT 20;`
    ]);

    return {
      leadStats: {
        total: leadsTotal[0].c,
        hot: leadsHot[0].c,
        warm: leadsWarm[0].c,
        cold: leadsCold[0].c,
        unassigned: leadsUnassigned[0].c
      },
      messageStats: {
        total: msgsTotal[0].c,
        userMessages: msgsUser[0].c,
        botMessages: msgsBot[0].c,
        advisorMessages: msgsAdvisor[0].c
      },
      conversationsCount: convCount[0].c,
      knowledgeStats: {
        total: kiTotal[0].c,
        diplomados: kiDip[0].c,
        cursos: kiCur[0].c,
        withPaymentLink: kiPay[0].c
      },
      advisorsCount: advCount[0].c,
      totalAuditLogs: auditCount[0].c,
      recentAuditLogs: recentAudit
    };
  }

  static async getDatabaseStats() {
    const sql = getSql();
    const leadsCount = await sql`SELECT count(*)::int as c FROM leads;`;
    const messagesCount = await sql`SELECT count(*)::int as c FROM messages;`;
    const coursesCount = await sql`SELECT count(*)::int as c FROM knowledge_items WHERE is_active = 1;`;
    const paymentLinksCount = await sql`SELECT count(*)::int as c FROM knowledge_items WHERE payment_link IS NOT NULL AND payment_link != '' AND is_active = 1;`;
    const advisorsCount = await sql`SELECT count(*)::int as c FROM advisors;`;
    const auditCount = await sql`SELECT count(*)::int as c FROM audit_logs;`;

    return {
      sizeFormatted: 'Cloud Managed (Neon)',
      filePath: 'Neon Serverless PostgreSQL (Cloud)',
      engine: 'PostgreSQL 18.6 (Neon Cloud)',
      tables: {
        leads: { total: leadsCount[0].c },
        messages: { total: messagesCount[0].c },
        knowledge: { total: coursesCount[0].c, withPaymentLink: paymentLinksCount[0].c },
        advisorsCount: advisorsCount[0].c,
        totalAuditLogs: auditCount[0].c
      }
    };
  }
}
