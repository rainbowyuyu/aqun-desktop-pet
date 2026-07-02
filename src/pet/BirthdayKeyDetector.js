import { normalizeKeyName } from './KeyReactionMap.js';

/** 连续按键彩蛋 — 不区分大小写 */
const SECRETS = [
  { id: 'happy', keys: ['H', 'A', 'P', 'P', 'Y'] },
  { id: 'aqun', keys: ['A', 'Q', 'U', 'N'] },
  { id: 'bday', keys: ['B', 'D', 'A', 'Y'] },
  { id: 'love', keys: ['L', 'O', 'V', 'E'] },
];

export class BirthdayKeyDetector {
  constructor(onMatch) {
    this._onMatch = onMatch;
    this._states = SECRETS.map((secret) => ({
      id: secret.id,
      keys: secret.keys,
      pos: 0,
    }));
    this._lastAt = 0;
    this._timeoutMs = 2400;
  }

  feed(code, type, name = '') {
    if (type !== 'down') return;

    const now = Date.now();
    if (now - this._lastAt > this._timeoutMs) {
      this._resetProgress();
    }
    this._lastAt = now;

    const key = normalizeKeyName(name);
    if (key.length !== 1) return;

    for (const state of this._states) {
      const expected = state.keys[state.pos];
      if (key === expected) {
        state.pos += 1;
        if (state.pos >= state.keys.length) {
          this._resetProgress();
          this._onMatch?.(state.id);
        }
        return;
      }
      state.pos = key === state.keys[0] ? 1 : 0;
    }
  }

  _resetProgress() {
    this._states.forEach((state) => {
      state.pos = 0;
    });
  }
}
