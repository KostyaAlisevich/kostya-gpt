// POST /api/admin  { action: 'login' | 'check', login, password, token }
const L = require('./_lib');

module.exports = async function (req, res) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Метод не разрешён' });
  if (!L.checkOrigin(req)) return L.send(res, 403, { error: 'Запрещённый источник запроса' });
  if (!L.rateLimit('admin:' + L.getIp(req), 8, 60000)) return L.send(res, 429, { error: 'Слишком много попыток входа' });
  if (!L.cfg('ADMIN_LOGIN') || !L.cfg('ADMIN_PASSWORD')) return L.send(res, 500, { error: 'ADMIN_LOGIN / ADMIN_PASSWORD не заданы в api/_config.js' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  if (b.action === 'login') {
    const ok = L.safeEq(b.login || '', L.cfg('ADMIN_LOGIN')) & L.safeEq(b.password || '', L.cfg('ADMIN_PASSWORD'));
    if (!ok) return L.send(res, 401, { error: 'Неверный логин или пароль' });
    return L.send(res, 200, { token: L.signToken() });
  }

  if (!L.verifyToken(b.token)) return L.send(res, 401, { error: 'Сессия администратора истекла' });

  if (b.action === 'check') { // проверка подключения к Groq + список доступных моделей
    if (!L.cfg('GROQ_API_KEY')) return L.send(res, 200, { ok: false, error: 'GROQ_API_KEY не задан в api/_config.js' });
    try {
      const t0 = Date.now();
      const r = await fetch(L.GROQ_BASE + '/models', { headers: { Authorization: 'Bearer ' + L.cfg('GROQ_API_KEY') } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return L.send(res, 200, { ok: false, error: (d.error && d.error.message) || 'HTTP ' + r.status });
      const ids = (d.data || []).map(m => m.id);
      return L.send(res, 200, { ok: true, ms: Date.now() - t0, available: L.ALL_MODELS.filter(m => ids.indexOf(m) >= 0), unavailable: L.ALL_MODELS.filter(m => ids.indexOf(m) < 0) });
    } catch (e) { return L.send(res, 200, { ok: false, error: 'Нет связи с Groq' }); }
  }
  return L.send(res, 400, { error: 'Неизвестное действие' });
};
