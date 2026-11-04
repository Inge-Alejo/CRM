// ==========================================================================
// REALTIME SYNCHRONIZATION ENGINE & EVENT BUS (UDEA MEDICINA CRM)
// Protocolo: Server-Sent Events (SSE) de Baja Latencia (< 200 ms)
// Soporta: Multiusuario Concurrente, Presencia de Asesores, Concurrencia Optimista
// ==========================================================================

import { NeonService } from '../db/neonService.js';

export class RealtimeService {
  static clients = new Map(); // id -> { res, advisor, connectedAt, lastPing }
  static pingInterval = null;

  /**
   * Inicializa el envío periódico de keep-alive / ping cada 15 segundos
   */
  static initHeartbeat() {
    if (this.pingInterval) return;
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients.entries()) {
        try {
          client.res.write(`: ping ${now}\n\n`);
          client.lastPing = now;
        } catch (err) {
          this.removeClient(clientId);
        }
      }
    }, 15000);

    if (this.pingInterval.unref) {
      this.pingInterval.unref();
    }
  }

  /**
   * Conecta un nuevo cliente SSE
   */
  static handleSseConnection(req, res, advisor) {
    this.initHeartbeat();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*'
    });
    res.flushHeaders?.();

    // Expulsar cualquier conexión SSE anterior del mismo asesor (Garantía de Sesión Única)
    if (advisor && advisor.email) {
      this.terminateUserSessions(advisor.email, 'Se ha iniciado una nueva sesión con tu cuenta desde otro dispositivo o pestaña.');
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const clientData = {
      id: clientId,
      res,
      advisor: advisor || { id: 0, name: 'Asesor UdeA', email: 'anon@udea.edu.co' },
      connectedAt: Date.now(),
      lastPing: Date.now()
    };

    this.clients.set(clientId, clientData);

    // Actualizar presencia del asesor en Neon
    if (advisor && advisor.email) {
      this.updatePresence(advisor.email, 'online').catch(() => {});
    }

    // Enviar evento de bienvenida y lista actual de asesores activos
    const activeAdvisors = this.getActiveAdvisorsList();
    this.sendToClient(res, 'connected', {
      clientId,
      serverTime: new Date().toISOString(),
      activeAdvisors,
      connectedClientsCount: this.clients.size
    });

    // Notificar a todos los demás sobre la nueva conexión de este asesor
    this.broadcast('advisor:presence', {
      advisor: clientData.advisor,
      presence_status: 'online',
      activeAdvisors
    }, clientId);

    // Limpieza al desconectarse
    req.on('close', () => {
      this.removeClient(clientId);
    });

    req.on('error', () => {
      this.removeClient(clientId);
    });

    console.log(`📡 [REALTIME SSE]: Cliente conectado (${clientData.advisor.name}) - Total activos: ${this.clients.size}`);
  }

  /**
   * Remueve un cliente desconectado
   */
  static removeClient(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);
    try {
      client.res.end();
    } catch (e) {}

    // Si este asesor no tiene otras pestañas/conexiones abiertas, marcar offline
    const hasOtherSessions = Array.from(this.clients.values()).some(
      c => c.advisor.email && c.advisor.email.toLowerCase() === client.advisor.email?.toLowerCase()
    );

    if (!hasOtherSessions && client.advisor.email) {
      this.updatePresence(client.advisor.email, 'offline').catch(() => {});
    }

    const activeAdvisors = this.getActiveAdvisorsList();
    this.broadcast('advisor:presence', {
      advisor: client.advisor,
      presence_status: hasOtherSessions ? 'online' : 'offline',
      activeAdvisors
    });

    console.log(`🔌 [REALTIME SSE]: Cliente desconectado (${client.advisor.name}) - Restantes: ${this.clients.size}`);
  }

  /**
   * Termina y expulsa cualquier sesión SSE activa previa del mismo usuario (Sesión Única Activa)
   * @param {string} email Correo del asesor
   * @param {string} message Motivo de la desconexión
   */
  static terminateUserSessions(email, message = 'Tu sesión ha sido cerrada porque se inició sesión en otro dispositivo o ventana.') {
    if (!email) return;
    const emailLower = email.toLowerCase();
    for (const [clientId, client] of this.clients.entries()) {
      if (client.advisor && client.advisor.email?.toLowerCase() === emailLower) {
        this.sendToClient(client.res, 'session:terminated', {
          reason: 'concurrent_session',
          message,
          timestamp: new Date().toISOString()
        });
        try {
          client.res.end();
        } catch (e) {}
        this.clients.delete(clientId);
        console.log(`🛑 [SESIÓN EXPULSADA]: Conexión anterior (${clientId}) de ${email} cerrada por inicio de sesión concurrente.`);
      }
    }
  }

  /**
   * Envía un evento a un cliente específico
   */
  static sendToClient(res, eventName, data) {
    try {
      const payload = JSON.stringify({ ...data, _ts: Date.now() });
      res.write(`event: ${eventName}\ndata: ${payload}\n\n`);
    } catch (err) {
      console.warn('Error enviando SSE a cliente:', err.message);
    }
  }

  /**
   * Difunde un evento a TODOS los clientes conectados
   * @param {string} eventName Nombre del evento (ej: 'lead:updated', 'message:received')
   * @param {object} data Datos asociados al evento
   * @param {string} excludeClientId ID de cliente que originó la acción (opcional)
   * @returns {number} Tiempo en milisegundos que tomó la propagación
   */
  static broadcast(eventName, data, excludeClientId = null) {
    const startTime = Date.now();
    const payloadStr = JSON.stringify({
      ...data,
      _event: eventName,
      _dispatchedAt: startTime
    });
    const message = `event: ${eventName}\ndata: ${payloadStr}\n\n`;

    let delivered = 0;
    for (const [clientId, client] of this.clients.entries()) {
      if (excludeClientId && clientId === excludeClientId) continue;
      try {
        client.res.write(message);
        delivered++;
      } catch (err) {
        this.removeClient(clientId);
      }
    }

    const elapsedMs = Date.now() - startTime;
    if (delivered > 0 && eventName !== 'ping') {
      console.log(`⚡ [REALTIME BROADCAST]: '${eventName}' propagado a ${delivered} asesores en ${elapsedMs} ms`);
    }

    return elapsedMs;
  }

  // ==========================================
  // DISPATCHERS DE ALTO NIVEL PARA EL CRM
  // ==========================================

  /**
   * Notifica actualización en un lead (estado, asignación, notas, temperatura)
   */
  static notifyLeadUpdate(lead, action = 'update', advisorName = null) {
    return this.broadcast('lead:updated', {
      phone: lead.phone_number,
      lead,
      action,
      changeType: action,
      advisorName,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifica un nuevo mensaje (entrante de usuario o saliente de asesor/bot)
   */
  static notifyNewMessage(phone, messageData) {
    return this.broadcast('message:received', {
      phone,
      message: messageData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifica cambio en respuestas rápidas (macro creado/editado/eliminado)
   */
  static notifyCannedUpdate(action, macro) {
    return this.broadcast('canned:updated', {
      action,
      macro,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifica una alerta institucional (conversación > 12h sin respuesta o solicitud de asesor)
   */
  static notifyAlert(alertData) {
    return this.broadcast('alert:triggered', {
      alert: alertData,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Notifica cambio en el estado global de la Inteligencia Artificial (Kill-Switch TIC)
   */
  static notifyGlobalAiStatus(data) {
    return this.broadcast('system:global_ai', {
      ...data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Actualiza el estado de presencia y chat visualizado por un asesor
   */
  static async updatePresence(email, status, viewingLead = null) {
    if (!email) return;
    try {
      if (NeonService.isAvailable()) {
        await NeonService.updateAdvisorPresence(email, status, viewingLead);
      }
    } catch (e) {}
  }

  /**
   * Retorna lista de asesores actualmente conectados y qué prospecto están atendiendo
   */
  static getActiveAdvisorsList() {
    const map = new Map();
    for (const client of this.clients.values()) {
      if (client.advisor && client.advisor.email) {
        map.set(client.advisor.email, {
          id: client.advisor.id,
          name: client.advisor.name,
          email: client.advisor.email,
          role: client.advisor.role,
          avatar: client.advisor.avatar,
          role_type: client.advisor.role_type,
          viewingLead: client.viewingLead || null,
          connectedAt: client.connectedAt
        });
      }
    }
    return Array.from(map.values());
  }

  /**
   * Asocia el chat que un asesor tiene abierto actualmente para visualización multiusuario
   */
  static setAdvisorViewing(email, phone) {
    for (const client of this.clients.values()) {
      if (client.advisor && client.advisor.email?.toLowerCase() === email?.toLowerCase()) {
        client.viewingLead = phone;
      }
    }
    this.updatePresence(email, 'online', phone).catch(() => {});

    // Difundir actualización de presencia a todos los demás asesores
    const activeAdvisors = this.getActiveAdvisorsList();
    this.broadcast('advisor:presence', {
      email,
      advisorEmail: email,
      viewingLead: phone,
      activeAdvisors
    });
  }
}
