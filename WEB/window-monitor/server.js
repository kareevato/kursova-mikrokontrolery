const path = require('path');
const fs = require('fs');
const express = require('express');
const Database = require('better-sqlite3');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'window_monitor.db');

const SERIAL_PATH = process.env.SERIAL_PATH || '/dev/cu.usbserial-0001';
const SERIAL_BAUD = parseInt(process.env.SERIAL_BAUD || '115200', 10);
const SERIAL_ENABLE = process.env.SERIAL_ENABLE !== '0' && process.env.SERIAL_ENABLE !== 'false';
const LIGHT_THRESHOLD = parseInt(process.env.LIGHT_THRESHOLD || '4000', 10);
const DEVICE_NAME = process.env.DEVICE_NAME || 'Light_Sensor_ESP32';

const app = express();
app.use(express.json());

const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);

db.exec(`
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
`);

db.prepare(
  `INSERT OR IGNORE INTO live_sensor (id, device_name, light_level, status_value, event_time)
   VALUES (1, ?, 0, 'CLOSED', ?)`
).run(DEVICE_NAME, new Date().toISOString());

const insertLog = db.prepare(
  'INSERT INTO logs (device_name, status_value, event_time) VALUES (?, ?, ?)'
);

const upsertLive = db.prepare(`
  INSERT INTO live_sensor (id, device_name, light_level, status_value, event_time)
  VALUES (1, @deviceName, @lightLevel, @statusValue, @eventTime)
  ON CONFLICT(id) DO UPDATE SET
    device_name = excluded.device_name,
    light_level = excluded.light_level,
    status_value = excluded.status_value,
    event_time = excluded.event_time
`);

function nowIso() {
  return new Date().toISOString();
}

const sseClients = new Set();
let lastLiveBroadcast = 0;
const LIVE_SSE_MS = 120;

function sseBroadcast(payload) {
  const line = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(line);
    } catch (_) {
      sseClients.delete(res);
    }
  }
}

function broadcastLivePatch(patch) {
  const t = Date.now();
  if (t - lastLiveBroadcast < LIVE_SSE_MS) return;
  lastLiveBroadcast = t;
  sseBroadcast({ type: 'live', ...patch });
}

/** Поточні показники з COM (для API) */
app.get('/api/live', (req, res) => {
  const row = db
    .prepare(
      `SELECT device_name AS deviceName, light_level AS lightLevel,
              status_value AS statusValue, event_time AS eventTime
       FROM live_sensor WHERE id = 1`
    )
    .get();
  res.json(row || null);
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.get('/api/latest', (req, res) => {
  const row = db
    .prepare(
      'SELECT device_name AS deviceName, status_value AS statusValue, event_time AS eventTime FROM logs ORDER BY id DESC LIMIT 1'
    )
    .get();
  res.json(row || null);
});

app.get('/api/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const rows = db
    .prepare(
      `SELECT id, device_name AS deviceName, status_value AS statusValue, event_time AS eventTime
       FROM logs ORDER BY id DESC LIMIT ?`
    )
    .all(limit);
  res.json(rows);
});

app.post('/api/status', (req, res) => {
  const status = (req.body.status || req.body.statusValue || '').toString().toUpperCase();
  if (status !== 'OPEN' && status !== 'CLOSED') {
    return res.status(400).json({ error: 'status must be OPEN or CLOSED' });
  }
  const deviceName = (req.body.deviceName || req.body.device || DEVICE_NAME).toString();
  const eventTime = req.body.eventTime || nowIso();

  insertLog.run(deviceName, status, eventTime);
  console.log(`Received from ESP32: ${status}`);
  console.log(`Saved to DB: ${status}`);
  sseBroadcast({ type: 'log' });
  res.json({ ok: true, deviceName, status, eventTime });
});

let serialStatus = { open: false, path: SERIAL_PATH, error: null };
let lastSerialStatus = null;

function parseLightLine(line) {
  const s = line.trim();
  const patterns = [
    /Рівень\s+світла:\s*(\d+)/i,
    /Light\s*level:\s*(\d+)/i,
    /ADC:\s*(\d+)/i,
    /value[=:]\s*(\d+)/i,
    /(\d{1,4})\s*$/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n >= 0 && n <= 5000) return n;
    }
  }
  return null;
}

