/**
 * MOTOR DE SEGMENTACIÓN Y PERFILAMIENTO EN TIEMPO REAL
 * Clasifica automáticamente a las personas que interactúan por WhatsApp:
 * 1. Perfil Profesional (Especialista, Médico General, Enfermería, Estudiante, etc.)
 * 2. Nivel de Intención / Temperatura (Caliente, Tibio, Frío)
 * 3. Área Temática Médica
 * 4. Historial de Eventos de Interés
 */
export class SegmentationEngine {
  /**
   * Analiza un mensaje entrante y retorna la segmentación actualizada
   */
  static analyzeLead(userMessage, currentLead = {}) {
    const rawText = userMessage || '';
    const text = rawText.toLowerCase();
    
    const profession = this.detectProfession(text, currentLead.segment_profession);
    const temperature = this.calculateTemperature(text, currentLead.interest_temperature);
    const eventInterests = this.updateEventInterests(currentLead.event_interests, currentLead.program_interest);
    const thematicArea = this.detectThematicArea(currentLead.program_interest || text);
    const identity = this.extractIdentity(rawText, currentLead);

    return {
      name: identity.name,
      doc_type: identity.doc_type,
      doc_number: identity.doc_number,
      email: identity.email,
      segment_profession: profession,
      interest_temperature: temperature,
      thematic_area: thematicArea,
      event_interests: eventInterests
    };
  }

  /**
   * Extrae nombre, tipo de documento, número de documento y correo del mensaje
   */
  static extractIdentity(rawText, currentLead = {}) {
    let name = currentLead.name || 'Interesado UdeA';
    let doc_type = currentLead.doc_type || 'CC';
    let doc_number = currentLead.doc_number || '';
    let email = currentLead.email || '';

    // 1. Correo Electrónico
    const emailMatch = rawText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
      email = emailMatch[0].trim().toLowerCase();
    }

    // 2. Tipo de Documento
    if (/c[eé]dula de extranjer[ií]a|\bce\b/i.test(rawText)) {
      doc_type = 'CE';
    } else if (/pasaporte|\bpp\b/i.test(rawText)) {
      doc_type = 'Pasaporte';
    } else if (/tarjeta de identidad|\bti\b/i.test(rawText)) {
      doc_type = 'TI';
    } else if (/c[eé]dula|\bcc\b/i.test(rawText)) {
      doc_type = 'CC';
    }

