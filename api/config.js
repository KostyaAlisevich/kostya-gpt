// GET  /api/config -> общие настройки для всех (промпты ролей, модели, функции)
// POST /api/config { token, config } -> сохранить (только администратор)
const L = require('./_lib');
const D = require('./_db');
const ROLE_KEYS = ['helper', 'coder', 'teacher', 'translator'];

function clean(b) {
  const out = { prompts: {}, enabled: [], vision: true, voice: true };
  if (b.prompts && typeof b.prompts === 'object') ROLE_KEYS.forEach(k => { if (typeof b.prompts[k] === 'string' && b.prompts[k].trim()) out.prompts[k] = b.prompts[k].slice(0, 3000); });
  out.enabled = (Array.isArray(b.enabled) ? b.enabled : []).filter(m => L.TEXT_MODELS.indexOf(m) >= 0);
  if (!out.enabled.length) out.enabled = L.TEXT_MODELS.slice();
  out.vision = b.vision !== false; out.voice = b.voice !== false;
  return out;
}

module.exports = async function (req, res) {
  if (!L.checkOrigin(req)) return L.send(res, 403, { error: 'Запрещённый источник запроса' });
  if (!L.rateLimit('cfg:' + L.getIp(req), 60, 60000)) return L.send(res, 429, { error: 'Слишком много запросов' });
  if (!D.enabled()) return L.send(res, 200, { db: false });
  try {
    if (req.method === 'GET') {
      const rows = await D.query("SELECT v FROM kv WHERE k = 'config'");
      return L.send(res, 200, { db: true, config: rows.length ? JSON.parse(rows[0].v) : null });
    }
    if (req.method === 'POST') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
      if (!L.verifyToken(b.token)) return L.send(res, 401, { error: 'Сессия администратора истекла' });
      const c = clean(b.config || {});
      await D.query("INSERT INTO kv (k, v) VALUES ('config', ?) ON DUPLICATE KEY UPDATE v = VALUES(v)", [JSON.stringify(c)]);
      return L.send(res, 200, { db: true, config: c });
    }
    return L.send(res, 405, { error: 'Метод не разрешён' });
  } catch (e) {
    return L.send(res, 200, { db: false, error: 'db_error' }); // без базы сайт продолжает работать
  }
};
