/**
 * Limitador de tasa en memoria (Sliding Window Rate Limiter)
 * Protege los endpoints contra saturación DoS y ataques de fuerza bruta
 */
export class RateLimiter {
  constructor(maxRequests = 30, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();

    // Limpieza periódica automática en segundo plano (sin bloquear el event loop)
    this.timer = setInterval(() => this.cleanup(), this.windowMs);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  destroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.requests.clear();
  }

  isAllowed(key) {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Filtrar solicitudes fuera de la ventana
    const validTimestamps = timestamps.filter(ts => now - ts < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return true;
  }

  // Limpieza periódica para evitar fugas de memoria
  cleanup() {
    const now = Date.now();
    for (const [key, timestamps] of this.requests.entries()) {
      const valid = timestamps.filter(ts => now - ts < this.windowMs);
      if (valid.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, valid);
      }
    }
  }
}
