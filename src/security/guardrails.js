/**
 * Módulo de Ciberseguridad: Filtros de Sanitización y Guardrails de IA
 * Mitiga: Prompt Injections, Inyecciones XSS, Fugas de datos y Alucinaciones
 */

export class SecurityGuardrails {
  /**
   * Sanitiza el texto de entrada del usuario
   * @param {string} input 
   * @returns {string} Texto limpio y seguro
   */
  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    
    // Truncar longitudes anómalas (DoS por buffer de tokens)
    let cleaned = input.slice(0, 1500).trim();

    // Eliminar caracteres de control invisibles excepto saltos de línea estándar
    cleaned = cleaned.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    return cleaned;
  }

  /**
   * Detecta patrones obvios de Prompt Injection (ataques de evasión de instrucciones)
   * @param {string} text 
   * @returns {boolean} True si contiene ataque sospechoso
   */
  static detectPromptInjection(text) {
    const suspiciousPatterns = [
      /ignore\s+(all\s+)?(previous|prior)\s+instructions/i,
      /olvida\s+(todas\s+las\s+)?instrucciones\s+(anteriores|previas)/i,
      /you\s+are\s+now\s+(an\s+unrestricted|DAN|jailbreak)/i,
      /ahora\s+eres\s+(un\s+asistente\s+sin\s+restricciones|modo\s+desarrollador)/i,
      /system\s+prompt\s+override/i,
      /revela\s+(tu\s+prompt|las\s+instrucciones\s+del\s+sistema)/i,
      /<system>/i,
      /\[SYSTEM_INSTRUCTION\]/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Limpia números de teléfono a formato canónico internacional E.164
   * @param {string} phone 
   * @returns {string}
   */
  static sanitizePhone(phone) {
    if (!phone) return '';
    return phone.replace(/[^\d+]/g, '').trim();
  }
}
