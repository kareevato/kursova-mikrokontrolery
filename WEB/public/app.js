const stateBadge = document.getElementById('stateBadge');
const lightLevelEl = document.getElementById('lightLevel');
const deviceNameEl = document.getElementById('deviceName');
const lastUpdateEl = document.getElementById('lastUpdate');
const logBody = document.getElementById('logBody');

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function setHeaderFromLive(row) {
  if (!row) {
    stateBadge.textContent = 'Немає даних';
    stateBadge.className = 'badge badge-safe';
    lightLevelEl.textContent = '—';
    deviceNameEl.textContent = '—';
    lastUpdateEl.textContent = '—';
    return;
  }
  deviceNameEl.textContent = row.deviceName || '—';
  lastUpdateEl.textContent = formatTime(row.eventTime);
  lightLevelEl.textContent = row.lightLevel != null ? String(row.lightLevel) : '—';
  const open = row.statusValue === 'OPEN';
  stateBadge.textContent = open ? 'ТРИВОГА' : 'БЕЗПЕЧНО';
  stateBadge.className = open ? 'badge badge-alarm' : 'badge badge-safe';
}

function renderLogs(rows) {
  logBody.innerHTML = '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    const status = row.statusValue === 'OPEN' ? 'OPEN' : 'CLOSED';
    const cls = status === 'OPEN' ? 'status-open' : 'status-closed';
    tr.innerHTML = `
      <td>${row.id}</td>
      <td>${escapeHtml(row.deviceName || '')}</td>
      <td class="${cls}">${status}</td>
      <td>${formatTime(row.eventTime)}</td>
    `;
    logBody.appendChild(tr);
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function fetchLogs() {
  const logsRes = await fetch('/api/logs?limit=100');
  const logs = await logsRes.json();
  renderLogs(logs);
}

async function bootstrap() {
  try {
    const liveRes = await fetch('/api/live');
    const live = await liveRes.json();
    setHeaderFromLive(live);
    await fetchLogs();
  } catch (e) {
    console.error(e);
  }
}

function connectSse() {
  const es = new EventSource('/api/events');
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'live') {
        setHeaderFromLive({
          deviceName: msg.deviceName,
          lightLevel: msg.lightLevel,
          statusValue: msg.statusValue,
          eventTime: msg.eventTime,
        });
      }
      if (msg.type === 'log') {
        fetchLogs();
      }
    } catch (e) {
      console.error(e);
    }
  };
  es.onerror = () => {
    /* браузер сам перепідключить */
  };
}

bootstrap();
connectSse();
