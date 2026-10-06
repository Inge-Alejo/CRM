import { db } from '../db/database.js';

export class KnowledgeBaseService {
  /**
   * Obtiene todos los elementos de conocimiento activos
   */
  static getActiveItems() {
    const stmt = db.prepare('SELECT * FROM knowledge_items WHERE is_active = 1 ORDER BY category, title');
    return stmt.all();
  }

  /**
   * Genera el contexto formateado para el System Prompt de Gemini
   */
  static generateContextPrompt() {
    const items = this.getActiveItems();
    let prompt = `PORTAFOLIO OFICIAL DE EXTENSIÓN Y EDUCACIÓN CONTINUA - FACULTAD DE MEDICINA (UNIVERSIDAD DE ANTIOQUIA):\n\n`;

    for (const item of items) {
      prompt += `====================================================\n`;
      prompt += `CÓDIGO: ${item.code}\n`;
      prompt += `PROGRAMA: ${item.title} (${item.category})\n`;
      prompt += `FECHA DE INICIO: ${item.start_date || 'Inscripciones abiertas - Próxima cohorte Noviembre 2026'}\n`;
      prompt += `HORARIO: ${item.schedule || 'Flexible sincrónico/asincrónico'}\n`;
      prompt += `PÚBLICO OBJETIVO: ${item.target_audience || 'Profesionales de la salud y áreas afines'}\n`;
      prompt += `MODALIDAD: ${item.modality || 'Virtual'}\n`;
      prompt += `DURACIÓN: ${item.duration_hours} horas\n`;
      prompt += `INVERSIÓN: ${item.investment || 'Consultar'}\n`;
      prompt += `ENLACE DE INFORMACIÓN (EXTENSIÓN): ${item.registration_link || 'https://extension.medicinaudea.co'}\n`;
      prompt += `ENLACE DE PAGO / INSCRIPCIÓN DIRECTA: ${item.payment_link || item.registration_link || 'https://asone.udea.edu.co/portafolio/'}\n`;
      prompt += `CORREO DE CONTACTO: ${item.contact_email || 'extensionmedicina@udea.edu.co'}\n`;
      prompt += `DESCRIPCIÓN Y CONTENIDO: ${item.description}\n`;
      prompt += `====================================================\n\n`;
    }

    return prompt;
  }

  /**
   * Agrega un nuevo curso o programa al portafolio
   */
  static addItem(data) {
    const stmt = db.prepare(`
      INSERT INTO knowledge_items (
        code, title, category, target_audience, modality,
        duration_hours, investment, start_date, schedule, registration_link, payment_link, contact_email, description
      ) VALUES (
        @code, @title, @category, @target_audience, @modality,
        @duration_hours, @investment, @start_date, @schedule, @registration_link, @payment_link, @contact_email, @description
      )
    `);
    return stmt.run({
      start_date: data.start_date || 'Inicia: Noviembre 2026',
      schedule: data.schedule || 'Encuentros sincrónicos virtuales',
      payment_link: data.payment_link || 'https://asone.udea.edu.co/portafolio/',
      ...data
    });
  }

  /**
   * Actualiza un programa existente
   */
  static updateItem(id, data) {
    const stmt = db.prepare(`
      UPDATE knowledge_items
      SET title = @title, category = @category, target_audience = @target_audience,
          modality = @modality, duration_hours = @duration_hours, investment = @investment,
          start_date = @start_date, schedule = @schedule,
          registration_link = @registration_link, payment_link = @payment_link, contact_email = @contact_email, description = @description
      WHERE id = @id
    `);
    return stmt.run({
      id,
      start_date: data.start_date || 'Inicia: Noviembre 2026',
      schedule: data.schedule || 'Encuentros sincrónicos',
      payment_link: data.payment_link || 'https://asone.udea.edu.co/portafolio/',
      ...data
    });
  }

  /**
   * Elimina lógicamente un programa
   */
  static deleteItem(id) {
    const stmt = db.prepare('UPDATE knowledge_items SET is_active = 0 WHERE id = ?');
    return stmt.run(id);
  }
}
