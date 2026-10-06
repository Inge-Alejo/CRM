import { db } from '../db/database.js';
import { config } from '../config.js';

export class AdvisorNotifier {
  static recentAlerts = [];

  /**
   * Dispara una alerta inmediata de requerimiento de asesor humano
   * @param {object} param0 
   */
  static async triggerAdvisorAlert({ phoneNumber, studentName, reason, lastUserMessage }) {
    const timestamp = new Date().toISOString();
    const alertData = {
      id: Date.now(),
      phoneNumber,
      studentName: studentName || 'Interesado UdeA',
      reason: reason || 'El usuario solicitó hablar con un asesor humano',
      lastUserMessage,
      timestamp,
      whatsappDirectUrl: `https://wa.me/${phoneNumber.replace('+', '')}`,
      status: 'pending'
    };

    // 1. Guardar en historial de alertas en memoria para el Dashboard en tiempo real
    this.recentAlerts.unshift(alertData);
    if (this.recentAlerts.length > 50) this.recentAlerts.pop();

    // 2. Registrar en auditoría SQLite
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (event, details, timestamp)
      VALUES ('ADVISOR_HANDOFF_REQUESTED', ?, ?)
    `);
    auditStmt.run(JSON.stringify(alertData), timestamp);

    // 3. Simulación y log de correo electrónico / webhook
    console.log(`\n========================================================================`);
    console.log(`🚨 [ALERTA DE ASESOR HUMANO - EXTENSIÓN MEDICINA UDEA]`);
    console.log(`Para: ${config.advisor.email}`);
    console.log(`Interesado: ${alertData.studentName} (${phoneNumber})`);
    console.log(`Motivo: ${alertData.reason}`);
    console.log(`Último mensaje: "${lastUserMessage}"`);
    console.log(`Enlace directo WhatsApp: ${alertData.whatsappDirectUrl}`);
    console.log(`========================================================================\n`);

    return alertData;
  }

  static getRecentAlerts() {
    return this.recentAlerts;
  }
}
