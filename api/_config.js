// ====== ВСЕ СЕКРЕТЫ ХРАНЯТСЯ ЗДЕСЬ (только на сервере) ======
// Этот файл НЕ отправляется в браузер. Репозиторий на GitHub делайте ПРИВАТНЫМ.
module.exports = {
  GROQ_API_KEY: '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',
  ADMIN_LOGIN: 'admin',
  ADMIN_PASSWORD: 'aka29072012',
  // --- MySQL (необязательно: пока MYSQL_HOST пустой, сайт работает без базы) ---
  MYSQL_HOST: 'isphg.hostgta.net',        // например: gateway01.eu-central-1.prod.aws.tidbcloud.com
  MYSQL_PORT: 3306,
  MYSQL_USER: 'whg125718_kosta',
  MYSQL_PASSWORD: 'oEDchyw05Ex8XE8u',
  MYSQL_DATABASE: 'whg125718_kosta',
  MYSQL_SSL: 'verify',   // 'verify' — шифрование с проверкой (по умолчанию), 'noverify' — без проверки сертификата, 'off' — без шифрования
  ADMIN_SECRET: '5b2a9e3a300ffcec3b37c0ab33f19a4743f43282472055e0' // любая длинная случайная строка, подписывает сессию админа
};
