<?php
// ===== kosta-db.php — мост между сайтом на Vercel и MySQL этого хостинга =====
// Положите файл в папку любого сайта на хостинге (с HTTPS). Принимает запросы ТОЛЬКО с секретным ключом.
$SECRET  = '803d9248af7ea30740907f60f93bb93e7b248c3b1e4d398f'; // должен совпадать с BRIDGE_SECRET в api/_config.js
$DB_HOST = 'localhost';
$DB_USER = 'whg125718_kosta';
$DB_PASS = 'ВСТАВЬТЕ_ПАРОЛЬ_БАЗЫ';
$DB_NAME = 'whg125718_kosta';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');
function out($code, $arr) { http_response_code($code); echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(403, ['error' => 'forbidden', 'code' => 'AUTH']);
$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in) || !isset($in['secret']) || !hash_equals($SECRET, (string)$in['secret'])) { usleep(300000); out(403, ['error' => 'forbidden', 'code' => 'AUTH']); }

$sql = isset($in['sql']) ? (string)$in['sql'] : '';
$params = (isset($in['params']) && is_array($in['params'])) ? array_values($in['params']) : [];
if ($sql === '' || strlen($sql) > 2000 || count($params) > 12) out(400, ['error' => 'bad request', 'code' => 'SQL']);
// Разрешены только обычные запросы KOSTA GPT, строго один оператор
if (!preg_match('/^\s*(SELECT|INSERT INTO|DELETE FROM|CREATE TABLE IF NOT EXISTS)\s/i', $sql)
    || strpos($sql, ';') !== false
    || preg_match('/information_schema|mysql\.|outfile|dumpfile|load_file|sleep\s*\(|benchmark\s*\(/i', $sql)) {
  out(400, ['error' => 'sql not allowed', 'code' => 'SQL']);
}

mysqli_report(MYSQLI_REPORT_OFF);
$m = @new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);
if ($m->connect_errno) out(500, ['error' => 'Подключение к MySQL: ' . $m->connect_error, 'code' => 'DB_CONNECT']);
$m->set_charset('utf8mb4');
$stmt = $m->prepare($sql);
if (!$stmt) out(500, ['error' => $m->error, 'code' => 'SQL']);
if ($params) {
  $vals = [];
  foreach ($params as $p) $vals[] = is_null($p) ? null : (string)$p;
  $stmt->bind_param(str_repeat('s', count($vals)), ...$vals);
}
if (!$stmt->execute()) out(500, ['error' => $stmt->error, 'code' => 'SQL']);
if (!method_exists($stmt, 'get_result')) out(500, ['error' => 'На хостинге нет mysqlnd', 'code' => 'DB_DRIVER']);
$res = $stmt->get_result();
out(200, ['rows' => $res ? $res->fetch_all(MYSQLI_ASSOC) : [], 'affected' => $stmt->affected_rows]);
