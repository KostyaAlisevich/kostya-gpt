// POST /api/chat — безопасный прокси к Groq. Ключ берётся из GROQ_API_KEY.
const L = require('./_lib');

const MAX_MESSAGES = 30;
const MAX_TEXT = 8000;
const MAX_IMAGE_B64 = 1500000; // ~1.1 МБ бинарных данных на фото
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function validate(body) {
  if (!body || typeof body !== 'object') return 'Пустой запрос';
  if (!Array.isArray(body.messages) || !body.messages.length) return 'Нет сообщений';
  if (body.messages.length > MAX_MESSAGES) return 'Слишком длинная история';
  let images = 0;
  for (const m of body.messages) {
    if (!m || ['system', 'user', 'assistant'].indexOf(m.role) < 0) return 'Неверная роль';
    if (typeof m.content === 'string') {
      if (m.content.length > MAX_TEXT) return 'Сообщение слишком длинное';
    } else if (Array.isArray(m.content) && m.role === 'user') {
      for (const p of m.content) {
        if (p && p.type === 'text' && typeof p.text === 'string' && p.text.length <= MAX_TEXT) continue;
        if (p && p.type === 'image_url' && p.image_url && typeof p.image_url.url === 'string') {
          const u = p.image_url.url;
          if (u.length > MAX_IMAGE_B64) return 'Фото слишком большое (максимум ~1 МБ)';
          if (!IMG_RE.test(u)) return 'Неподдерживаемый формат фото';
          if (++images > 2) return 'Не более 2 фото в запросе';
          continue;
        }
        return 'Неверный формат сообщения';
      }
    } else return 'Неверный формат сообщения';
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Метод не разрешён', code: 'method' });
  if (!L.checkOrigin(req)) return L.send(res, 403, { error: 'Запрещённый источник запроса', code: 'origin' });
  if (!L.cfg('GROQ_API_KEY')) return L.send(res, 500, { error: 'В api/_config.js не указан GROQ_API_KEY', code: 'no_key' });
  if (!L.rateLimit(L.getIp(req), 20, 60000)) return L.send(res, 429, { error: 'Слишком много запросов. Подождите минуту.', code: 'rate_limit' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const bad = validate(body);
  if (bad) return L.send(res, 400, { error: bad, code: 'bad_request' });

  const hasImage = body.messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
  let chosen = String(body.model || L.TEXT_MODELS[0]);
  if (L.TEXT_MODELS.indexOf(chosen) < 0) chosen = L.TEXT_MODELS[0]; // старая сохранённая модель не ломает чат
  // Для фото — только vision-модель; для текста — выбранная, затем запасные
  const candidates = hasImage ? [L.VISION_MODEL] : [chosen].concat(L.TEXT_MODELS.filter(m => m !== chosen));

  const temperature = Math.min(2, Math.max(0, Number(body.temperature) || 0.7));
  let max_tokens = Math.min(4096, Math.max(64, parseInt(body.max_tokens, 10) || 2048));
  if (hasImage) max_tokens = Math.max(max_tokens, 2048); // vision-модель может «думать» перед ответом

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  let lastErr = null;
  try {
    for (let i = 0; i < candidates.length; i++) {
      const model = candidates[i];
      const r = await fetch(L.GROQ_BASE + '/chat/completions', {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + L.cfg('GROQ_API_KEY') },
        body: JSON.stringify({ model, messages: body.messages, temperature, max_tokens })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        let text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
        text = String(text).replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); // убираем «размышления» модели
        return L.send(res, 200, { text, model });
      }
      const msg = (data.error && data.error.message) || ('Groq HTTP ' + r.status);
      const code = data.error && data.error.code;
      const unavailable = r.status === 404 || code === 'model_not_found' || code === 'model_decommissioned' || /does not exist|not found|decommission|no access|not supported|permission/i.test(msg);
      lastErr = { status: r.status, msg, model, unavailable };
      if (unavailable && i < candidates.length - 1) continue; // пробуем следующую модель
      break;
    }
    const kind = lastErr.unavailable ? (hasImage ? 'vision_unavailable' : 'model_unavailable') : lastErr.status === 429 ? 'groq_rate_limit' : 'groq_error';
    return L.send(res, lastErr.status === 401 ? 502 : lastErr.status, { error: lastErr.msg, code: kind, model: lastErr.model });
  } catch (e) {
    const timeout = e && e.name === 'AbortError';
    return L.send(res, timeout ? 504 : 502, { error: timeout ? 'Groq не ответил вовремя' : 'Не удалось связаться с Groq', code: timeout ? 'timeout' : 'upstream' });
  } finally { clearTimeout(timer); }
};
