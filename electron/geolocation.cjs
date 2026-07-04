const { DEFAULT_WEATHER_LOCATION } = require('./locationDefaults.cjs');

const GEO_SCRIPT = `
new Promise(async (resolve, reject) => {
  if (!navigator.geolocation) {
    reject({ code: 0, message: '当前环境不支持定位' });
    return;
  }
  const tryGet = (opts) => new Promise((res, rej) => {
    navigator.geolocation.getCurrentPosition(
      (p) => res({
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accuracy: p.coords.accuracy,
        source: 'gps',
      }),
      (e) => rej(e),
      opts,
    );
  });
  const msg = (e) => {
    const denied =
      process.platform === 'darwin'
        ? '定位被拒绝，请在 系统设置 → 隐私与安全性 → 定位服务 中开启'
        : '定位被拒绝，请在 Windows 设置 → 隐私和安全性 → 位置 中开启';
    return e.code === 1
      ? denied
      : e.code === 2
        ? '暂时无法获取位置'
        : e.code === 3
          ? '定位超时，请稍后重试'
          : '定位失败';
  };
  try {
    resolve(await tryGet({ enableHighAccuracy: false, timeout: 12000, maximumAge: 900000 }));
  } catch (e1) {
    try {
      resolve(await tryGet({ enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 }));
    } catch (e2) {
      reject({ code: e2.code, message: msg(e2) });
    }
  }
})
`;

const IP_SOURCES = [
  async () => {
    const res = await fetchWithTimeout('https://ipwho.is/?lang=zh-CN');
    const data = await res.json();
    if (!data?.success || data.latitude == null) throw new Error('ipwho fail');
    return {
      lat: data.latitude,
      lon: data.longitude,
      accuracy: 40000,
      source: 'ip',
    };
  },
  async () => {
    const res = await fetchWithTimeout(
      'https://ip-api.com/json/?fields=status,lat,lon&lang=zh-CN',
    );
    const data = await res.json();
    if (data.status !== 'success') throw new Error('ip-api fail');
    return {
      lat: data.lat,
      lon: data.lon,
      accuracy: 40000,
      source: 'ip',
    };
  },
];

async function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function setupGeolocationPermissions(sess) {
  if (!sess) return;
  sess.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'geolocation');
  });
  sess.setPermissionCheckHandler((_webContents, permission) => permission === 'geolocation');
}

function pickWebContents(getters) {
  for (const get of getters) {
    const wc = get();
    if (wc && !wc.isDestroyed()) return wc;
  }
  return null;
}

async function getLocationByIp() {
  for (const source of IP_SOURCES) {
    try {
      return await source();
    } catch {
      /* try next */
    }
  }
  return {
    lat: DEFAULT_WEATHER_LOCATION.lat,
    lon: DEFAULT_WEATHER_LOCATION.lon,
    accuracy: null,
    source: 'default',
  };
}

async function getDeviceLocationFromWebContents(webContents) {
  if (!webContents || webContents.isDestroyed()) {
    throw new Error('窗口未就绪，无法定位');
  }
  try {
    return await webContents.executeJavaScript(GEO_SCRIPT, true);
  } catch (err) {
    const message = err?.message?.message || err?.message || '定位失败';
    const out = new Error(typeof message === 'string' ? message : '定位失败');
    out.code = err?.code ?? err?.message?.code;
    throw out;
  }
}

async function getDeviceLocation(webContents) {
  if (webContents && !webContents.isDestroyed()) {
    try {
      return await getDeviceLocationFromWebContents(webContents);
    } catch {
      /* IP / default fallback below */
    }
  }
  try {
    return await getLocationByIp();
  } catch {
    return {
      lat: DEFAULT_WEATHER_LOCATION.lat,
      lon: DEFAULT_WEATHER_LOCATION.lon,
      accuracy: null,
      source: 'default',
    };
  }
}

module.exports = {
  setupGeolocationPermissions,
  pickWebContents,
  getDeviceLocation,
  getLocationByIp,
};
