import { db } from '../db/database.js';
import { config } from '../config.js';
import { NeonService } from '../db/neonService.js';

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
   * @returns {Promise<{ allowed: boolean, consumesNewQuota: boolean, currentCount: number, limit: number, reason?: string }>}
   */
  static async evaluateIncomingMessage(phoneNumber) {
    if (NeonService.isAvailable()) {
      try {
        const evalResult = await NeonService.evaluateConversationWindow(phoneNumber, config.conversationLimit);
        // Mantener SQLite sincronizado como réplica local
        this._syncLocalSqliteWindow(phoneNumber, evalResult);
        return evalResult;
      } catch (err) {
        console.warn('Neon error in evaluateConversationWindow, fallback to SQLite:', err.message);
      }
    }

    return this._evaluateSqliteWindow(phoneNumber);
  }

  static _syncLocalSqliteWindow(phoneNumber, evalResult) {
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const currentMonth = this.getCurrentYearMonth();
      if (evalResult.consumesNewQuota && evalResult.activeWindowExpiresAt) {
        db.prepare(`
          INSERT INTO conversations (phone_number, window_started_at, window_expires_at, year_month, status)
          VALUES (?, ?, ?, ?, 'active')
        `).run(phoneNumber, nowIso, evalResult.activeWindowExpiresAt, currentMonth);
      }
    } catch (e) {}
  }

  static _evaluateSqliteWindow(phoneNumber) {
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
      return {
        allowed: true,
        consumesNewQuota: false,
        activeWindowExpiresAt: activeWindow.window_expires_at,
        currentCount: this._getSqliteMonthlyUsage(currentMonth),
        limit: config.conversationLimit
      };
    }

    // 2. Si no tiene ventana activa
    const currentUsage = this._getSqliteMonthlyUsage(currentMonth);

    // 3. KILL-SWITCH ANTI-COBRO
    if (currentUsage >= config.conversationLimit) {
      try {
        db.prepare(`
          INSERT INTO audit_logs (event, details, timestamp)
          VALUES ('KILL_SWITCH_TRIGGERED', ?, ?)
        `).run(
          JSON.stringify({ phoneNumber, currentUsage, limit: config.conversationLimit }),
          nowIso
        );
      } catch (e) {}

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
    db.prepare(`
      INSERT INTO conversations (phone_number, window_started_at, window_expires_at, year_month, status)
      VALUES (?, ?, ?, ?, 'active')
    `).run(phoneNumber, nowIso, expiresAt, currentMonth);

    return {
      allowed: true,
      consumesNewQuota: true,
      currentCount: currentUsage + 1,
      limit: config.conversationLimit,
      activeWindowExpiresAt: expiresAt
    };
  }

  static _getSqliteMonthlyUsage(yearMonth) {
    const stmt = db.prepare('SELECT COUNT(*) as total FROM conversations WHERE year_month = ?');
    const result = stmt.get(yearMonth);
    return result ? result.total : 0;
  }

  /**
   * Obtiene la cantidad de conversaciones consumidas en el mes
   */
  static async getMonthlyUsage(yearMonth = this.getCurrentYearMonth()) {
    if (NeonService.isAvailable()) {
      try {
        return await NeonService.getMonthlyUsage(yearMonth);
      } catch (e) {}
    }
    return this._getSqliteMonthlyUsage(yearMonth);
  }

  /**
   * Métricas en tiempo real para el Dashboard de Telemetría
   */
  static async getTelemetryMetrics() {
    if (NeonService.isAvailable()) {
      try {
        return await NeonService.getTelemetryMetrics(config.conversationLimit);
      } catch (err) {
        console.warn('Neon error in getTelemetryMetrics, fallback to SQLite:', err.message);
      }
    }

    const currentMonth = this.getCurrentYearMonth();
    const used = this._getSqliteMonthlyUsage(currentMonth);
    const limit = config.conversationLimit;
    const remaining = Math.max(0, limit - used);
    const percentage = Math.min(100, Math.round((used / limit) * 100));

    let riskLevel = 'safe';
    if (percentage >= 95) riskLevel = 'blocked';
    else if (percentage >= 80) riskLevel = 'warning';

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
