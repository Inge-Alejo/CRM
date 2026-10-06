import { config } from '../config.js';
import { verifyMetaSignature } from '../security/signature.js';
import { ConversationTracker } from '../domain/conversationTracker.js';
import { GeminiService } from '../ai/geminiService.js';
import { LeadService } from '../domain/leadService.js';
import { AdvisorNotifier } from '../domain/notifier.js';

export class MetaCloudAdapter {
  /**
   * Manejador del GET /webhook para la verificación inicial de Meta
   */
  static handleVerification(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.meta.verifyToken) {
      console.log('✅ Webhook verificado exitosamente por Meta Developers.');
      return res.status(200).send(challenge);
    }

    console.warn('❌ Fallo en verificación de token de Meta Webhook');
    return res.status(403).json({ error: 'Token de verificación inválido' });
  }

  /**
   * Manejador del POST /webhook para mensajes entrantes de WhatsApp
   */
  static async handleIncomingMessage(req, res) {
    // 1. Verificación de firma criptográfica
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const signature = req.headers['x-hub-signature-256'];
    const sigCheck = verifyMetaSignature(rawBody, signature);

    if (!sigCheck.valid) {
      console.error('🚨 Intento de falsificación de Webhook:', sigCheck.error);
      return res.status(401).json({ error: 'Firma HMAC inválida' });
    }

    // Responder 200 OK inmediatamente a Meta (obligatorio según sus directrices dentro de 3 segundos)
    res.status(200).send('EVENT_RECEIVED');

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    try {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (!message) return;

      const senderPhone = message.from; // Número en formato E.164 (ej: 573001234567)

      // Bloqueo de audios, imágenes y videos: Canal exclusivo de texto escrito
      if (message.type !== 'text') {
        const textOnlyNotice = 'Estimado(a) usuario(a), por directrices institucionales de la Facultad de Medicina UdeA, este canal automatizado de WhatsApp procesa exclusivamente consultas en texto escrito. 📝🩺\n\nPor favor envíanos tu consulta en un mensaje de texto para poder orientarte de inmediato con fechas, horarios y costos.';
        await LeadService.recordLeadMessage(senderPhone, `[Mensaje no admitido: ${message.type}]`, 'user');
        await LeadService.recordLeadMessage(senderPhone, textOnlyNotice, 'bot');
        await this.sendWhatsAppMessage(senderPhone, textOnlyNotice);
        return;
      }

      const userText = message.text.body;

      // 2. Evaluar Kill-Switch y ventana de 24 horas (Control Anti-Cobros)
      const evaluation = await ConversationTracker.evaluateIncomingMessage(senderPhone);

      // Guardar mensaje en base de datos
      await LeadService.recordLeadMessage(senderPhone, userText, 'user');

      if (!evaluation.allowed) {
        console.warn(`🛑 [KILL-SWITCH ACTIVADO] Mensaje de ${senderPhone} no respondido para evitar cobros de Meta.`);
        await LeadService.updateLeadStatus(senderPhone, 'advisor_requested', null, 'Límite mensual alcanzado');
        return;
      }

      // 3. Obtener historial y generar respuesta con IA
      const history = await LeadService.getLeadConversation(senderPhone);
      const aiResult = await GeminiService.generateReply(userText, senderPhone, history);

      // Guardar respuesta del bot
      await LeadService.recordLeadMessage(senderPhone, aiResult.replyText, 'bot');

      // 4. Si el estudiante solicita asesor, disparar notificación
      if (aiResult.requestAdvisor) {
        await LeadService.updateLeadStatus(senderPhone, 'advisor_requested', aiResult.detectedProgram);
        await AdvisorNotifier.triggerAdvisorAlert({
          phoneNumber: senderPhone,
          reason: 'Solicitud explícita de asesor o caso especial',
          lastUserMessage: userText
        });
      } else if (aiResult.detectedProgram) {
        await LeadService.updateLeadStatus(senderPhone, 'ai_handling', aiResult.detectedProgram);
      }

      // 5. Enviar mensaje de vuelta a WhatsApp mediante Meta Graph API
      await this.sendWhatsAppMessage(senderPhone, aiResult.replyText);

    } catch (err) {
      console.error('Error procesando webhook de WhatsApp:', err);
    }
  }

  /**
   * Envía un mensaje de texto saliente por WhatsApp Cloud API
   */
  static async sendWhatsAppMessage(recipientPhone, messageText) {
    if (!config.meta.phoneNumberId || !config.meta.accessToken) {
      console.log(`[SIMULACIÓN META API] Mensaje para ${recipientPhone}: "${messageText.slice(0, 50)}..."`);
      return;
    }

    const url = `https://graph.facebook.com/v21.0/${config.meta.phoneNumberId}/messages`;
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhone,
      type: 'text',
      text: { preview_url: false, body: messageText }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error enviando mensaje por Meta Graph API:', errorData);
    }
  }
}
