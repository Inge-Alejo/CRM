import { db } from '../db/database.js';
import { config } from '../config.js';

export class ConversationTracker {
  /**
   * Obtiene el identificador del mes actual (ej: '2026-10')
   */
  static getCurrentYearMonth() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Valida si un mensaje entrante tiene ventana de 24h activa o si consume cuota mensual
   * Actúa como el INTERRUPTOR DE SEGURIDAD (Kill-Switch)
   * 
   * @param {string} phoneNumber 
   * @returns {{ allowed: boolean, consumesNewQuota: boolean, currentCount: number, limit: number, reason?: string }}
   */
  static evaluateIncomingMessage(phoneNumber) {
    const now = new Date();
    const nowIso = now.toISOString();
    const currentMonth = this.getCurrentYearMonth();

    // 1. Verificar si ya existe una ventana de 24 horas activa para este usuario
    const activeWindowStmt = db.prepare(`
      SELECT * FROM conversations 
      WHERE phone_number = ? 
        AND status = 'active' 
        AND window_expires_at > ?
      ORDER BY id DESC LIMIT 1
    `);
    const activeWindow = activeWindowStmt.get(phoneNumber, nowIso);

    if (activeWindow) {
      // Ya tiene ventana abierta. No consume cuota adicional.
      return {
        allowed: true,
        consumesNewQuota: false,
        activeWindowExpiresAt: activeWindow.window_expires_at,
        currentCount: this.getMonthlyUsage(currentMonth),
        limit: config.conversationLimit
      };
    }

    // 2. Si no tiene ventana activa, se requiere abrir una nueva conversación de servicio.
    // Consultar el total de conversaciones consumidas en el mes.
    const currentUsage = this.getMonthlyUsage(currentMonth);

    // 3. KILL-SWITCH ANTI-COBRO
    if (currentUsage >= config.conversationLimit) {
      // Registrar evento de seguridad en auditoría
      const auditStmt = db.prepare(`
        INSERT INTO audit_logs (event, details, timestamp)
        VALUES ('KILL_SWITCH_TRIGGERED', ?, ?)
      `);
      auditStmt.run(
        JSON.stringify({ phoneNumber, currentUsage, limit: config.conversationLimit }),
        nowIso
      );

      return {
        allowed: false,
        consumesNewQuota: false,
        currentCount: currentUsage,
        limit: config.conversationLimit,
        reason: `Límite mensual alcanzado (${currentUsage}/${config.conversationLimit}). El Kill-Switch bloqueó la respuesta para evitar cobros de Meta.`
      };
    }

    // 4. Abrir nueva ventana de 24 horas
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const insertWindowStmt = db.prepare(`
      INSERT INTO conversations (phone_number, window_started_at, window_expires_at, year_month, status)
      VALUES (?, ?, ?, ?, 'active')
    `);
    insertWindowStmt.run(phoneNumber, nowIso, expiresAt, currentMonth);

    return {
      allowed: true,
      consumesNewQuota: true,
      currentCount: currentUsage + 1,
      limit: config.conversationLimit,
      activeWindowExpiresAt: expiresAt
    };
  }

  /**
   * Obtiene la cantidad de conversaciones consumidas en el mes
   * @param {string} yearMonth 
   * @returns {number}
   */
  static getMonthlyUsage(yearMonth = this.getCurrentYearMonth()) {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM conversations WHERE year_month = ?');
    const result = stmt.get(yearMonth);
    return result ? result.total : 0;
  }

  /**
   * Métricas en tiempo real para el Dashboard de Telemetría
   */
  static getTelemetryMetrics() {
    const currentMonth = this.getCurrentYearMonth();
    const used = this.getMonthlyUsage(currentMonth);
    const limit = config.conversationLimit;
    const remaining = Math.max(0, limit - used);
    const percentage = Math.min(100, Math.round((used / limit) * 100));

    let riskLevel = 'safe'; // verde
    if (percentage >= 95) riskLevel = 'blocked'; // rojo
    else if (percentage >= 80) riskLevel = 'warning'; // amarillo

    const nowIso = new Date().toISOString();
    const activeWindowsStmt = db.prepare(`
      SELECT COUNT(*) as count FROM conversations 
      WHERE status = 'active' AND window_expires_at > ?
    `);
    const activeWindows = activeWindowsStmt.get(nowIso)?.count || 0;

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
}
