import { normalizeKeyName } from './KeyReactionMap.js';

/** 连续按键彩蛋 — 不区分大小写 */
const SECRETS = [
  { id: 'happy', keys: ['H', 'A', 'P', 'P', 'Y'] },
  { id: 'birthday', keys: ['B', 'I', 'R', 'T', 'H', 'D', 'A', 'Y'] },
  { id: 'bday', keys: ['B', 'D', 'A', 'Y'] },
  { id: 'love', keys: ['L', 'O', 'V', 'E'] },
  { id: 'kaixin', keys: ['K', 'A', 'I', 'X', 'I', 'N'] },
  { id: 'kuaile', keys: ['K', 'U', 'A', 'I', 'L', 'E'] },
  { id: 'shengri', keys: ['S', 'H', 'E', 'N', 'G', 'R', 'I'] },
  { id: 'xingfu', keys: ['X', 'I', 'N', 'G', 'F', 'U'] },
  { id: 'party', keys: ['P', 'A', 'R', 'T', 'Y'] },
  { id: 'cake', keys: ['C', 'A', 'K', 'E'] },
  { id: 'gift', keys: ['G', 'I', 'F', 'T'] },
  { id: 'aqun', keys: ['A', 'Q', 'U', 'N'] },
  { id: 'ty', keys: ['T', 'Y'] },
  /* 中文词拼音首字母 */
  { id: 'kx', keys: ['K', 'X'] },
  { id: 'kl', keys: ['K', 'L'] },
  { id: 'sr', keys: ['S', 'R'] },
  { id: 'xf', keys: ['X', 'F'] },
];

/** 滚动字母缓冲末尾匹配（输入到一半也能触发） */
const TAIL_WORDS = [
  { id: 'happy', word: 'happy' },
  { id: 'birthday', word: 'birthday' },
  { id: 'bday', word: 'bday' },
  { id: 'love', word: 'love' },
  { id: 'kaixin', word: 'kaixin' },
  { id: 'kuaile', word: 'kuaile' },
  { id: 'shengri', word: 'shengri' },
  { id: 'xingfu', word: 'xingfu' },
  { id: 'party', word: 'party' },
  { id: 'cake', word: 'cake' },
  { id: 'gift', word: 'gift' },
  { id: 'aqun', word: 'aqun' },
];

const TAIL_BUFFER_MAX = 28;
const TAIL_COOLDOWN_MS = 2200;

export class BirthdayKeyDetector {
  constructor(onMatch) {
    this._onMatch = onMatch;
    this._states = SECRETS.map((secret) => ({
      id: secret.id,
      keys: secret.keys,
      pos: 0,
    }));
    this._lastAt = 0;
    this._timeoutMs = 2800;
    this._tail = '';
    this._lastTailMatchAt = 0;
  }

  feed(code, type, name = '') {
    if (type !== 'down') return;

    const now = Date.now();
    if (now - this._lastAt > this._timeoutMs) {
      this._resetProgress();
      this._tail = '';
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
          this._tail = '';
          this._onMatch?.(state.id);
        }
        return;
      }
      state.pos = key === state.keys[0] ? 1 : 0;
    }

    this._tail = (this._tail + key.toLowerCase()).slice(-TAIL_BUFFER_MAX);
    if (now - this._lastTailMatchAt < TAIL_COOLDOWN_MS) return;

    for (const entry of TAIL_WORDS) {
      if (this._tail.endsWith(entry.word)) {
        this._lastTailMatchAt = now;
        this._resetProgress();
        this._tail = '';
        this._onMatch?.(entry.id);
        return;
      }
    }
  }

  _resetProgress() {
    this._states.forEach((state) => {
      state.pos = 0;
    });
  }
}
