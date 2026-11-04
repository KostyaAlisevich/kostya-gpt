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
  ADMIN_SECRET: '5b2a9e3a300ffcec3b37c0ab33f19a4743f43282472055e0' // любая длинная случайная строка, подписывает сессию админа
};
