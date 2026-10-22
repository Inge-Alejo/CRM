import { db } from '../db/database.js';
import { AdvisorNotifier } from './notifier.js';

export class UnattendedAlertService {
  static checkIntervalTimer = null;
  static generatedAlertKeys = new Set(); // Para prevenir alertas duplicadas por el mismo mensaje

  /**
   * Inicializa la tarea periódica en segundo plano (cada 10 minutos)
   */
  static startMonitoring(intervalMs = 10 * 60 * 1000) {
    if (this.checkIntervalTimer) return;
    this.checkIntervalTimer = setInterval(() => {
      this.checkUnattendedConversations().catch(err => {
        console.warn('Aviso en verificación periódica de conversaciones desatendidas:', err.message);
      });
    }, intervalMs);

    if (this.checkIntervalTimer.unref) {
      this.checkIntervalTimer.unref();
    }

    // Ejecutar una verificación inicial
    this.checkUnattendedConversations().catch(() => {});
  }

  static stopMonitoring() {
    if (this.checkIntervalTimer) {
      clearInterval(this.checkIntervalTimer);
      this.checkIntervalTimer = null;
    }
  }

  /**
   * Examina todas las conversaciones activas para identificar aquellas con > 12 horas sin respuesta
   */
  static async checkUnattendedConversations() {
    const now = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    // Estados excluidos: conversaciones que ya no requieren respuesta
    const excludedStatuses = ['closed', 'not_interested', 'finalized'];

    // Consultar todos los leads activos
    const leads = db.prepare(`
      SELECT phone_number, name, status, assigned_advisor, attended_by, updated_at
      FROM leads
      WHERE status NOT IN ('closed', 'not_interested', 'finalized')
    `).all();

    const newAlerts = [];

    for (const lead of leads) {
      // Obtener el último mensaje registrado para este lead
      const lastMsg = db.prepare(`
        SELECT sender, content, timestamp 
        FROM messages 
        WHERE phone_number = ? 
        ORDER BY id DESC LIMIT 1
      `).get(lead.phone_number);

      if (!lastMsg) continue;

      // Si el último mensaje es del usuario, o el lead está en estado que requiere atención y el asesor aún no ha respondido
      const isWaitingAdvisor = (lastMsg.sender === 'user') || (lead.status === 'advisor_requested');

      if (isWaitingAdvisor) {
        const msgTime = new Date(lastMsg.timestamp).getTime();
        const elapsedMs = now - msgTime;

        if (elapsedMs >= TWELVE_HOURS_MS) {
          const elapsedHours = (elapsedMs / (1000 * 60 * 60)).toFixed(1);
          // Llave única para no duplicar alerta del mismo mensaje
          const alertKey = `${lead.phone_number}_${lastMsg.timestamp}`;

          if (!this.generatedAlertKeys.has(alertKey)) {
            this.generatedAlertKeys.add(alertKey);

            const alertData = {
              id: Date.now() + Math.floor(Math.random() * 1000),
              type: 'UNATTENDED_12H',
              phoneNumber: lead.phone_number,
              studentName: lead.name || 'Interesado UdeA',
              assignedAdvisor: lead.assigned_advisor && lead.assigned_advisor !== 'Sin Asignar' 
                ? lead.assigned_advisor 
                : 'Equipo General de Asesores',
              elapsedHours: `${elapsedHours} horas`,
              elapsedMs,
              lastUserMessage: lastMsg.content,
              lastUserMessageAt: lastMsg.timestamp,
              chatUrl: `/api/leads/${encodeURIComponent(lead.phone_number)}/chat`,
              status: 'pending',
              timestamp: new Date().toISOString()
            };

            // Disparar en AdvisorNotifier
            AdvisorNotifier.recentAlerts.unshift(alertData);
            if (AdvisorNotifier.recentAlerts.length > 50) AdvisorNotifier.recentAlerts.pop();

            // Registrar en auditoría de la base de datos
            try {
              db.prepare(`
                INSERT INTO audit_logs (event, details, timestamp)
                VALUES ('UNATTENDED_12H_ALERT', ?, ?)
              `).run(JSON.stringify(alertData), alertData.timestamp);
            } catch (e) {}

            newAlerts.push(alertData);
            console.log(`⚠️ [ALERTA 12H SIN RESPUESTA]: Lead ${lead.phone_number} lleva ${elapsedHours} horas esperando respuesta de ${alertData.assignedAdvisor}.`);
          }
        }
      }
    }

    return newAlerts;
  }

  /**
   * Obtiene la lista actual de todas las conversaciones que superan las 12 horas sin respuesta
   */
  static getPendingUnattendedConversations() {
    const now = Date.now();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    const leads = db.prepare(`
      SELECT phone_number, name, status, assigned_advisor, attended_by, updated_at
      FROM leads
      WHERE status NOT IN ('closed', 'not_interested', 'finalized')
    `).all();

    const pending = [];

    for (const lead of leads) {
      const lastMsg = db.prepare(`
        SELECT sender, content, timestamp 
        FROM messages 
        WHERE phone_number = ? 
        ORDER BY id DESC LIMIT 1
      `).get(lead.phone_number);

      if (!lastMsg) continue;

      const isWaitingAdvisor = (lastMsg.sender === 'user') || (lead.status === 'advisor_requested');

      if (isWaitingAdvisor) {
        const msgTime = new Date(lastMsg.timestamp).getTime();
        const elapsedMs = now - msgTime;

        if (elapsedMs >= TWELVE_HOURS_MS) {
          const elapsedHours = (elapsedMs / (1000 * 60 * 60)).toFixed(1);
          pending.push({
            phoneNumber: lead.phone_number,
            studentName: lead.name || 'Interesado UdeA',
            assignedAdvisor: lead.assigned_advisor && lead.assigned_advisor !== 'Sin Asignar' 
              ? lead.assigned_advisor 
              : 'Sin Asignar',
            elapsedHours: `${elapsedHours} horas`,
            elapsedMs,
            lastUserMessage: lastMsg.content,
            lastUserMessageAt: lastMsg.timestamp,
            chatUrl: `/api/leads/${encodeURIComponent(lead.phone_number)}/chat`
          });
        }
      }
    }

    return pending;
  }

  /**
   * Alias de compatibilidad para análisis y pruebas
   */
  static async detectOverdueConversations() {
    const list = this.getPendingUnattendedConversations();
    return list.map(item => ({
      ...item,
      hoursUnattended: parseFloat(item.elapsedHours)
    }));
  }
}

