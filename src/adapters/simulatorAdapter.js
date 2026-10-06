import { ConversationTracker } from '../domain/conversationTracker.js';
import { GeminiService } from '../ai/geminiService.js';
import { LeadService } from '../domain/leadService.js';
import { AdvisorNotifier } from '../domain/notifier.js';
import { SecurityGuardrails } from '../security/guardrails.js';

export class SimulatorAdapter {
  /**
   * Simula el flujo completo de WhatsApp desde el Sandbox del CRM
   */
  static async simulateMessage(phoneNumber, messageText) {
    const cleanPhone = SecurityGuardrails.sanitizePhone(phoneNumber) || '+573001234567';
    const cleanMessage = SecurityGuardrails.sanitizeInput(messageText);

    if (!cleanMessage) {
      return { error: 'El mensaje no puede estar vacío.' };
    }

    // 1. Evaluar Kill-Switch y ventana de 24 horas
    const evaluation = ConversationTracker.evaluateIncomingMessage(cleanPhone);

    // 2. Registrar mensaje del usuario en la base de datos
    LeadService.recordLeadMessage(cleanPhone, cleanMessage, 'user');

    // Si el Kill Switch se activa
    if (!evaluation.allowed) {
      LeadService.updateLeadStatus(cleanPhone, 'advisor_requested', null, 'Límite mensual alcanzado');
      return {
        blocked: true,
        replyText: '🛑 [ALERTA DE SEGURIDAD]: El Kill-Switch Anti-Cobros se activó porque se alcanzó el límite mensual seguro de conversaciones. No se emitió respuesta saliente para proteger tu cuenta de cobros.',
        evaluation,
        metrics: ConversationTracker.getTelemetryMetrics()
      };
    }

    // 3. Obtener historial y procesar con la IA
    const history = LeadService.getLeadConversation(cleanPhone);
    const aiResult = await GeminiService.generateReply(cleanMessage, cleanPhone, history);

    // 4. Guardar respuesta del bot
    LeadService.recordLeadMessage(cleanPhone, aiResult.replyText, 'bot');

    // 5. Manejo de asesor
    let advisorAlert = null;
    if (aiResult.requestAdvisor) {
      LeadService.updateLeadStatus(cleanPhone, 'advisor_requested', aiResult.detectedProgram);
      advisorAlert = await AdvisorNotifier.triggerAdvisorAlert({
        phoneNumber: cleanPhone,
        reason: 'Solicitó asesor en el simulador',
        lastUserMessage: cleanMessage
      });
    } else if (aiResult.detectedProgram) {
      LeadService.updateLeadStatus(cleanPhone, 'ai_handling', aiResult.detectedProgram);
    }

    const metrics = ConversationTracker.getTelemetryMetrics();
    const messages = LeadService.getLeadConversation(cleanPhone);
    const leadData = LeadService.getLeadByPhone(cleanPhone);

    return {
      success: true,
      senderPhone: cleanPhone,
      userMessage: cleanMessage,
      replyText: aiResult.replyText,
      evaluation,
      requestAdvisor: aiResult.requestAdvisor,
      advisorAlert,
      metrics,
      leadData,
      messages,
      segmentation: aiResult.segmentation
    };
  }
}
