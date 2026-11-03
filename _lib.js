// Общие утилиты серверной части KOSTA GPT
const crypto = require('crypto');

const GROQ_BASE = 'https://api.groq.com/openai/v1';
const TEXT_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];
const VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const ALL_MODELS = TEXT_MODELS.concat([VISION_MODEL]);

// --- Rate limit (в памяти инстанса; для строгой защиты нужен Upstash/Vercel KV) ---
const hits = new Map();
function rateLimit(ip, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { hits.set(ip, arr); return false; }
  arr.push(now); hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return true;
}
function getIp(req) {
  const f = req.headers['x-forwarded-for'];
  return (f ? String(f).split(',')[0].trim() : '') || (req.socket && req.socket.remoteAddress) || 'unknown';
}

// --- Same-origin проверка (CORS не открываем) ---
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // запросы без Origin (same-origin GET, curl)
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origin).host === host;
  } catch (e) { return false; }
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(obj));
}

// --- Админ-токен (HMAC, живёт 2 часа) ---
function secret() { return process.env.ADMIN_SECRET || process.env.ADMIN_PASSWORD || ''; }
function signToken() {
  const exp = String(Date.now() + 2 * 3600 * 1000);
  const sig = crypto.createHmac('sha256', secret()).update(exp).digest('hex');
  return exp + '.' + sig;
}
function verifyToken(token) {
  if (!token || !secret()) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2 || Number(parts[0]) < Date.now()) return false;
  const good = crypto.createHmac('sha256', secret()).update(parts[0]).digest('hex');
  return safeEq(parts[1], good);
}
function safeEq(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { GROQ_BASE, TEXT_MODELS, VISION_MODEL, ALL_MODELS, rateLimit, getIp, checkOrigin, send, signToken, verifyToken, safeEq };