async function logAvailableSerialPorts(context) {
  try {
    const ports = await SerialPort.list();
    const paths = ports.map((p) => p.path).filter(Boolean);
    console.log(`[serial] ${context} USB-порти:`, paths.length ? paths.join(', ') : '(немає — перевірте кабель)');
    return paths;
  } catch (e) {
    console.error('[serial] Не вдалося отримати список портів:', e.message);
    return [];
  }
}

function startSerialBridge() {
  if (!SERIAL_ENABLE) {
    console.log('[serial] Вимкнено (SERIAL_ENABLE=0 або false). Дані з ESP не читаються — перезапустіть без цієї змінної.');
    return;
  }

  const port = new SerialPort({
    path: SERIAL_PATH,
    baudRate: SERIAL_BAUD,
    autoOpen: false,
  });

  port.on('error', (e) => {
    serialStatus.error = e.message;
    console.error('[serial]', e.message);
  });

  port.open(async (err) => {
    if (err) {
      serialStatus = { open: false, path: SERIAL_PATH, error: err.message };
      console.error(`[serial] Не вдалося відкрити ${SERIAL_PATH}: ${err.message}`);
      console.error('[serial] Закрийте Serial Monitor у Arduino IDE, перевірте кабель, спробуйте інший SERIAL_PATH.');
      await logAvailableSerialPorts('Після помилки відкриття');
      return;
    }
    serialStatus = { open: true, path: SERIAL_PATH, error: null };
    console.log(`[serial] Підключено ${SERIAL_PATH} @ ${SERIAL_BAUD}, поріг ${LIGHT_THRESHOLD}`);

    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
    parser.on('data', (line) => {
      const light = parseLightLine(String(line));
      if (light === null) return;

      const statusValue = light > LIGHT_THRESHOLD ? 'OPEN' : 'CLOSED';
      const eventTime = nowIso();

      upsertLive.run({
        deviceName: DEVICE_NAME,
        lightLevel: light,
        statusValue,
        eventTime,
      });

      broadcastLivePatch({
        deviceName: DEVICE_NAME,
        lightLevel: light,
        statusValue,
        eventTime,
      });

      if (lastSerialStatus === null) {
        lastSerialStatus = statusValue;
      } else if (statusValue !== lastSerialStatus) {
        lastSerialStatus = statusValue;
        insertLog.run(DEVICE_NAME, statusValue, eventTime);
        console.log(`Saved to DB: ${statusValue} (light=${light})`);
        sseBroadcast({ type: 'log' });
      }
    });
  });
}

app.get('/api/serial', (req, res) => {
  res.json({
    ...serialStatus,
    serialEnable: SERIAL_ENABLE,
    baudRate: SERIAL_BAUD,
    hint:
      'Якщо open=false: закрийте Serial Monitor у Arduino; перевірте SERIAL_PATH (див. GET /api/ports). Якщо serialEnable=false — запустіть без SERIAL_ENABLE=0.',
  });
});

/** Список USB-послідовних портів (оберіть шлях для SERIAL_PATH) */
app.get('/api/ports', async (req, res) => {
  try {
    const ports = await SerialPort.list();
    res.json(
      ports.map((p) => ({
        path: p.path,
        manufacturer: p.manufacturer || null,
        serialNumber: p.serialNumber || null,
        vendorId: p.vendorId || null,
        productId: p.productId || null,
      }))
    );
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, async () => {
  console.log(`Server started: http://localhost:${PORT}`);
  await logAvailableSerialPorts('На старті');
  startSerialBridge();
});
