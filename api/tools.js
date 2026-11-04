// POST /api/tools { tool: 'weather' | 'news', q: '...' } -> { md: '...' }
// Погода: Open-Meteo (без ключа). Новости: RSS Google Новостей (без ключа).
const L = require('./_lib');

const CODES = { 0:['☀️','ясно'],1:['🌤','преимущественно ясно'],2:['⛅','переменная облачность'],3:['☁️','пасмурно'],45:['🌫','туман'],48:['🌫','изморозь'],
  51:['🌦','лёгкая морось'],53:['🌦','морось'],55:['🌦','сильная морось'],56:['🌧','ледяная морось'],57:['🌧','ледяная морось'],
  61:['🌧','небольшой дождь'],63:['🌧','дождь'],65:['🌧','сильный дождь'],66:['🌧','ледяной дождь'],67:['🌧','ледяной дождь'],
  71:['🌨','небольшой снег'],73:['🌨','снег'],75:['❄️','сильный снег'],77:['❄️','снежная крупа'],80:['🌦','ливень'],81:['🌧','сильный ливень'],82:['⛈','очень сильный ливень'],
  85:['🌨','снегопад'],86:['❄️','сильный снегопад'],95:['⛈','гроза'],96:['⛈','гроза с градом'],99:['⛈','сильная гроза с градом'] };
const wc = c => CODES[c] || ['🌡', 'без описания'];

async function getText(url, ms) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (KOSTA-GPT)', Accept: '*/*' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}

async function weather(q) {
  const g = JSON.parse(await getText('https://geocoding-api.open-meteo.com/v1/search?count=1&language=ru&format=json&name=' + encodeURIComponent(q)));
  const p = g.results && g.results[0];
  if (!p) return '🔎 Не нашёл город «' + q.replace(/[`*]/g, '') + '». Проверьте название.';
  const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.latitude + '&longitude=' + p.longitude +
    '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&wind_speed_unit=ms&timezone=auto&forecast_days=3';
  const f = JSON.parse(await getText(url));
  const c = f.current, d = f.daily, cw = wc(c.weather_code);
  const place = [p.name, p.admin1 && p.admin1 !== p.name ? p.admin1 : '', p.country].filter(Boolean).join(', ');
  const day = (iso, i) => i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : new Date(iso + 'T00:00:00Z').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  let md = '## ' + cw[0] + ' Погода: ' + place + '\n\n**Сейчас: ' + Math.round(c.temperature_2m) + ' °C**, ' + cw[1] + ' (ощущается как ' + Math.round(c.apparent_temperature) + ' °C)\n' +
    '- 💧 Влажность: ' + Math.round(c.relative_humidity_2m) + '%\n- 💨 Ветер: ' + Math.round(c.wind_speed_10m) + ' м/с\n\n' +
    '| День | Погода | Мин | Макс | Осадки |\n|---|---|---|---|---|\n';
  d.time.forEach((iso, i) => {
    const w = wc(d.weather_code[i]);
    md += '| ' + day(iso, i) + ' | ' + w[0] + ' ' + w[1] + ' | ' + Math.round(d.temperature_2m_min[i]) + ' °C | ' + Math.round(d.temperature_2m_max[i]) + ' °C | ' + (d.precipitation_probability_max[i] == null ? '—' : d.precipitation_probability_max[i] + '%') + ' |\n';
  });
  return md + '\n*Данные: Open-Meteo*';
}

const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (x, t) => { const m = new RegExp('<' + t + '[^>]*>([\\s\\S]*?)</' + t + '>').exec(x); return m ? decode(m[1]) : ''; };

async function news(q) {
  const xml = await getText('https://news.google.com/rss/search?hl=ru&gl=RU&ceid=RU:ru&q=' + encodeURIComponent(q), 9000);
  const items = []; const re = /<item>([\s\S]*?)<\/item>/g; let m;
  while ((m = re.exec(xml)) && items.length < 7) {
    const src = tag(m[1], 'source'); let title = tag(m[1], 'title');
    if (src && title.slice(-(src.length + 3)) === ' - ' + src) title = title.slice(0, -(src.length + 3));
    const link = tag(m[1], 'link'); if (!/^https?:\/\//.test(link)) continue;
    const date = tag(m[1], 'pubDate'); let ds = '';
    if (date) { const dt = new Date(date); if (!isNaN(dt)) ds = dt.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }); }
    items.push('1. [' + title.replace(/[\[\]*]/g, '') + '](' + link.replace(/[()\s]/g, '') + ')' + (src || ds ? ' — *' + [src.replace(/\*/g, ''), ds].filter(Boolean).join(', ') + '*' : ''));
  }
  if (!items.length) return '🔎 По теме «' + q.replace(/[`*]/g, '') + '» ничего не нашёл.';
  return '## 📰 Новости: ' + q.replace(/[`*#]/g, '') + '\n\n' + items.join('\n') + '\n\n*Источник: Google Новости*';
}

module.exports = async function (req, res) {
  if (req.method !== 'POST') return L.send(res, 405, { error: 'Метод не разрешён' });
  if (!L.checkOrigin(req)) return L.send(res, 403, { error: 'Запрещённый источник запроса' });
  if (!L.rateLimit('tools:' + L.getIp(req), 15, 60000)) return L.send(res, 429, { error: 'Слишком много запросов. Подождите минуту.' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
  const q = String(b.q || '').replace(/[\u0000-\u001f]/g, ' ').trim();
  if (!q || q.length > 80) return L.send(res, 400, { error: 'Запрос должен быть от 1 до 80 символов' });
  try {
    if (b.tool === 'weather') return L.send(res, 200, { md: await weather(q) });
    if (b.tool === 'news') return L.send(res, 200, { md: await news(q) });
    return L.send(res, 400, { error: 'Неизвестный инструмент' });
  } catch (e) {
    return L.send(res, 502, { error: 'Внешний сервис сейчас недоступен. Попробуйте позже.' });
  }
};
