// ====== ВСЕ СЕКРЕТЫ ХРАНЯТСЯ ЗДЕСЬ (только на сервере) ======
// Этот файл НЕ отправляется в браузер. Репозиторий на GitHub делайте ПРИВАТНЫМ.
module.exports = {
  // --- Groq ---
  GROQ_API_KEY: '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',

  // --- Админ-панель ---
  ADMIN_LOGIN: 'admin',
  ADMIN_PASSWORD: 'aka29072012',
  ADMIN_SECRET: '5b2a9e3a300ffcec3b37c0ab33f19a4743f43282472055e0', // любая длинная случайная строка, подписывает сессию админа

  // --- MySQL (облачная, например Aiven) ---
  // Пока MYSQL_HOST пустой, сайт работает без базы (без облака чатов и общих настроек админки).
  MYSQL_HOST: 'mysql-23b8fc45-alisevickosta-750e.k.aivencloud.com',           // из панели, например: mysql-xxxx-проект.aivencloud.com
  MYSQL_PORT: 13322,         // порт ИЗ ПАНЕЛИ (у Aiven он нестандартный, не 3306)
  MYSQL_USER: 'avnadmin',
  MYSQL_PASSWORD: 'AVNS_kwTp5C6d-e8ffHrjkeu',       // пароль из панели
  MYSQL_DATABASE: 'defaultdb',
  MYSQL_SSL: 'noverify',    // 'noverify' — шифрование без проверки сертификата (нужно для Aiven); 'verify' — со строгой проверкой; 'off' — без шифрования

  // --- Мост через хостинг: больше не используется, ДОЛЖЕН быть пустым ---
  BRIDGE_URL: '',
  BRIDGE_SECRET: '803d9248af7ea30740907f60f93bb93e7b248c3b1e4d398f'
};
