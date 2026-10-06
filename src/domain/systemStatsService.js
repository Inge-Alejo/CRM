import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db/database.js';
import { config } from '../config.js';
import { GeminiService } from '../ai/geminiService.js';
import { NeonService } from '../db/neonService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SystemStatsService {
  /**
   * Recopila el informe completo de telemetría y métricas del sistema
   */
  static async getSystemMetrics() {
    const currentYearMonth = new Date().toISOString().slice(0, 7);
    const conversationLimit = config.conversationLimit || 1000;

    let dbFilePath = 'Neon Serverless PostgreSQL (Cloud AWS us-east-1)';
    let dbSizeFormatted = 'Nube Administrada (Neon SSL Pooler)';
    let dbSizeBytes = 0;
    let engine = 'PostgreSQL 18.6 (Neon Serverless)';
    let leadStats = {};
    let messageStats = {};
    let conversationsCount = 0;
    let knowledgeStats = {};
    let advisorsCount = 0;
    let totalAuditLogs = 0;
    let recentAuditLogs = [];

    if (NeonService.isAvailable()) {
      try {
        const cloudData = await NeonService.getDetailedMetrics(currentYearMonth);
        leadStats = cloudData.leadStats;
        messageStats = cloudData.messageStats;
        conversationsCount = cloudData.conversationsCount;
        knowledgeStats = cloudData.knowledgeStats;
        advisorsCount = cloudData.advisorsCount;
        totalAuditLogs = cloudData.totalAuditLogs;
        recentAuditLogs = cloudData.recentAuditLogs;
      } catch (err) {
        console.warn('Error obteniendo métricas de Neon, fallback a SQLite local:', err.message);
      }
    }

    // Si no hubo datos de Neon o falló, usar SQLite local
    if (!leadStats.total && leadStats.total !== 0) {
      engine = 'SQLite 3 (Local)';
      dbFilePath = process.env.VERCEL 
        ? path.join('/tmp', 'crm_database.sqlite') 
        : path.resolve(__dirname, '../../crm_database.sqlite');
      
      try {
        if (fs.existsSync(dbFilePath)) {
          const stats = fs.statSync(dbFilePath);
          dbSizeBytes = stats.size;
          if (dbSizeBytes >= 1024 * 1024) {
            dbSizeFormatted = `${(dbSizeBytes / (1024 * 1024)).toFixed(2)} MB`;
          } else {
            dbSizeFormatted = `${(dbSizeBytes / 1024).toFixed(1)} KB`;
          }
        }
      } catch (e) {
        dbSizeFormatted = 'Memoria / Vercel Volátil';
      }

      leadStats = {
        total: db.prepare('SELECT COUNT(*) as c FROM leads').get()?.c || 0,
        hot: db.prepare("SELECT COUNT(*) as c FROM leads WHERE interest_temperature = 'hot'").get()?.c || 0,
        warm: db.prepare("SELECT COUNT(*) as c FROM leads WHERE interest_temperature = 'warm'").get()?.c || 0,
        cold: db.prepare("SELECT COUNT(*) as c FROM leads WHERE interest_temperature = 'cold'").get()?.c || 0,
        unassigned: db.prepare("SELECT COUNT(*) as c FROM leads WHERE assigned_advisor = 'Sin Asignar' OR assigned_advisor IS NULL").get()?.c || 0
      };

      messageStats = {
        total: db.prepare('SELECT COUNT(*) as c FROM messages').get()?.c || 0,
        userMessages: db.prepare("SELECT COUNT(*) as c FROM messages WHERE sender = 'user'").get()?.c || 0,
        botMessages: db.prepare("SELECT COUNT(*) as c FROM messages WHERE sender = 'bot'").get()?.c || 0,
        advisorMessages: db.prepare("SELECT COUNT(*) as c FROM messages WHERE sender = 'advisor'").get()?.c || 0
      };

      conversationsCount = db.prepare('SELECT COUNT(*) as c FROM conversations WHERE year_month = ?').get(currentYearMonth)?.c || 0;

      knowledgeStats = {
        total: db.prepare('SELECT COUNT(*) as c FROM knowledge_items WHERE is_active = 1').get()?.c || 0,
        diplomados: db.prepare("SELECT COUNT(*) as c FROM knowledge_items WHERE is_active = 1 AND category = 'Diplomado'").get()?.c || 0,
        cursos: db.prepare("SELECT COUNT(*) as c FROM knowledge_items WHERE is_active = 1 AND category != 'Diplomado'").get()?.c || 0,
        withPaymentLink: db.prepare("SELECT COUNT(*) as c FROM knowledge_items WHERE is_active = 1 AND payment_link IS NOT NULL AND payment_link != ''").get()?.c || 0
      };

      advisorsCount = db.prepare('SELECT COUNT(*) as c FROM advisors WHERE is_active = 1').get()?.c || 0;
      totalAuditLogs = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get()?.c || 0;
      recentAuditLogs = db.prepare('SELECT id, event, details, timestamp FROM audit_logs ORDER BY id DESC LIMIT 20').all();
    }

    const conversationsPercent = Math.min(100, Math.round((conversationsCount / conversationLimit) * 100));

    // 2. Métricas de IA y Tokens
    const aiTelemetry = {
      totalCalls: GeminiService.telemetry.totalCalls,
      geminiSuccess: GeminiService.telemetry.geminiSuccess,
      localFallback: GeminiService.telemetry.localFallback,
      estimatedInputTokens: GeminiService.telemetry.estimatedInputTokens,
      estimatedOutputTokens: GeminiService.telemetry.estimatedOutputTokens,
      totalEstimatedTokens: GeminiService.telemetry.estimatedInputTokens + GeminiService.telemetry.estimatedOutputTokens,
      lastUsedModel: GeminiService.telemetry.lastUsedModel || 'Ninguno aún',
      hasApiKey: !!(config.geminiApiKey && config.geminiApiKey.trim() !== ''),
      activeModelPool: [
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-2.5-flash'
      ],
      modelStats: GeminiService.telemetry.modelStats
    };

    // 3. WhatsApp Cloud API y Kill-Switch
    const whatsappStats = {
      conversationsMonth: conversationsCount,
      monthlyLimit: conversationLimit,
      usagePercent: conversationsPercent,
      killSwitchArmed: conversationsCount >= conversationLimit,
      killSwitchStatus: conversationsCount >= conversationLimit ? 'ACTIVADO (Bloqueo preventivo de facturación)' : 'NORMAL (Dentro de la cuota)',
      metaPhoneId: config.meta.phoneNumberId ? `${config.meta.phoneNumberId.slice(0, 5)}...` : 'Sin configurar',
      metaWabaId: config.meta.wabaId ? `${config.meta.wabaId.slice(0, 5)}...` : 'Sin configurar'
    };

    // 5. Métricas de Hardware / Proceso Node.js
    const memory = process.memoryUsage();
    const serverMetrics = {
      uptimeSeconds: Math.floor(process.uptime()),
      uptimeFormatted: SystemStatsService.formatUptime(process.uptime()),
      heapUsedMb: (memory.heapUsed / (1024 * 1024)).toFixed(1),
      heapTotalMb: (memory.heapTotal / (1024 * 1024)).toFixed(1),
      rssMb: (memory.rss / (1024 * 1024)).toFixed(1),
      environment: process.env.VERCEL ? 'Vercel Serverless Production' : 'Node.js Standalone / Local',
      nodeVersion: process.version
    };

    return {
      database: {
        engine,
        filePath: dbFilePath,
        sizeFormatted: dbSizeFormatted,
        sizeBytes: dbSizeBytes,
        isCloud: NeonService.isAvailable(),
        tables: {
          leads: leadStats,
          messages: messageStats,
          conversations: {
            currentMonth: currentYearMonth,
            count: conversationsCount,
            limit: conversationLimit,
            percent: conversationsPercent
          },
          knowledge: knowledgeStats,
          advisorsCount,
          totalAuditLogs
        }
      },
      ai: aiTelemetry,
      whatsapp: whatsappStats,
      server: serverMetrics,
      auditLogs: recentAuditLogs
    };
  }

  static formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  }
}
