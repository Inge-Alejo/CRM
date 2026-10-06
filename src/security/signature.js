import crypto from 'node:crypto';
import { config } from '../config.js';

/**
 * Validador criptográfico de firma HMAC-SHA256 para webhooks de Meta WhatsApp Cloud API
 */
export function verifyMetaSignature(rawBody, signatureHeader) {
  if (!config.meta.appSecret) {
    // Si no se ha configurado META_APP_SECRET en desarrollo, se permite pasar con advertencia
    return { valid: true, warning: 'META_APP_SECRET no configurado, validación de firma omitida en modo dev' };
  }

  if (!signatureHeader) {
    return { valid: false, error: 'Falta cabecera X-Hub-Signature-256' };
  }

  const [prefix, signature] = signatureHeader.split('=');
  if (prefix !== 'sha256' || !signature) {
    return { valid: false, error: 'Formato de cabecera de firma inválido' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.meta.appSecret)
    .update(rawBody)
    .digest('hex');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf8');

  // Si las longitudes difieren, timingSafeEqual arroja un RangeError en Node.js
  if (sigBuf.length !== expectedBuf.length) {
    return { valid: false, error: 'Longitud de firma HMAC no coincide con SHA-256' };
  }

  // Comparación en tiempo constante para mitigar ataques de temporización (Timing Attacks)
  const isMatch = crypto.timingSafeEqual(sigBuf, expectedBuf);

  return { valid: isMatch, error: isMatch ? null : 'Firma HMAC no coincide' };
}
