/** 空闲话语编排 — 关心 / 热梗 / 天气建议，频率可控 */
export class ChatterComposer {
  constructor({ chatterFeed, weatherFeed, getSettings }) {
    this.chatterFeed = chatterFeed;
    this.weatherFeed = weatherFeed;
    this.getSettings = getSettings;
  }

  setEnabled(on) {
    this.chatterFeed.setEnabled(on);
    if (on) this.refresh();
  }

  refresh() {
    const s = this.getSettings?.() || {};
    this.chatterFeed.refresh();
    this.weatherFeed.refresh({
      city: s.weatherCity,
      lat: s.weatherLat,
      lon: s.weatherLon,
    });
  }

  getExtras() {
    return [];
  }

  pickLine(category) {
    if (category !== 'idle') return null;
    const s = this.getSettings?.() || {};
    if (s.idleChatter === false) return null;

    const roll = Math.random();

    if (roll < 0.1) {
      const tip = this.weatherFeed.pickLine();
      if (tip) return tip;
    }

    if (s.networkChatter !== false && roll < 0.24) {
      const hot = this.chatterFeed.pickLine(category);
      if (hot) return hot;
    }

    return null;
  }
}
