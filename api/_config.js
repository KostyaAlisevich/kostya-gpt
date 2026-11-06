// ====== ВСЕ СЕКРЕТЫ ХРАНЯТСЯ ЗДЕСЬ (только на сервере) ======
// Этот файл НЕ отправляется в браузер. Репозиторий на GitHub делайте ПРИВАТНЫМ.
module.exports = {
  GROQ_API_KEY: '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',
  ADMIN_LOGIN: 'admin',
  ADMIN_PASSWORD: 'aka29072012',
  // --- MySQL (необязательно: пока MYSQL_HOST пустой, сайт работает без базы) ---
  MYSQL_HOST: '',        // например: gateway01.eu-central-1.prod.aws.tidbcloud.com
  MYSQL_PORT: 3306,
  MYSQL_USER: '',
  MYSQL_PASSWORD: '',
  MYSQL_DATABASE: '',
  MYSQL_SSL: 'verify',   // 'verify' — шифрование с проверкой (по умолчанию), 'noverify' — без проверки сертификата, 'off' — без шифрования
  // --- Мост к MySQL на обычном хостинге (если база недоступна напрямую). Заполните ВМЕСТО MYSQL_* ---
  BRIDGE_URL: 'https://kosta-gpt.samp.date/kosta-db.php',        // например: https://ваш-сайт.ru/kosta-db.php
  BRIDGE_SECRET: '803d9248af7ea30740907f60f93bb93e7b248c3b1e4d398f', // должен совпадать с $SECRET в kosta-db.php
  ADMIN_SECRET: '5b2a9e3a300ffcec3b37c0ab33f19a4743f43282472055e0' // любая длинная случайная строка, подписывает сессию админа
};
