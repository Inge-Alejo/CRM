import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

    const eventUrls = new Set([
      'https://extension.medicinaudea.co/eventos/medicina-del-sueno/',
      'https://extension.medicinaudea.co/eventos/ciencias-omicas-aplicadas/',
      'https://extension.medicinaudea.co/eventos/parto-seguro/',
      'https://extension.medicinaudea.co/eventos/soporte-vital-basico-y-avanzado-4/',
      'https://extension.medicinaudea.co/eventos/codigo-fucsia/'
    ]);

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
        duration_hours, investment, start_date, schedule, registration_link, payment_link, contact_email, description, is_active
      ) VALUES (
        @code, @title, @category, @target_audience, @modality,
        @duration_hours, @investment, @start_date, @schedule, @registration_link, @payment_link, @contact_email, @description, 1
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
        payment_link = excluded.payment_link,
        description = excluded.description,
        is_active = 1
    `);

    for (const prog of scrapedPrograms) {
      upsertStmt.run(prog);
    }

    // Persistir todos los programas sincronizados en knowledge_backup.json para que en Vercel no se pierdan
    try {
      const allActive = db.prepare('SELECT * FROM knowledge_items WHERE is_active = 1').all();
      const backupPath = path.resolve(__dirname, '../db/knowledge_backup.json');
      fs.writeFileSync(backupPath, JSON.stringify(allActive, null, 2), 'utf8');
      if (process.env.VERCEL) {
        fs.writeFileSync('/tmp/knowledge_backup.json', JSON.stringify(allActive, null, 2), 'utf8');
      }
      console.log(`💾 [RESPALDO PERSISTENTE VERCEL]: Guardados ${allActive.length} programas en ${backupPath}`);
    } catch (bErr) {
      console.warn('Aviso: No se pudo escribir knowledge_backup.json:', bErr.message);
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
        specificUrl: p.registration_link,
        paymentLink: p.payment_link
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

    // Función auxiliar para fechas en español
    const formatFriendlyDate = (isoStart, isoEnd) => {
      if (!isoStart) return null;
      const mNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      const p1 = isoStart.split('T')[0].split('-');
      if (p1.length !== 3) return null;
      const y1 = parseInt(p1[0], 10), m1 = parseInt(p1[1], 10) - 1, d1 = parseInt(p1[2], 10);

      if (!isoEnd) {
        return `Inicia: ${d1} de ${mNames[m1]} de ${y1}`;
      }
      const p2 = isoEnd.split('T')[0].split('-');
      if (p2.length !== 3) return `Inicia: ${d1} de ${mNames[m1]} de ${y1}`;
      const y2 = parseInt(p2[0], 10), m2 = parseInt(p2[1], 10) - 1, d2 = parseInt(p2[2], 10);

      if (y1 === y2 && m1 === m2 && d1 === d2) {
        return `Fecha: ${d1} de ${mNames[m1]} de ${y1}`;
      }
      if (y1 === y2 && m1 === m2) {
        return `Inicia: ${d1} al ${d2} de ${mNames[m1]} de ${y1}`;
      }
      if (y1 === y2) {
        return `Inicia: ${d1} de ${mNames[m1]} al ${d2} de ${mNames[m2]} de ${y2}`;
      }
      return `Inicia: ${d1} de ${mNames[m1]} de ${y1} al ${d2} de ${mNames[m2]} de ${y2}`;
    };

    // 1. Extraer fecha exacta desde Schema.org / JSON-LD / MEC Plugin
    const schemaStartDate = html.match(/"startDate"\s*:\s*"([^"]+)"/i);
    const schemaEndDate = html.match(/"endDate"\s*:\s*"([^"]+)"/i);
    const occurrenceDate = html.match(/occurrence=([0-9]{4}-[0-9]{2}-[0-9]{2})/i);

    let startDate = null;
    if (schemaStartDate) {
      startDate = formatFriendlyDate(schemaStartDate[1], schemaEndDate ? schemaEndDate[1] : null);
    } else if (occurrenceDate) {
      startDate = formatFriendlyDate(occurrenceDate[1], null);
    }

    if (!startDate) {
      const dateMatch = html.match(/Fecha:?\s*<\/strong>\s*([^<]+)/i) ||
                        html.match(/Inicia:?\s*<\/strong>\s*([^<]+)/i) ||
                        html.match(/(\d{1,2}\s+de\s+[a-záéíóú]+\s+(?:de\s+)?202\d)/i);
      if (dateMatch) {
        startDate = `Inicia: ${dateMatch[1].trim()}`;
      } else {
        startDate = 'Inscripciones abiertas (Consultar fechas de cohorte en enlace)';
      }
    }

    // 2. Extraer valor de inversión oficial desde Schema.org o texto
    let investment = 'Consultar en portal oficial';
    const schemaPrice = html.match(/"price"\s*:\s*"?(\d+)"?/i);
    if (schemaPrice) {
      const numPrice = parseInt(schemaPrice[1], 10);
      if (numPrice === 0) {
        investment = 'Ingreso libre (Previa inscripción)';
      } else {
        investment = `$${numPrice.toLocaleString('es-CO')} COP`;
      }
    } else {
      const priceMatch = html.match(/Inversi[oó]n:?\s*<\/strong>\s*([^<]+)/i) || html.match(/(\$[\d\.\,\s]+COP)/i);
      if (priceMatch) {
        investment = priceMatch[1].trim();
      } else if (lowerHtml.includes('ingreso libre')) {
        investment = 'Ingreso libre (Previa inscripción)';
      } else {
        investment = isDiplomado ? 'Tarifa diferencial UdeA (Aprox. $2.800.000 COP)' : 'Tarifa diferencial UdeA (Aprox. $950.000 COP)';
      }
    }

    // 3. Extraer ubicación y horario
    let schedule = 'Encuentros sincrónicos virtuales y trabajo autónomo';
    const addressMatch = html.match(/"address"\s*:\s*"([^"]+)"/i);
    const scheduleMatch = html.match(/Horario:?\s*<\/strong>\s*([^<]+)/i);
    if (scheduleMatch) {
      schedule = scheduleMatch[1].trim();
    } else if (addressMatch) {
      schedule = `Presencial en ${addressMatch[1].trim()}`;
    } else if (modality.includes('Presencial')) {
      schedule = 'Sábados intensivos en Centro de Simulación Médica Robledo';
    }

    // 4. Extraer enlace exacto de inscripción / pago desde el botón de inscripción oficial (ej: asone.udea.edu.co)
    let paymentLink = null;
    const asoneMatch = html.match(/href=["'](https?:\/\/asone\.udea\.edu\.co\/portafolio\/[^"']+)["']/i);
    if (asoneMatch) {
      paymentLink = asoneMatch[1].replace(/&amp;/g, '&').trim();
    } else {
      // Buscar etiquetas <a> con texto de Inscripciones, Matrícula o Pagar
      const inscriptionBtnMatch = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?(?:Inscripciones|Inscribirme|Inscribirse|Pagar|Matr[ií]cula)[\s\S]*?<\/a>/i);
      if (inscriptionBtnMatch && inscriptionBtnMatch[1]) {
        const candidateUrl = inscriptionBtnMatch[1].replace(/&amp;/g, '&').trim();
        if (candidateUrl.includes('asone.udea.edu.co') || candidateUrl.includes('udea.edu.co') || candidateUrl.startsWith('http')) {
          paymentLink = candidateUrl;
        }
      }
    }

    if (!paymentLink) {
      // Fallback institucional oficial del portal de extension y portafolio de la Universidad de Antioquia
      paymentLink = 'https://asone.udea.edu.co/portafolio/';
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
      registration_link: eventUrl, // <-- Enlace de Extensión con información general detallada
      payment_link: paymentLink,   // <-- Enlace directo del botón de Inscripciones / Pago
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
