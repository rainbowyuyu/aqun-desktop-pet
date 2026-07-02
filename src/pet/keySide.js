import { normalizeKeyName } from './KeyReactionMap.js';

const LEFT_KEYS = new Set([
  'Q', 'W', 'E', 'R', 'T', 'A', 'S', 'D', 'F', 'G', 'Z', 'X', 'C', 'V', 'B',
  'TAB', 'CAPS LOCK', 'LEFT SHIFT', 'LEFT CTRL', 'LEFT ALT', 'GRAVE',
  '1', '2', '3', '4', '5', 'ESC', 'ESCAPE',
  'UP ARROW', 'DOWN ARROW', 'LEFT ARROW', 'RIGHT ARROW',
  'HOME', 'END', 'PAGE UP', 'PAGE DOWN',
]);

const RIGHT_KEYS = new Set([
  'Y', 'U', 'I', 'O', 'P', 'H', 'J', 'K', 'L', 'N', 'M',
  'RIGHT SHIFT', 'RIGHT CTRL', 'RIGHT ALT', 'RIGHT META',
  '6', '7', '8', '9', '0', 'MINUS', 'EQUALS',
  'LEFT BRACKET', 'RIGHT BRACKET', 'BACKSLASH', 'SEMICOLON', 'QUOTE',
  'COMMA', 'PERIOD', 'SLASH', 'BACKSPACE', 'ENTER', 'RETURN', 'DELETE',
]);

/** 按键对应身体侧向反馈 */
export function keyBodySide(name) {
  const key = normalizeKeyName(name);
  if (LEFT_KEYS.has(key)) return 'left';
  if (RIGHT_KEYS.has(key)) return 'right';
  if (key === 'SPACE' || key.startsWith('NUMPAD')) return 'center';
  if (/^F([1-9]|1[0-2])$/.test(key)) return 'center';
  if (key.length === 1) {
    const c = key.charCodeAt(0);
    if (c >= 65 && c <= 77) return 'left';
    if (c >= 78 && c <= 90) return 'right';
  }
  return 'center';
}

export function keyIntensity(name, typingSpeed = 0) {
  const key = normalizeKeyName(name);
  if (/SHIFT|CTRL|ALT|META/.test(key)) return 0.45;
  if (/^F([1-9]|1[0-2])$/.test(key)) return 0.85;
  if (key === 'SPACE') return 0.9;
  return Math.min(1, 0.35 + typingSpeed * 0.25);
}
