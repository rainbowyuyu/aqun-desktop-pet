import { DEFAULT_WEATHER_LOCATION } from './locationDefaults.js';

const LOCATE_STALE_MS = 6 * 60 * 60 * 1000;
let locatePromise = null;

function geoErrorMessage(code) {
  if (code === 1) return '定位被拒绝，请在 Windows 设置 → 隐私和安全性 → 位置 中开启';
  if (code === 2) return '暂时无法获取位置';
  if (code === 3) return '定位超时，请稍后重试';
  return '定位失败';
}

export function shouldAutoLocate(settings = {}) {
  if (settings.weatherAutoLocate === false) return false;
  if (settings.weatherLat == null || settings.weatherLon == null) return true;
  const at = settings.weatherLocatedAt;
  if (!at) return true;
  return Date.now() - at > LOCATE_STALE_MS;
}

export function locationPayload(loc) {
  return {
    weatherCity: loc.city,
    weatherLat: loc.lat,
    weatherLon: loc.lon,
    weatherLocatedAt: Date.now(),
  };
}

export async function getCurrentPosition() {
  if (window.aqunPet?.getDeviceLocation) {
    try {
      const pos = await window.aqunPet.getDeviceLocation();
      if (pos?.lat != null && pos?.lon != null) {
        return {
          lat: pos.lat,
          lon: pos.lon,
          accuracy: pos.accuracy,
          source: pos.source || 'gps',
        };
      }
    } catch (err) {
      if (!navigator.geolocation) {
        throw new Error(err?.message || geoErrorMessage(err?.code));
      }
    }
  }

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前环境不支持定位'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps',
        });
      },
      (err) => {
        reject(new Error(geoErrorMessage(err.code)));
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 },
    );
  });
}

export async function reverseGeocode(lat, lon) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/reverse');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  const data = await res.json();
  const hit = data?.results?.[0];
  if (!hit) throw new Error('无法解析当前位置');

  const name = hit.name || hit.admin1 || '当前位置';
  const admin = hit.admin1 && hit.name !== hit.admin1 ? hit.admin1 : '';
  return {
    name,
    label: admin ? `${name} · ${admin}` : name,
    lat: hit.latitude ?? lat,
    lon: hit.longitude ?? lon,
  };
}

export function getDefaultLocation() {
  return { ...DEFAULT_WEATHER_LOCATION };
}

export async function locateCity() {
  try {
    const pos = await getCurrentPosition();
    const geo = await reverseGeocode(pos.lat, pos.lon);
    return {
      city: geo.name,
      label: geo.label,
      lat: geo.lat,
      lon: geo.lon,
      source: pos.source || 'gps',
    };
  } catch {
    return getDefaultLocation();
  }
}

export async function locateCitySafe() {
  if (locatePromise) return locatePromise;
  locatePromise = locateCity().finally(() => {
    locatePromise = null;
  });
  return locatePromise;
}
