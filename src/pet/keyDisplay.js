import { normalizeKeyName } from './KeyReactionMap.js';

const CUTE_LABELS = {
  SPACE: '空格',
  ENTER: '回车',
  RETURN: '回车',
  BACKSPACE: '退格',
  TAB: 'Tab',
  ESCAPE: 'Esc',
  ESC: 'Esc',
  'UP ARROW': '↑',
  'DOWN ARROW': '↓',
  'LEFT ARROW': '←',
  'RIGHT ARROW': '→',
  'LEFT SHIFT': 'Shift',
  'RIGHT SHIFT': 'Shift',
  'LEFT CTRL': 'Ctrl',
  'RIGHT CTRL': 'Ctrl',
  'LEFT ALT': 'Alt',
  'RIGHT ALT': 'Alt',
  DELETE: 'Del',
  INSERT: 'Ins',
  HOME: 'Home',
  END: 'End',
  'PAGE UP': 'PgUp',
  'PAGE DOWN': 'PgDn',
  'CAPS LOCK': 'Caps',
  'NUM LOCK': 'Num',
};

const CUTE_EMOJI = {
  letter: ['✨', '🌸', '💫', '🍃'],
  modifier: ['☁️', '🎀', '💭'],
  special: ['⭐', '🌿', '💕'],
  default: ['✨', '🌸', '💫', '🍃', '☁️'],
};

export function keyCategory(name) {
  const key = normalizeKeyName(name);
  if (key.length === 1) return 'letter';
  if (/SHIFT|CTRL|ALT|META|CAPS|NUM LOCK/.test(key)) return 'modifier';
  if (/ENTER|SPACE|BACKSPACE|ESCAPE|ARROW|TAB|DELETE|INSERT|HOME|END|PAGE/.test(key)) return 'special';
  return 'default';
}

export function labelForKey(name) {
  const key = normalizeKeyName(name);
  if (CUTE_LABELS[key]) return CUTE_LABELS[key];
  if (/^F([1-9]|1[0-2])$/.test(key)) return key;
  if (key.startsWith('NUMPAD ')) return key.replace('NUMPAD ', '⌨');
  if (key.length === 1) return key;
  if (key.length <= 6) return key;
  return key.slice(0, 5);
}

export function randomEmoji(category = 'default') {
  const pool = CUTE_EMOJI[category] || CUTE_EMOJI.default;
  return pool[Math.floor(Math.random() * pool.length)];
}
