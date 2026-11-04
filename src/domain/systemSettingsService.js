import { NeonService } from '../db/neonService.js';
import { isGlobalAiEnabledDb, setGlobalAiStatusDb, recordSecurityAudit } from '../db/database.js';
import { RealtimeService } from './realtimeService.js';

let cachedGlobalAiStatus = null;
let lastLoadedTime = 0;
const CACHE_TTL_MS = 10000; // 10 segundos de TTL para caché en memoria

export class SystemSettingsService {
  /**
   * Consulta si la IA está activa globalmente en todo el CRM
   * @returns {Promise<boolean>}
   */
  static async isGlobalAiEnabled() {
    const now = Date.now();
    if (cachedGlobalAiStatus !== null && (now - lastLoadedTime) < CACHE_TTL_MS) {
      return cachedGlobalAiStatus;
    }

    let enabled = true;
    if (NeonService.isAvailable()) {
      try {
        enabled = await NeonService.isGlobalAiEnabled();
      } catch (err) {
        console.warn('Falla consultando global AI en Neon, usando fallback:', err.message);
        enabled = isGlobalAiEnabledDb();
      }
    } else {
      enabled = isGlobalAiEnabledDb();
    }

    cachedGlobalAiStatus = enabled;
    lastLoadedTime = now;
    return enabled;
  }

  /**
   * Obtiene detalles completos del estado global de la IA
   */
  static async getGlobalAiDetails() {
    const enabled = await this.isGlobalAiEnabled();
    let updatedBy = 'system';
    let updatedAt = new Date().toISOString();

    if (NeonService.isAvailable()) {
      try {
        const val = await NeonService.getSystemSetting('global_ai_enabled', 'true');
        // Consultar timestamp y autor si está disponible
        const sql = NeonService.getSql ? NeonService.getSql() : null;
        if (sql) {
          const rows = await sql`SELECT updated_at, updated_by FROM system_settings WHERE setting_key = 'global_ai_enabled' LIMIT 1;`;
          if (rows.length > 0) {
            updatedAt = rows[0].updated_at;
            updatedBy = rows[0].updated_by || 'system';
          }
        }
      } catch (e) {}
    }

    return {
      enabled,
      updated_at: updatedAt,
      updated_by: updatedBy
    };
  }

  /**
   * Cambia el estado global de la IA (Exclusivo Superadmin TIC)
   * @param {boolean} enabled 
   * @param {string} adminEmail 
   */
  static async setGlobalAiStatus(enabled, adminEmail = 'proyectostic.med@udea.edu.co') {
    const boolVal = !!enabled;
    cachedGlobalAiStatus = boolVal;
    lastLoadedTime = Date.now();

    // 1. Guardar en Neon Cloud
    if (NeonService.isAvailable()) {
      try {
        await NeonService.setGlobalAiStatus(boolVal, adminEmail);
      } catch (err) {
        console.warn('Error guardando estado global IA en Neon:', err.message);
      }
    }

    // 2. Guardar en SQLite local
    setGlobalAiStatusDb(boolVal, adminEmail);

    // 3. Registrar auditoría institucional
    recordSecurityAudit('GLOBAL_AI_TOGGLED', {
      enabled: boolVal,
      adminEmail,
      timestamp: new Date().toISOString()
    });

    // 4. Notificar a todos los asesores conectados en tiempo real vía SSE
    const details = {
      enabled: boolVal,
      updated_by: adminEmail,
      timestamp: new Date().toISOString()
    };
    RealtimeService.notifyGlobalAiStatus(details);

    console.log(`🛡️ [CONTROL MAESTRO IA]: IA Global ${boolVal ? 'REACTIVADA' : 'PAUSADA'} por ${adminEmail}`);
    return details;
  }
}

