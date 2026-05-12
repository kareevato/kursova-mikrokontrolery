-- Схема бази даних SQLite для курсової роботи (та сама, що створює server.js).
-- Файл window_monitor.db у репозиторій не потрапляє — він генерується локально після npm start.

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_name TEXT NOT NULL,
  status_value TEXT NOT NULL,
  event_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS live_sensor (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  device_name TEXT NOT NULL,
  light_level INTEGER NOT NULL,
  status_value TEXT NOT NULL,
  event_time TEXT NOT NULL
);
