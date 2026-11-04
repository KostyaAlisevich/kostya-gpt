// POST /api/sync { id, action: 'pull' | 'push' | 'delete', chats?, chatId? }
// id — случайный код устройства (32 hex). Фото в облако не сохраняются.
const L = require('./_lib');
const D = require('./_db');
const ID_RE = /^[a-f0-9]{32}$/;
const CID_RE = /^[\w-]{1,40}$/;

function cleanChat(c) {
  if (!c || typeof c.id !== 'string' || !CID_RE.test(c.id) || !Array.isArray(c.messages)) return null;
  const messages = c.messages.slice(-200)
    .filter(m => m && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: String(m.content == null ? '' : m.content).slice(0, 20000), err: m.err ? 1 : 0 }));
  const data = JSON.stringify(messages);
  if (data.length > 400000) return null;
  const updatedAt = Number(c.updatedAt);
  return { id: c.id, title: String(c.title || 'Чат').slice(0, 120), data, updatedAt: isFinite(updatedAt) && updatedAt > 0 ? Math.floor(updatedAt) : Date.now() };
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Метод не разрешён' });
  if (!L.checkOrigin(req)) return L.send(res, 403, { error: 'Запрещённый источник запроса' });
  if (!L.rateLimit('sync:' + L.getIp(req), 40, 60000)) return L.send(res, 429, { error: 'Слишком много запросов' });
  if (!D.enabled()) return L.send(res, 503, { error: 'db_disabled' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  if (!ID_RE.test(String(b.id || ''))) return L.send(res, 400, { error: 'Неверный код синхронизации' });
  try {
    if (b.action === 'pull') {
      const rows = await D.query('SELECT chat_id, title, data, updated_at FROM chats WHERE client_id = ? ORDER BY updated_at DESC LIMIT 100', [b.id]);
      const chats = rows.map(r => { let m = []; try { m = JSON.parse(r.data); } catch (e) {} return { id: r.chat_id, title: r.title, updatedAt: Number(r.updated_at), messages: m }; });
      return L.send(res, 200, { chats });
    }
    if (b.action === 'push') {
      let saved = 0;
      for (const raw of (Array.isArray(b.chats) ? b.chats.slice(0, 20) : [])) {
        const c = cleanChat(raw); if (!c) continue;
        await D.query(
          'INSERT INTO chats (client_id, chat_id, title, data, updated_at) VALUES (?,?,?,?,?) ' +
          'ON DUPLICATE KEY UPDATE title = IF(VALUES(updated_at) >= updated_at, VALUES(title), title), ' +
          'data = IF(VALUES(updated_at) >= updated_at, VALUES(data), data), updated_at = GREATEST(updated_at, VALUES(updated_at))',
          [b.id, c.id, c.title, c.data, c.updatedAt]);
        saved++;
      }
      return L.send(res, 200, { saved });
    }
    if (b.action === 'delete') {
      if (!CID_RE.test(String(b.chatId || ''))) return L.send(res, 400, { error: 'Неверный чат' });
      await D.query('DELETE FROM chats WHERE client_id = ? AND chat_id = ?', [b.id, b.chatId]);
      return L.send(res, 200, { ok: true });
    }
    return L.send(res, 400, { error: 'Неизвестное действие' });
  } catch (e) {
    return L.send(res, 500, { error: 'Ошибка базы данных' });
  }
};
