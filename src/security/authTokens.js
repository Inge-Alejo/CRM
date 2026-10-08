import crypto from 'node:crypto';
import { config } from '../config.js';

const SESSION_SECRET = process.env.SESSION_SECRET || config.meta.appSecret || 'udea_crm_session_secret_2026_prod';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 días de validez máxima

/**
 * Genera un token de sesión firmado criptográficamente con HMAC-SHA256
 * @param {object} payload 
 * @returns {string} Token firmado formato payload.signature
 */
export function generateAuthToken(payload) {
  const tokenPayload = {
    ...payload,
    iat: Date.now(),
    exp: Date.now() + TOKEN_EXPIRY_MS
  };
  const payloadBase64 = Buffer.from(JSON.stringify(tokenPayload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

/**
 * Valida la firma HMAC-SHA256 y expiración del token en tiempo constante
 * @param {string} token 
 * @returns {object|null} Datos decodificados si es válido, null si fue manipulado o expiró
 */
export function verifyAuthToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadBase64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature, 'utf8');
  const expBuf = Buffer.from(expectedSignature, 'utf8');

  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const data = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) {
      return null; // Token expirado
    }
    return data;
  } catch {
    return null;
  }
}
