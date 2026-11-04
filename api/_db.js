// Слой работы с MySQL. Таблицы создаются автоматически при первом обращении.
const L = require('./_lib');
let pool = null, ready = null;

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS kv (k VARCHAR(64) NOT NULL PRIMARY KEY, v MEDIUMTEXT NOT NULL, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'CREATE TABLE IF NOT EXISTS chats (client_id CHAR(32) NOT NULL, chat_id VARCHAR(40) NOT NULL, title VARCHAR(120) NOT NULL, data MEDIUMTEXT NOT NULL, updated_at BIGINT NOT NULL, PRIMARY KEY (client_id, chat_id), KEY idx_client (client_id, updated_at)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
  'CREATE TABLE IF NOT EXISTS usage_log (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, kind VARCHAR(16) NOT NULL, model VARCHAR(64) NULL, ok TINYINT(1) NOT NULL, ms INT NOT NULL DEFAULT 0, code VARCHAR(40) NULL, msg VARCHAR(255) NULL, KEY idx_ts (ts)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
];

function enabled() { return !!(L.cfg('MYSQL_HOST') && L.cfg('MYSQL_USER') && L.cfg('MYSQL_DATABASE')); }

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
  if (!ready) ready = (async () => { for (const s of SCHEMA) await getPool().query(s); })().catch(e => { ready = null; throw e; });
  return ready;
}

async function query(sql, params) {
  await init();
  const r = await getPool().query(sql, params || []);
  return r[0];
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

module.exports = { enabled, query, logUsage };
