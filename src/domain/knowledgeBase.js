import { db } from '../db/database.js';
import { NeonService } from '../db/neonService.js';

export class KnowledgeBaseService {
  /**
   * Obtiene todos los elementos de conocimiento activos
   */
  static async getActiveItems() {
    if (NeonService.isAvailable()) {
      try {
        const items = await NeonService.getActiveItems();
        if (items && items.length > 0) return items;
      } catch (err) {
        console.warn('Neon query error en getActiveItems, usando fallback local:', err.message);
      }
    }
    const stmt = db.prepare('SELECT * FROM knowledge_items WHERE is_active = 1 ORDER BY category, title');
    return stmt.all();
  }

  /**
   * Genera el contexto formateado para el System Prompt de Gemini
   */
  static async generateContextPrompt() {
    const items = await this.getActiveItems();
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
      prompt += `ENLACE DE INFORMACIÓN OFICIAL (PORTAL Y TEMARIO): ${item.registration_link || item.payment_link || 'https://extension.medicinaudea.co/oferta-academica/'}\n`;
      prompt += `ENLACE DIRECTO DE INSCRIPCIÓN Y PAGO: ${item.payment_link || item.registration_link || 'https://extension.medicinaudea.co/oferta-academica/'}\n`;
      prompt += `CORREO DE CONTACTO: ${item.contact_email || 'extensionmedicina@udea.edu.co'}\n`;
      prompt += `DESCRIPCIÓN Y CONTENIDO: ${item.description}\n`;
      prompt += `====================================================\n\n`;
    }

    return prompt;
  }

  /**
   * Agrega un nuevo curso o programa al portafolio
   */
  static async addItem(data) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.addKnowledgeItem(data);
      } catch (err) {
        console.warn('Error guardando curso en Neon:', err.message);
      }
    }

    try {
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
        payment_link: data.payment_link || data.registration_link || 'https://extension.medicinaudea.co/oferta-academica/',
        ...data
      });
    } catch (e) {}
  }

  /**
   * Actualiza un programa existente
   */
  static async updateItem(id, data) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.updateKnowledgeItemById(id, data);
      } catch (err) {
        console.warn('Error actualizando curso en Neon:', err.message);
      }
    }

    try {
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
        payment_link: data.payment_link || data.registration_link || 'https://extension.medicinaudea.co/oferta-academica/',
        ...data
      });
    } catch (e) {}
  }

  /**
   * Elimina lógicamente un programa
   */
  static async deleteItem(id) {
    if (NeonService.isAvailable()) {
      try {
        await NeonService.deleteKnowledgeItemById(id);
      } catch (err) {
        console.warn('Error eliminando curso en Neon:', err.message);
      }
    }
    const stmt = db.prepare('UPDATE knowledge_items SET is_active = 0 WHERE id = ?');
    return stmt.run(id);
  }
}
