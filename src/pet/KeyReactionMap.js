/** 按键名 → 行为（支持全部按键） */
export const KEY = {
  SPACE: 57,
  ENTER: 28,
  BACKSPACE: 14,
  TAB: 15,
  ESC: 1,
  UP: 57416,
  DOWN: 57424,
  LEFT: 57419,
  RIGHT: 57421,
};

const LEAN_NAMES = new Set([
  'UP ARROW', 'DOWN ARROW', 'LEFT ARROW', 'RIGHT ARROW',
  'W', 'A', 'S', 'D',
  'HOME', 'END', 'PAGE UP', 'PAGE DOWN',
]);

const MODIFIER_NAMES = new Set([
  'LEFT SHIFT', 'RIGHT SHIFT', 'LEFT CTRL', 'RIGHT CTRL',
  'LEFT ALT', 'RIGHT ALT', 'LEFT META', 'RIGHT META', 'CAPS LOCK',
]);

const SURPRISED_NAMES = new Set([
  'DELETE', 'INSERT', 'ESCAPE', 'ESC',
]);

const NOD_NAMES = new Set(['RETURN', 'ENTER', 'NUMPAD ENTER']);

const JUMP_NAMES = new Set(['NUMPAD ADD', 'NUMPAD SUBTRACT']);

const SWAY_NAMES = new Set(['SPACE']);

const FOCUS_NAMES = new Set(['TAB']);

function isPrintable(name) {
  return name.length === 1;
}

function isFunctionKey(name) {
  return /^F([1-9]|1[0-2])$/.test(name);
}

function isNumpad(name) {
  return name.startsWith('NUMPAD');
}

function leanDirection(name) {
  if (name === 'UP ARROW' || name === 'W' || name === 'HOME' || name === 'PAGE UP') {
    return { x: 0, y: 0.08 };
  }
  if (name === 'DOWN ARROW' || name === 'S' || name === 'END' || name === 'PAGE DOWN') {
    return { x: 0, y: -0.06 };
  }
  if (name === 'LEFT ARROW' || name === 'A') {
    return { x: 0.1, y: 0 };
  }
  if (name === 'RIGHT ARROW' || name === 'D') {
    return { x: -0.1, y: 0 };
  }
  return { x: 0, y: 0 };
}

/** 统一键名（全局 hook / DOM 事件） */
export function normalizeKeyName(raw) {
  if (!raw) return '';
  const s = String(raw).toUpperCase().trim();
  const DOM = {
    SPACE: 'SPACE',
    ENTER: 'ENTER',
    RETURN: 'ENTER',
    BACKSPACE: 'BACKSPACE',
    TAB: 'TAB',
    ESCAPE: 'ESCAPE',
    ESC: 'ESCAPE',
    ARROWUP: 'UP ARROW',
    ARROWDOWN: 'DOWN ARROW',
    ARROWLEFT: 'LEFT ARROW',
    ARROWRIGHT: 'RIGHT ARROW',
  };
  if (DOM[s]) return DOM[s];
  if (s.startsWith('KEY') && s.length === 4) return s.slice(3);
  if (s.startsWith('DIGIT') && s.length === 6) return s.slice(5);
  if (s.startsWith('NUMPAD')) {
    const tail = s.slice(6);
    if (tail === 'ADD') return 'NUMPAD ADD';
    if (tail === 'SUBTRACT') return 'NUMPAD SUBTRACT';
    if (tail === 'MULTIPLY') return 'NUMPAD MULTIPLY';
    if (tail === 'DIVIDE') return 'NUMPAD DIVIDE';
    if (tail === 'DECIMAL') return 'NUMPAD DECIMAL';
    if (tail === 'ENTER') return 'NUMPAD ENTER';
    return `NUMPAD ${tail}`;
  }
  return s;
}

export function classifyKey(code, type, name = '') {
  if (type !== 'down') return { kind: 'none' };

  const key = normalizeKeyName(name);

  if (SWAY_NAMES.has(key)) return { kind: 'sway', bubble: 'space' };
  if (JUMP_NAMES.has(key)) return { kind: 'jump', bubble: 'space' };
  if (NOD_NAMES.has(key)) return { kind: 'nod', bubble: 'enter' };
  if (key === 'BACKSPACE') return { kind: 'surprised', bubble: 'backspace' };
  if (SURPRISED_NAMES.has(key)) return { kind: 'surprised', bubble: 'backspace' };
  if (LEAN_NAMES.has(key)) return { kind: 'lean', direction: leanDirection(key) };
  if (FOCUS_NAMES.has(key)) return { kind: 'focus' };
  if (MODIFIER_NAMES.has(key)) return { kind: 'focus' };
  if (isFunctionKey(key)) {
    return { kind: 'function', fn: key, intensity: 0.6 + (parseInt(key.slice(1), 10) / 12) * 0.8 };
  }
  if (isNumpad(key)) return { kind: 'numpad', label: key };
  if (isPrintable(key)) return { kind: 'typing', label: key };

  return { kind: 'generic', label: key || String(code) };
}

/** ↑↑↓↓ 彩蛋 */
export class KonamiDetector {
  constructor(onMatch) {
    this._seq = [KEY.UP, KEY.UP, KEY.DOWN, KEY.DOWN];
    this._pos = 0;
    this._onMatch = onMatch;
  }

  feed(code, type) {
    if (type !== 'down') return;
    if (code === this._seq[this._pos]) {
      this._pos += 1;
      if (this._pos >= this._seq.length) {
        this._pos = 0;
        this._onMatch();
      }
    } else {
      this._pos = code === this._seq[0] ? 1 : 0;
    }
  }
}