    // 3. Número de Documento (secuencias de 6 a 11 dígitos que no sean el teléfono de 12+)
    const docRegex = /(?:c[eé]dula|cc|ce|doc(?:umento)?|identificaci[oó]n|n[uú]mero|ti|pasaporte)?[:\s#]*\b(\d{6,10})\b/i;
    const docMatch = rawText.match(docRegex);
    if (docMatch && docMatch[1]) {
      // Verificar que no sea un número de teléfono celular colombiano (que suele empezar por 3 y tener 10 dígitos) a menos que esté precedido explícitamente por palabra clave de documento
      const val = docMatch[1];
      const isExplicitDoc = /(?:c[eé]dula|cc|ce|doc|identificaci[oó]n|ti|pasaporte)/i.test(rawText);
      if (isExplicitDoc || (!val.startsWith('30') && !val.startsWith('31') && !val.startsWith('32') && !val.startsWith('35'))) {
        doc_number = val;
      }
    }

    // 4. Nombre
    const nameRegex = /(?:me llamo|mi nombre es|soy(?: el| la)? (?:dr\.|dra\.|doctor|doctora)?)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){1,3})/i;
    const nameMatch = rawText.match(nameRegex);
    if (nameMatch && nameMatch[1]) {
      const candidate = nameMatch[1].trim();
      if (!/m[eé]dic|enfermer|estudiante|especialista/i.test(candidate)) {
        name = candidate;
      }
    }

    return { name, doc_type, doc_number, email };
  }

  /**
   * Detecta la profesión o rol en el sector salud
   */
  static detectProfession(text, existingProfession) {
    if (existingProfession && existingProfession !== 'Por Definir') {
      // Si ya tiene un perfil específico, solo actualizar si el mensaje declara explícitamente otro
      const specificRegex = /(?:soy|trabajo como|ejerzo como)\s+(m[eé]dic[ao]\s+especialista|m[eé]dic[ao]\s+general|enfermer[ao]|residente|estudiante)/i;
      const match = text.match(specificRegex);
      if (!match) return existingProfession;
    }

    // Médico Especialista
    if (
      /pediatra|gineco|cardi[oó]log|neur[oó]log|anestesi|dermat[oó]log|cirujan|ortoped|psiquiatra|radi[oó]log|intensivista|neum[oó]log|oftalm[oó]log|onc[oó]log|urol[oó]g|especialista/i.test(text)
    ) {
      return 'Médico Especialista';
    }

    // Residente
    if (/residente|r1|r2|r3|r4|posgrado de/i.test(text)) {
      return 'Residente Médico';
    }

    // Médico General / Rural
    if (/m[eé]dic[ao]\s+general|medicina\s+general|rural|sso|servicio\s+social|m[eé]dic[ao]\s+de\s+urgencias|m[eé]dic[ao]\s+ambulatorio/i.test(text)) {
      return 'Médico General';
    }

    // Enfermería
    if (/enfermer[ao]|jefe\s+de\s+enfermer[ií]a|auxiliar\s+de\s+enfermer[ií]a/i.test(text)) {
      return 'Enfermería Profesional';
    }

    // Estudiante de Medicina / Pregrado
    if (/estudiante|pregrado|interno|internado|semestre|estudio\s+medicina|facultad\s+de\s+medicina/i.test(text)) {
      return 'Estudiante de Medicina';
    }

    // Instrumentación Quirúrgica
    if (/instrumentador[ao]|instrumentaci[oó]n|quir[oó]fano|central\s+de\s+esteriliz/i.test(text)) {
      return 'Instrumentador Quirúrgico';
    }

    // Otras profesiones de la salud
    if (/fisioterapeuta|terapeuta|bacteri[oó]log[ao]|psic[oó]log[ao]|odont[oó]log[ao]|nutricionista/i.test(text)) {
      return 'Profesional de la Salud';
    }

    // Mención genérica de "médico"
    if (/\bm[eé]dic[ao]\b/i.test(text)) {
      return 'Médico General';
    }

    return existingProfession || 'Por Definir';
  }

  /**
   * Calcula la temperatura del prospecto según señales de compra y avance en el embudo
   */
  static calculateTemperature(text, currentTemp = 'cold') {
    // 1. Alta intención (HOT 🔥): Preguntas de pago, matrícula, inscripción inmediata o pedir asesor
    const hotKeywords = [
      'pago', 'pagar', 'cuanto vale', 'cuánto vale', 'precio', 'costo', 
      'inversión', 'inversion', 'matrícula', 'matricula', 'inscribirme', 
      'link de pago', 'enlace de pago', 'cuenta', 'consignar', 'descuento', 
      'asesor', 'humano', 'separar cupo', 'inscripción', 'inscripcion'
    ];
    if (hotKeywords.some(k => text.includes(k))) {
      return 'hot';
    }

    // 2. Intención media (WARM ⚡): Preguntas por fechas, horarios, pensum, modalidad o certificación
    const warmKeywords = [
      'fecha', 'cuándo inicia', 'cuando inicia', 'cuándo empieza', 'cuando empieza',
      'horario', 'días', 'dias', 'duración', 'duracion', 'horas', 
      'temario', 'pensum', 'módulos', 'modulos', 'contenido', 
      'modalidad', 'virtual', 'presencial', 'requisitos', 'certificación', 'certificado'
    ];
    if (warmKeywords.some(k => text.includes(k))) {
      // Si ya era caliente, mantenerlo caliente
      return currentTemp === 'hot' ? 'hot' : 'warm';
    }

    return currentTemp || 'cold';
  }

  /**
   * Mapea el programa o mensaje al área temática de la Facultad
   */
  static detectThematicArea(programOrText = '') {
    const t = (programOrText || '').toLowerCase();

    if (/acls|soporte vital|bls|simulaci[oó]n|reanimaci[oó]n|aha/i.test(t)) {
      return 'Simulación & ACLS';
    }
    if (/sueño|sueno|polisomno|apnea|insomnio/i.test(t)) {
      return 'Medicina del Sueño';
    }
    if (/parto|materno|perinatal|ginec|c[oó]digo rojo|obstetr/i.test(t)) {
      return 'Salud Materno-Perinatal';
    }
    if ([/omica/, /gen[oó]m/, /bioinform/, /precisi[oó]n/].some(rx => rx.test(t))) {
      return 'Ciencias Ómicas & Genómica';
    }
    if (/urgencia|trauma|artroscopia|ortopedia|neurocirug[ií]a|anestesia/i.test(t)) {
      return 'Urgencias & Quirúrgica';
    }
    if (/c[oó]digo fucsia|violencia|ataques|acidos/i.test(t)) {
      return 'Salud Pública & Legal';
    }
    if (/esteriliz|reproceso|bioseguridad|calidad/i.test(t)) {
      return 'Gestión & Esterilización';
    }
    if (/yoga|china|acupuntura|complementar/i.test(t)) {
      return 'Medicina Integrativa';
    }
    if (/power bi|powerbi|datos|anal[ií]tica/i.test(t)) {
      return 'Analítica en Salud';
    }

    return 'Educación Médica General';
  }

  /**
   * Agrega el programa detectado a la lista de eventos consultados por la persona
   */
  static updateEventInterests(existingList = '', newProgram = null) {
    const events = (existingList || '')
      .split(',')
      .map(e => e.trim())
      .filter(Boolean);

    if (newProgram && newProgram !== 'Por definir' && !events.includes(newProgram)) {
      events.push(newProgram);
    }

    return events.join(', ');
  }
}
