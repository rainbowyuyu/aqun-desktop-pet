/** 天气相关 idle 话语 — 实用建议，非预报复读 */
import { fetchWeather, weatherTipsForBubble } from './weatherService.js';
import { DEFAULT_WEATHER_CITY, DEFAULT_WEATHER_LOCATION } from './locationDefaults.js';

const CACHE_MS = 45 * 60 * 1000;

export class WeatherFeed {
  constructor() {
    this._lines = [];
    this._lastFetch = 0;
    this._fetching = false;
    this._city = DEFAULT_WEATHER_CITY;
    this._lat = DEFAULT_WEATHER_LOCATION.lat;
    this._lon = DEFAULT_WEATHER_LOCATION.lon;
  }

  setCity(city) {
    this._city = city || DEFAULT_WEATHER_CITY;
  }

  setCoords(lat, lon) {
    this._lat = lat ?? null;
    this._lon = lon ?? null;
  }

  getExtras() {
    return [];
  }

  async refresh(opts = {}) {
    if (typeof opts === 'string') {
      this._city = opts;
    } else {
      if (opts.city) this._city = opts.city;
      if (opts.lat != null) this._lat = opts.lat;
      if (opts.lon != null) this._lon = opts.lon;
    }

    if (this._fetching) return;
    if (Date.now() - this._lastFetch < CACHE_MS && this._lines.length) return;

    this._fetching = true;
    try {
      await fetchWeather({
        city: this._lat != null ? undefined : this._city,
        lat: this._lat,
        lon: this._lon,
        force: false,
      });
      this._lines = weatherTipsForBubble();
      this._lastFetch = Date.now();
    } catch {
      this._lines = [];
    } finally {
      this._fetching = false;
    }
  }

  pickLine() {
    if (!this._lines.length) return null;
    return this._lines[Math.floor(Math.random() * this._lines.length)];
  }
}
