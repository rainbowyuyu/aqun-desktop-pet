/** 空闲话语编排 — 关心 / 热梗 / 天气建议，频率可控 */
import { pickBubbleLine } from './bubbleCopy.js';

export class ChatterComposer {
  constructor({ chatterFeed, weatherFeed, getSettings, getBubbleContext }) {
    this.chatterFeed = chatterFeed;
    this.weatherFeed = weatherFeed;
    this.getSettings = getSettings;
    this.getBubbleContext = getBubbleContext;
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

  pickLine(category, ctx) {
    if (category !== 'idle') return null;
    const s = this.getSettings?.() || {};
    if (s.idleChatter === false) return null;

    const context = ctx || this.getBubbleContext?.() || {};
    const roll = Math.random();

    if (roll < 0.1) {
      const tip = this.weatherFeed.pickLine();
      if (tip) return tip;
    }

    if (s.networkChatter !== false && roll < 0.24) {
      const hot = this.chatterFeed.pickLine(category);
      if (hot) return hot;
    }

    if (roll < 0.38) {
      return pickBubbleLine('idle', context);
    }

    return null;
  }
}
