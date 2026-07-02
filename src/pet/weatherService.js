/** Open-Meteo 天气 — 无需 API Key */
const CACHE_MS = 45 * 60 * 1000;
const WMO = {
  0: '晴', 1: '大部晴朗', 2: '多云', 3: '阴',
  45: '雾', 48: '雾凇', 51: '小毛毛雨', 53: '毛毛雨', 55: '大毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 71: '小雪', 73: '中雪', 75: '大雪',
  80: '阵雨', 81: '强阵雨', 82: '暴雨', 95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴大冰雹',
};

let _cache = { at: 0, city: '', lat: null, lon: null, daily: [], current: null };

function wmoLabel(code) {
  return WMO[code] ?? '未知';
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function geocodeCity(name) {
  const q = String(name || '').trim();
  if (!q) return null;
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=3&language=zh&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  const hit = data?.results?.[0];
  if (!hit) return null;
  return {
    name: hit.name,
    admin: hit.admin1 || '',
    lat: hit.latitude,
    lon: hit.longitude,
  };
}

export async function fetchWeather({ city, lat, lon, force = false } = {}) {
  const now = Date.now();
  if (!force && _cache.at && now - _cache.at < CACHE_MS && _cache.daily.length) {
    if (city && _cache.city === city) return _cache;
    if (lat != null && lon != null && _cache.lat === lat && _cache.lon === lon) return _cache;
  }

  let resolvedLat = lat;
  let resolvedLon = lon;
  let label = city || '';

  if ((resolvedLat == null || resolvedLon == null) && city) {
    const geo = await geocodeCity(city);
    if (!geo) throw new Error(`找不到城市「${city}」`);
    resolvedLat = geo.lat;
    resolvedLon = geo.lon;
    label = geo.admin ? `${geo.name} · ${geo.admin}` : geo.name;
  }

  if (resolvedLat == null || resolvedLon == null) {
    throw new Error('请设置城市名称');
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(resolvedLat));
  url.searchParams.set('longitude', String(resolvedLon));
  url.searchParams.set('timezone', 'Asia/Shanghai');
  url.searchParams.set('current', 'temperature_2m,weathercode,relative_humidity_2m,wind_speed_10m');
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max');

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!data?.daily?.time?.length) throw new Error('天气数据获取失败');

  const daily = data.daily.time.map((key, i) => ({
    date: key,
    code: data.daily.weathercode[i],
    label: wmoLabel(data.daily.weathercode[i]),
    max: Math.round(data.daily.temperature_2m_max[i]),
    min: Math.round(data.daily.temperature_2m_min[i]),
    rainPct: data.daily.precipitation_probability_max?.[i] ?? null,
  }));

  _cache = {
    at: now,
    city: city || label,
    label,
    lat: resolvedLat,
    lon: resolvedLon,
    daily,
    current: data.current
      ? {
          temp: Math.round(data.current.temperature_2m),
          code: data.current.weathercode,
          label: wmoLabel(data.current.weathercode),
          humidity: data.current.relative_humidity_2m,
          wind: Math.round(data.current.wind_speed_10m),
        }
      : null,
  };
  return _cache;
}

export function getCachedWeather() {
  return _cache;
}

export function weatherForDate(key) {
  if (!_cache.daily.length) return null;
  return _cache.daily.find((d) => d.date === key) || null;
}

export function weatherTipsForBubble() {
  const c = _cache.current;
  const d = _cache.daily?.[0];
  const tomorrow = _cache.daily?.[1];
  if (!c) return [];

  const tips = [];

  if (c.temp >= 33) tips.push('今天很热，记得防暑、多喝水');
  else if (c.temp >= 28) tips.push('气温偏高，出门注意防晒和补水');
  else if (c.temp <= 0) tips.push('零度以下了，厚外套和围巾安排上');
  else if (c.temp <= 8) tips.push('有点冷，多穿一件再出门');
  else if (c.temp <= 14) tips.push('早晚温差大，带件外套比较稳妥');

  if (c.code >= 95) tips.push('可能有雷暴，尽量待在室内');
  else if (c.code >= 61 && c.code <= 82) tips.push('可能要下雨，伞记得带上');
  else if (c.code >= 51 && c.code <= 57) tips.push('有小雨，出门不妨带把伞');
  else if (c.code >= 71 && c.code <= 77) tips.push('下雪或雨夹雪，注意保暖和防滑');
  else if (c.code === 45 || c.code === 48) tips.push('有雾，出行注意安全');
  else if ((c.code === 0 || c.code === 1) && c.temp >= 20) tips.push('阳光不错，户外活动记得涂防晒');

  if (c.wind >= 28) tips.push('风挺大的，帽子和发型都要Hold住');
  if (c.humidity >= 80 && c.temp >= 24) tips.push('湿度偏高，注意通风和补水');
  if (d?.rainPct != null && d.rainPct >= 55) tips.push('今天降水概率不低，伞可以常备');
  if (tomorrow?.rainPct != null && tomorrow.rainPct >= 60) tips.push('明天可能下雨，今晚可以把伞放门口');

  if (!tips.length) {
    tips.push('出门前瞄一眼天气，总不会错');
    tips.push('不管天气怎样，记得照顾好自己');
  }

  return tips;
}

export function weatherLineForBubble() {
  const tips = weatherTipsForBubble();
  if (!tips.length) return null;
  return tips[Math.floor(Math.random() * tips.length)];
}

export function weatherLinesForDayInfo(key) {
  const lines = [];
  const day = weatherForDate(key);
  const today = dateKey(new Date());
  if (key === today && _cache.current) {
    lines.push({
      kind: 'weather',
      text: `现在 ${_cache.current.temp}°C · ${_cache.current.label}${_cache.label ? ` · ${_cache.label}` : ''}`,
    });
  }
  if (day) {
    const rain = day.rainPct != null && day.rainPct >= 40 ? ` · 降水 ${day.rainPct}%` : '';
    lines.push({
      kind: 'weather',
      text: `预报 ${day.label} ${day.min}~${day.max}°C${rain}`,
    });
  }
  return lines;
}
