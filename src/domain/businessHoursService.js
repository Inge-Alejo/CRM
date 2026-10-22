import { config } from '../config.js';
import { db } from '../db/database.js';

export class BusinessHoursService {
  /**
   * Obtiene la fecha y hora actual desglosada en la zona horaria institucional (America/Bogota)
   * @param {Date} date 
   */
  static getBogotaTime(date = new Date()) {
    const tz = config.officeHours?.timezone || 'America/Bogota';
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const partMap = {};
    for (const p of parts) {
      partMap[p.type] = p.value;
    }

    // Mapear weekday a 0-6 (0=Dom, 1=Lun, ..., 6=Sab)
    const weekdayMap = {
      'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
    };
    const dayOfWeek = weekdayMap[partMap.weekday] ?? date.getDay();
    const hour = parseInt(partMap.hour, 10);
    const minute = parseInt(partMap.minute, 10);

    return {
      dayOfWeek,
      hour,
      minute,
      timezone: tz,
      isoDate: date.toISOString()
    };
  }

  /**
   * Determina si una fecha u hora corresponde al horario de atención oficial
   * Por defecto: Lunes a Viernes, 8:00 a.m. a 5:00 p.m. (America/Bogota)
   * @param {Date} date 
   */
  static isWithinOfficeHours(date = new Date()) {
    const { startHour, endHour, days } = config.officeHours;
    const { dayOfWeek, hour, minute } = this.getBogotaTime(date);

    // 1. Validar si el día de la semana está habilitado (ej. 1=Lun ... 5=Vie)
    if (!days.includes(dayOfWeek)) {
      return false;
    }

    // 2. Validar rango horario [startHour:00, endHour:00)
    // 8:00 a 17:00 (5:00 p.m.)
    if (hour < startHour || hour > endHour) {
      return false;
    }
    if (hour === endHour && minute > 0) {
      return false;
    }

    return true;
  }

  /**
   * Retorna el estado completo del horario institucional
   */
  static getStatus(date = new Date()) {
    const isWithin = this.isWithinOfficeHours(date);
    const timeInfo = this.getBogotaTime(date);
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    return {
      isWithinOfficeHours: isWithin,
      currentLocalTime: `${timeInfo.hour.toString().padStart(2, '0')}:${timeInfo.minute.toString().padStart(2, '0')}`,
      currentDayName: dayNames[timeInfo.dayOfWeek],
      timezone: timeInfo.timezone,
      schedule: {
        start: `${config.officeHours.startHour}:00`,
        end: `${config.officeHours.endHour}:00`,
        days: config.officeHours.days.map(d => dayNames[d])
      },
      config: {
        startHour: config.officeHours.startHour,
        endHour: config.officeHours.endHour,
        timezone: config.officeHours.timezone,
        workDays: config.officeHours.days
      },
      outOfHoursNotice: !isWithin ? config.officeHours.outOfHoursMessage : null
    };
  }

  /**
   * Permite actualizar la configuración en caliente sin reescribir la lógica
   */
  static updateConfig({ startHour, endHour, days, timezone, outOfHoursMessage }) {
    if (typeof startHour === 'number' && startHour >= 0 && startHour <= 23) {
      config.officeHours.startHour = startHour;
    }
    if (typeof endHour === 'number' && endHour >= 0 && endHour <= 23) {
      config.officeHours.endHour = endHour;
    }
    if (Array.isArray(days)) {
      config.officeHours.days = days.map(Number);
    }
    if (timezone && typeof timezone === 'string') {
      config.officeHours.timezone = timezone.trim();
    }
    if (outOfHoursMessage && typeof outOfHoursMessage === 'string') {
      config.officeHours.outOfHoursMessage = outOfHoursMessage.trim();
    }
    return this.getStatus();
  }

  /**
   * Obtiene la disponibilidad real de un asesor individual (independiente del horario institucional)
   */
  static getAdvisorAvailability(advisorIdentifier) {
    const isOfficeOpen = this.isWithinOfficeHours();
    if (!advisorIdentifier) {
      return { isOfficeOpen, isAdvisorActive: false };
    }
    try {
      const clean = advisorIdentifier.trim().toLowerCase();
      const adv = db.prepare('SELECT is_active, is_available FROM advisors WHERE LOWER(email) = ? OR LOWER(name) = ?').get(clean, clean);
      if (!adv) {
        return { isOfficeOpen, isAdvisorActive: false };
      }
      const isAdvisorActive = adv.is_available !== undefined ? (adv.is_available === 1 && adv.is_active === 1) : (adv.is_active === 1);
      return { isOfficeOpen, isAdvisorActive };
    } catch {
      return { isOfficeOpen, isAdvisorActive: true };
    }
  }
}
