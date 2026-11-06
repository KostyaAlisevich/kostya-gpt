// Слой работы с MySQL. Таблицы создаются автоматически при первом обращении.
const L = require('./_lib');
let pool = null, ready = null, downUntil = 0; // downUntil: «предохранитель» — после сбоя соединения база не трогается 60 секунд

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (k VARCHAR(64) NOT NULL PRIMARY KEY, v MEDIUMTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'CREATE TABLE IF NOT EXISTS chats (client_id CHAR(32) NOT NULL, chat_id VARCHAR(40) NOT NULL, title VARCHAR(120) NOT NULL, data MEDIUMTEXT NOT NULL, updated_at BIGINT NOT NULL, PRIMARY KEY (client_id, chat_id), KEY idx_client (client_id, updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'CREATE TABLE IF NOT EXISTS usage_log (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, kind VARCHAR(16) NOT NULL, model VARCHAR(64) NULL, ok TINYINT(1) NOT NULL, ms INT NOT NULL DEFAULT 0, code VARCHAR(40) NULL, msg VARCHAR(255) NULL, KEY idx_ts (ts)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
];

function bridgeOn() { return !!(L.cfg('BRIDGE_URL') && L.cfg('BRIDGE_SECRET')); }
function enabled() { return bridgeOn() || !!(L.cfg('MYSQL_HOST') && L.cfg('MYSQL_USER') && L.cfg('MYSQL_DATABASE')); }

// Режим «мост»: запросы идут через PHP-файл на хостинге, где MySQL доступна только локально
async function bridgeQuery(sql, params) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    let r;
    try {
      // SQL и данные упаковываются в base64: защита хостинга (WAF) не принимает их за атаку
      const payload = Buffer.from(JSON.stringify({ secret: L.cfg('BRIDGE_SECRET'), sql, params: params || [] })).toString('base64');
      r = await fetch(L.cfg('BRIDGE_URL'), { method: 'POST', redirect: 'manual', signal: ctrl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; KostaGPT-Bridge/1.0)' }, body: 'p=' + encodeURIComponent(payload) });
    } catch (e) { const x = new Error(e && e.name === 'AbortError' ? 'Мост не ответил вовремя' : 'Нет связи с мостом (проверьте BRIDGE_URL)'); x.code = 'BRIDGE_NETWORK'; x.fatal = true; throw x; }
    if (r.status >= 300 && r.status < 400) { const x = new Error('Адрес перенаправляет на «' + (r.headers.get('location') || '?') + '». Впишите в BRIDGE_URL конечный адрес (https, с www или без — как в браузере).'); x.code = 'BRIDGE_REDIRECT'; x.fatal = true; throw x; }
    const txt = await r.text(); let d = null;
    try { d = JSON.parse(txt); } catch (e) {
      // лишний текст или невидимые символы вокруг JSON (BOM, предупреждения PHP) — вырезаем сам JSON
      const i = txt.indexOf('{'), j = txt.lastIndexOf('}');
      if (i >= 0 && j > i) { try { d = JSON.parse(txt.slice(i, j + 1)); } catch (e2) {} }
    }
    if (d && !(Array.isArray(d.rows) || typeof d.error === 'string')) d = null;
    if (!d || typeof d !== 'object') { const x = new Error('Мост ответил HTTP ' + r.status + ', но не JSON. Страница: «' + txt.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) + '»'); x.code = 'BRIDGE_BADREPLY'; x.fatal = true; throw x; }
    if (!r.ok || d.error) { const x = new Error(d.error || ('Мост ответил HTTP ' + r.status)); x.code = d.code || ('BRIDGE_' + r.status); x.fatal = d.code !== 'SQL'; throw x; }
    return d.rows || [];
  } finally { clearTimeout(t); }
}
async function exec(sql, params) { return bridgeOn() ? bridgeQuery(sql, params) : (await getPool().query(sql, params || []))[0]; }

function getPool() {
  if (pool) return pool;
  const mysql = require('mysql2/promise'); // подключается только когда база реально нужна
  const mode = String(L.cfg('MYSQL_SSL') || 'verify');
  pool = mysql.createPool({
    host: L.cfg('MYSQL_HOST'), port: Number(L.cfg('MYSQL_PORT')) || 3306,
    user: L.cfg('MYSQL_USER'), password: L.cfg('MYSQL_PASSWORD'), database: L.cfg('MYSQL_DATABASE'),
    charset: 'utf8mb4', waitForConnections: true, connectionLimit: 2, connectTimeout: 8000,
    ssl: mode === 'off' ? undefined : { minVersion: 'TLSv1.2', rejectUnauthorized: mode !== 'noverify' }
  });
  return pool;
}

async function init() {
  if (!ready) ready = (async () => { for (const s of SCHEMA) await exec(s); })().catch(e => { ready = null; throw e; });
  return ready;
}

async function query(sql, params, force) {
  if (!force && Date.now() < downUntil) throw new Error('db_down');
  try {
    await init();
    const r = await exec(sql, params);
    downUntil = 0;
    return r;
  } catch (e) {
    if (e && (e.fatal || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].indexOf(e.code) >= 0)) downUntil = Date.now() + 60000;
    throw e;
  }
}

// Журнал запросов: ошибки базы никогда не ломают ответ пользователю
async function logUsage(row) {
  if (!enabled()) return;
  try {
    await Promise.race([
      query('INSERT INTO usage_log (kind, model, ok, ms, code, msg) VALUES (?,?,?,?,?,?)',
        [row.kind, row.model || null, row.ok ? 1 : 0, row.ms || 0, row.code || null, row.msg ? String(row.msg).slice(0, 255) : null]),
      new Promise(r => setTimeout(r, 1500))
    ]);
    if (Math.random() < 0.01) await query('DELETE FROM usage_log WHERE ts < NOW() - INTERVAL 30 DAY');
  } catch (e) { /* игнорируем */ }
}

module.exports = { enabled, bridgeOn, query, logUsage };
