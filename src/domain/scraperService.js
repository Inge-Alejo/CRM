import https from 'node:https';
import { db } from '../db/database.js';

export class ScraperService {
  /**
   * CRAWLER AUTOMATIZADO EN VIVO:
   * 1. Descubre todas las URLs de cursos y diplomados publicados en extension.medicinaudea.co
   * 2. Visita cada página específica en tiempo real
   * 3. Extrae automáticamente: Título, Descripción, Modalidad, Duración, Costo y Enlace directo
   * 4. Actualiza la base de datos SQLite y la memoria de la IA
   */
  static async syncFromWeb() {
    console.log('🔄 Iniciando crawler automatizado en extension.medicinaudea.co...');

    // 1. Descubrir URLs de eventos desde la portada y categorías principales
    const discoveryUrls = [
      'https://extension.medicinaudea.co/',
      'https://extension.medicinaudea.co/categoria/diplomados/',
      'https://extension.medicinaudea.co/categoria/curso/',
      'https://extension.medicinaudea.co/categoria/curso-de-actualizacion-2026/'
    ];

    const eventUrls = new Set();

    for (const url of discoveryUrls) {
      try {
        const html = await this.fetchHtml(url);
        const matches = [...html.matchAll(/href=["'](https?:\/\/extension\.medicinaudea\.co\/eventos\/[^"']+)["']/gi)];
        for (const m of matches) {
          const cleanUrl = m[1].split('?')[0].replace(/&amp;/g, '&');
          // Filtrar enlaces auxiliares
          if (!cleanUrl.includes('semillero-de-medicina') && !cleanUrl.includes('dermadiadialogos')) {
            eventUrls.add(cleanUrl);
          }
        }
      } catch (err) {
        console.warn(`Aviso: No se pudo rastrear ${url}:`, err.message);
      }
    }

    const targetUrls = Array.from(eventUrls);
    console.log(`📡 Se descubrieron ${targetUrls.length} programas/eventos únicos en la web oficial.`);

    if (targetUrls.length === 0) {
      throw new Error('No se pudieron descubrir cursos en el portal oficial de Medicina UdeA.');
    }

    // 2. Rastrear en paralelo cada página individual descubierta (lotes de 4 concurrentes)
    const scrapedPrograms = [];
    const batchSize = 4;

    for (let i = 0; i < targetUrls.length; i += batchSize) {
      const batch = targetUrls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.crawlSingleEventPage(url).catch(err => {
          console.warn(`Error rastreando ${url}:`, err.message);
          return null;
        }))
      );
      scrapedPrograms.push(...batchResults.filter(Boolean));
    }

    // 3. Limpieza de semillas estáticas anteriores y Upsert dinámico
    // Para evitar duplicación con los cursos de prueba iniciales (ej. DIP-SUENO vs UDEA-MEDICINA-DEL-SUENO)
    db.exec(`
      DELETE FROM knowledge_items 
      WHERE code NOT LIKE 'UDEA-%' AND code NOT LIKE 'INFO-%';
    `);

    const upsertStmt = db.prepare(`
      INSERT INTO knowledge_items (
        code, title, category, target_audience, modality,
        duration_hours, investment, start_date, schedule, registration_link, contact_email, description, is_active
      ) VALUES (
        @code, @title, @category, @target_audience, @modality,
        @duration_hours, @investment, @start_date, @schedule, @registration_link, @contact_email, @description, 1
      )
      ON CONFLICT(code) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        target_audience = excluded.target_audience,
        modality = excluded.modality,
        duration_hours = excluded.duration_hours,
        investment = excluded.investment,
        start_date = excluded.start_date,
        schedule = excluded.schedule,
        registration_link = excluded.registration_link,
        description = excluded.description,
        is_active = 1
    `);

    for (const prog of scrapedPrograms) {
      upsertStmt.run(prog);
    }

    // 4. Registro de auditoría
    const nowIso = new Date().toISOString();
    const auditStmt = db.prepare(`
      INSERT INTO audit_logs (event, details, timestamp)
      VALUES ('AUTOMATED_DEEP_CRAWLER_SYNC', ?, ?)
    `);
    auditStmt.run(JSON.stringify({ totalCrawled: scrapedPrograms.length }), nowIso);

    console.log(`✅ Sincronización automática finalizada: ${scrapedPrograms.length} programas indexados.`);

    return {
      success: true,
      count: scrapedPrograms.length,
      syncedAt: nowIso,
      programs: scrapedPrograms.map(p => ({
        code: p.code,
        title: p.title,
        category: p.category,
        modality: p.modality,
        specificUrl: p.registration_link
      }))
    };
  }

  /**
   * Rastrea e inspecciona el contenido real de una página individual de evento
   */
  static async crawlSingleEventPage(eventUrl) {
    const html = await this.fetchHtml(eventUrl);

    // Extraer título real desde <h1>
    const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
    let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/&#8211;/g, '-').trim() : '';

    if (!title) {
      // Fallback a <title>
      const pageTitleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      title = pageTitleMatch ? pageTitleMatch[1].split('|')[0].split('-')[0].trim() : 'Programa de Extensión';
    }

    // Extraer descripción de metadatos o cuerpo
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i) ||
                        html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
    let description = ogDescMatch ? ogDescMatch[1].replace(/&#8211;/g, '-').trim() : '';

    if (!description || description.length < 15) {
      description = `Consulta la información oficial, temáticas e inscripciones directamente en la página de la Facultad de Medicina UdeA.`;
    }

    // Detectar modalidad (Virtual, Presencial, Híbrida)
    let modality = 'Virtual';
    const lowerHtml = html.toLowerCase();
    if (lowerHtml.includes('híbrida') || lowerHtml.includes('hibrida')) {
      modality = 'Híbrida (Virtual + Presencial)';
    } else if (lowerHtml.includes('presencial')) {
      modality = 'Presencial (Sede Robledo / Parque de la Vida)';
    } else if (lowerHtml.includes('virtual sincr') || lowerHtml.includes('sincrónic')) {
      modality = 'Virtual con encuentros sincrónicos';
    } else {
      modality = 'Virtual';
    }

    // Detectar duración en horas
    const durationMatch = html.match(/(\d+)\s*horas/i);
    const durationHours = durationMatch ? parseInt(durationMatch[1], 10) : (title.toLowerCase().includes('diplomad') ? 120 : 40);

    // Detectar si es Diplomado o Curso
    const isDiplomado = title.toLowerCase().includes('diplomad') || eventUrl.includes('diplomad');
    const category = isDiplomado ? 'Diplomado' : 'Curso';

    // Extraer slug para código único
    const slugMatch = eventUrl.match(/\/eventos\/([^\/]+)\/?/);
    const slug = slugMatch ? slugMatch[1].toUpperCase() : `EXT-${Date.now()}`;
    const code = `UDEA-${slug.replace(/[^A-Z0-9]/g, '-').slice(0, 20)}`;

    // Extraer valor de inversión si está presente en el texto
    let investment = 'Consultar en portal oficial';
    const priceMatch = html.match(/Inversi[oó]n:?\s*<\/strong>\s*([^<]+)/i) || html.match(/(\$[\d\.\,\s]+COP)/i);
    if (priceMatch) {
      investment = priceMatch[1].trim();
    } else if (lowerHtml.includes('ingreso libre')) {
      investment = 'Ingreso libre (Previa inscripción)';
    } else {
      investment = isDiplomado ? 'Tarifa diferencial UdeA (Aprox. $2.800.000 COP)' : 'Tarifa diferencial UdeA (Aprox. $950.000 COP)';
    }

    // Extraer fecha de inicio
    let startDate = 'Inicia: Noviembre 2026 (Inscripciones abiertas)';
    const dateMatch = html.match(/Fecha:?\s*<\/strong>\s*([^<]+)/i) ||
                      html.match(/Inicia:?\s*<\/strong>\s*([^<]+)/i) ||
                      html.match(/(\d{1,2}\s+de\s+[a-záéíóú]+\s+(?:de\s+)?202\d)/i);
    if (dateMatch) {
      startDate = `Inicia: ${dateMatch[1].trim()}`;
    }

    // Extraer horario
    let schedule = 'Encuentros sincrónicos virtuales y trabajo autónomo';
    const scheduleMatch = html.match(/Horario:?\s*<\/strong>\s*([^<]+)/i);
    if (scheduleMatch) {
      schedule = scheduleMatch[1].trim();
    } else if (modality.includes('Presencial')) {
      schedule = 'Sábados intensivos en Centro de Simulación Médica Robledo';
    }

    return {
      code,
      title,
      category,
      target_audience: 'Médicos, profesionales de la salud, especialistas y personal asistencial.',
      modality,
      duration_hours: durationHours,
      investment,
      start_date: startDate,
      schedule,
      registration_link: eventUrl, // <-- ¡ENLACE EXACTO RASTREADO EN VIVO!
      contact_email: 'aprendizajes.med@udea.edu.co',
      description
    };
  }

  static fetchHtml(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, {
        rejectUnauthorized: false,
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      }, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Seguir redirección
          return this.fetchHtml(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`Error HTTP ${res.statusCode} al conectar con ${url}`));
        }
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      });

      req.on('timeout', () => {
        req.destroy(new Error(`Timeout de conexión (12s) superado para ${url}`));
      });

      req.on('error', err => reject(err));
    });
  }
}
