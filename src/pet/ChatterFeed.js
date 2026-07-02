/** 联网热梗 / 热点 — 可选，失败时静默 */
const CACHE_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT = 8000;

const HOT_APIS = [
  async () => {
    const res = await fetchWithTimeout('https://api.vvhan.com/api/hotlist/weibo');
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.data)) return [];
    return data.data.slice(0, 15).map((item) => {
      const title = item.title || item.name || item.hot;
      return title ? `听说：${String(title).slice(0, 28)}` : null;
    }).filter(Boolean);
  },
  async () => {
    const res = await fetchWithTimeout('https://api.vvhan.com/api/hotlist/zhihu');
    const data = await res.json();
    if (!Array.isArray(data?.data)) return [];
    return data.data.slice(0, 10).map((item) => {
      const t = item.title || item.name;
      return t ? `知乎热榜：${String(t).slice(0, 24)}` : null;
    }).filter(Boolean);
  },
];

async function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class ChatterFeed {
  constructor() {
    this._pool = [];
    this._lastFetch = 0;
    this._fetching = false;
    this._enabled = false;
  }

  setEnabled(on) {
    this._enabled = Boolean(on);
    if (this._enabled) this.refresh();
  }

  getExtras() {
    return this._pool;
  }

  async refresh() {
    if (!this._enabled || this._fetching) return;
    if (Date.now() - this._lastFetch < CACHE_MS && this._pool.length) return;

    this._fetching = true;
    try {
      for (const api of HOT_APIS) {
        try {
          const lines = await api();
          if (lines.length) {
            this._pool = lines;
            this._lastFetch = Date.now();
            break;
          }
        } catch {
          /* try next */
        }
      }
    } finally {
      this._fetching = false;
    }
  }

  pickLine(category) {
    if (!this._pool.length || category !== 'idle') return null;
    return this._pool[Math.floor(Math.random() * this._pool.length)];
  }
}
