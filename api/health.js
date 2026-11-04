// GET /api/health — проверка серверной части (публично, без секретов)
const L = require('./_lib');
module.exports = function (req, res) {
  L.send(res, 200, { ok: true, keyConfigured: !!L.cfg('GROQ_API_KEY'), time: Date.now() });
};
