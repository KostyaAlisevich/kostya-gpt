const RATE_LIMIT = new Map();
const MAX_REQ_PER_MIN = 30;
const MAX_BODY_BYTES = 6 * 1024 * 1024;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const bucket = RATE_LIMIT.get(ip) || { count: 0, reset: now + 60000 };
  if (now > bucket.reset) { bucket.count = 0; bucket.reset = now + 60000; }
  bucket.count++;
  RATE_LIMIT.set(ip, bucket);
  if (bucket.count > MAX_REQ_PER_MIN) return res.status(429).json({ error: 'Слишком много запросов' });

  const raw = JSON.stringify(req.body || {});
  if (raw.length > MAX_BODY_BYTES) return res.status(413).json({ error: 'Слишком большой запрос' });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'GROQ_API_KEY не настроен' });

  const { model, messages, temperature, max_tokens } = req.body || {};
  if (!model || !Array.isArray(messages) || !messages.length) {
    return res.status(400).json({ error: 'Неверные параметры' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model, messages,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: typeof max_tokens === 'number' ? max_tokens : 2048
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeout));
    const data = await groqRes.json().catch(() => ({}));
    if (!groqRes.ok) return res.status(groqRes.status).json({ error: data.error?.message || 'Ошибка Groq' });
    return res.status(200).json(data);
  } catch (e) {
    if (e.name === 'AbortError') return res.status(504).json({ error: 'Таймаут' });
    return res.status(500).json({ error: e.message });
  }
    }
