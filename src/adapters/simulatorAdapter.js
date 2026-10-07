import { ConversationTracker } from '../domain/conversationTracker.js';
import { GeminiService } from '../ai/geminiService.js';
import { LeadService } from '../domain/leadService.js';
import { AdvisorNotifier } from '../domain/notifier.js';
import { SecurityGuardrails } from '../security/guardrails.js';

export class SimulatorAdapter {
  /**
   * Inicializa o reinicia la conversación de prueba en el simulador con un saludo autónomo de la IA
   */
  static async initConversation(phoneNumber, reset = false) {
    const cleanPhone = SecurityGuardrails.sanitizePhone(phoneNumber) || '+573001234567';

    if (reset) {
      await LeadService.clearLeadConversation(cleanPhone);
    }

    let history = await LeadService.getLeadConversation(cleanPhone);
    let leadData = (await LeadService.getLeadByPhone(cleanPhone)) || {};

    // Si el chat está vacío o se pidió reinicio explícito, la IA genera su saludo autónomo inicial
    if (reset || !history || history.length === 0) {
      const greetingText = await GeminiService.generateInitialGreeting(leadData);
      
      // Registrar en la base de datos como mensaje oficial del bot
      await LeadService.recordLeadMessage(cleanPhone, greetingText, 'bot');
      await LeadService.updateLeadStatus(cleanPhone, 'ai_handling');

      history = await LeadService.getLeadConversation(cleanPhone);
      leadData = (await LeadService.getLeadByPhone(cleanPhone)) || {};

      return {
        success: true,
        isNew: true,
        senderPhone: cleanPhone,
        replyText: greetingText,
        messages: history,
        leadData
      };
    }

    // Si ya tenía historial y no es reinicio, reactivar el modo IA para la prueba
    await LeadService.updateLeadStatus(cleanPhone, 'ai_handling');
    leadData = (await LeadService.getLeadByPhone(cleanPhone)) || {};

    return {
      success: true,
      isNew: false,
      senderPhone: cleanPhone,
      messages: history,
      leadData
    };
  }

  /**
   * Simula el flujo completo de WhatsApp desde el Sandbox del CRM
   * Garantiza que la IA siempre responda de forma autónoma a cualquier prueba
   */
  static async simulateMessage(phoneNumber, messageText) {
    const cleanPhone = SecurityGuardrails.sanitizePhone(phoneNumber) || '+573001234567';
    let cleanMessage = SecurityGuardrails.sanitizeInput(messageText);

    // Si el mensaje viene vacío o con solo espacios, tratar como saludo inicial para no fallar
    if (!cleanMessage || cleanMessage.trim() === '') {
      cleanMessage = 'Hola';
    }

    // 1. Evaluar telemetría de cuotas (informativo para el simulador)
    const evaluation = await ConversationTracker.evaluateIncomingMessage(cleanPhone);

    // 2. En el simulador (Sandbox de pruebas), siempre reactivar el modo IA
    await LeadService.updateLeadStatus(cleanPhone, 'ai_handling');

    // 3. Registrar mensaje del usuario en la base de datos
    await LeadService.recordLeadMessage(cleanPhone, cleanMessage, 'user');

    // 4. Obtener historial conversacional actualizado
    const history = await LeadService.getLeadConversation(cleanPhone);

    // 5. Procesar con la IA de Google Gemini (o contingencia local inteligente)
    let aiResult;
    try {
      aiResult = await GeminiService.generateReply(cleanMessage, cleanPhone, history);
    } catch (err) {
      console.warn('⚠️ Error en GeminiService dentro del simulador, activando contingencia:', err.message);
      const lead = (await LeadService.getLeadByPhone(cleanPhone)) || {};
      aiResult = await GeminiService.localKnowledgeEngine(cleanMessage, history, lead);
    }

    // Garantizar que nunca quede una respuesta vacía
    if (!aiResult || !aiResult.replyText || aiResult.replyText.trim() === '') {
      aiResult = {
        replyText: '¡Hola! 👋 Con gusto te oriento sobre nuestra oferta de cursos y diplomados en salud de la Facultad de Medicina UdeA. 🩺 ¿Sobre qué temática o programa te gustaría conocer fechas oficiales e inversión?',
        detectedProgram: null,
        requestAdvisor: false,
        segmentation: { interest_temperature: 'warm', thematic_area: 'General' }
      };
    }

    // 6. Guardar respuesta del bot en la base de datos
    await LeadService.recordLeadMessage(cleanPhone, aiResult.replyText, 'bot');

    // 7. Manejo de escalamiento a asesor humano si el usuario lo solicitó explícitamente
    let advisorAlert = null;
    if (aiResult.requestAdvisor) {
      await LeadService.updateLeadStatus(cleanPhone, 'advisor_requested', aiResult.detectedProgram);
      advisorAlert = await AdvisorNotifier.triggerAdvisorAlert({
        phoneNumber: cleanPhone,
        reason: 'Solicitó asesor en el simulador',
        lastUserMessage: cleanMessage
      });
    } else {
      // Mantener en ai_handling
      await LeadService.updateLeadStatus(cleanPhone, 'ai_handling', aiResult.detectedProgram);
    }

    const metrics = await ConversationTracker.getTelemetryMetrics();
    const messages = await LeadService.getLeadConversation(cleanPhone);
    const leadData = await LeadService.getLeadByPhone(cleanPhone);

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
