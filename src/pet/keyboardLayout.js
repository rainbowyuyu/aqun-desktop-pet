/** 标准 QWERTY 键位布局（用于高亮映射） */
export const KB_ROWS = [
  [
    { id: 'ESCAPE', label: 'Esc', w: 1.2 },
    { id: 'F1', label: 'F1' },
    { id: 'F2', label: 'F2' },
    { id: 'F3', label: 'F3' },
    { id: 'F4', label: 'F4' },
    { id: 'F5', label: 'F5' },
    { id: 'F6', label: 'F6' },
    { id: 'F7', label: 'F7' },
    { id: 'F8', label: 'F8' },
    { id: 'F9', label: 'F9' },
    { id: 'F10', label: 'F10' },
    { id: 'F11', label: 'F11' },
    { id: 'F12', label: 'F12' },
  ],
  [
    { id: 'GRAVE', label: '`', alt: 'BACK TICK' },
    { id: '1', label: '1' },
    { id: '2', label: '2' },
    { id: '3', label: '3' },
    { id: '4', label: '4' },
    { id: '5', label: '5' },
    { id: '6', label: '6' },
    { id: '7', label: '7' },
    { id: '8', label: '8' },
    { id: '9', label: '9' },
    { id: '0', label: '0' },
    { id: 'MINUS', label: '-', alt: 'MINUS' },
    { id: 'EQUALS', label: '=', alt: 'EQUALS' },
    { id: 'BACKSPACE', label: '⌫', w: 1.6 },
  ],
  [
    { id: 'TAB', label: 'Tab', w: 1.4 },
    { id: 'Q', label: 'Q' },
    { id: 'W', label: 'W' },
    { id: 'E', label: 'E' },
    { id: 'R', label: 'R' },
    { id: 'T', label: 'T' },
    { id: 'Y', label: 'Y' },
    { id: 'U', label: 'U' },
    { id: 'I', label: 'I' },
    { id: 'O', label: 'O' },
    { id: 'P', label: 'P' },
    { id: 'LEFT BRACKET', label: '[', alt: 'LEFT BRACKET' },
    { id: 'RIGHT BRACKET', label: ']', alt: 'RIGHT BRACKET' },
    { id: 'BACKSLASH', label: '\\', w: 1.2 },
  ],
  [
    { id: 'CAPS LOCK', label: 'Caps', w: 1.6 },
    { id: 'A', label: 'A' },
    { id: 'S', label: 'S' },
    { id: 'D', label: 'D' },
    { id: 'F', label: 'F' },
    { id: 'G', label: 'G' },
    { id: 'H', label: 'H' },
    { id: 'J', label: 'J' },
    { id: 'K', label: 'K' },
    { id: 'L', label: 'L' },
    { id: 'SEMICOLON', label: ';', alt: 'SEMICOLON' },
    { id: 'QUOTE', label: "'", alt: 'QUOTE' },
    { id: 'ENTER', label: 'Enter', w: 1.8, alt: 'RETURN' },
  ],
  [
    { id: 'LEFT SHIFT', label: 'Shift', w: 2 },
    { id: 'Z', label: 'Z' },
    { id: 'X', label: 'X' },
    { id: 'C', label: 'C' },
    { id: 'V', label: 'V' },
    { id: 'B', label: 'B' },
    { id: 'N', label: 'N' },
    { id: 'M', label: 'M' },
    { id: 'COMMA', label: ',', alt: 'COMMA' },
    { id: 'PERIOD', label: '.', alt: 'PERIOD' },
    { id: 'SLASH', label: '/', alt: 'SLASH' },
    { id: 'RIGHT SHIFT', label: 'Shift', w: 2.2 },
  ],
  [
    { id: 'LEFT CTRL', label: 'Ctrl', w: 1.2, alt: 'LCONTROL' },
    { id: 'LEFT META', label: 'Win', w: 1.2, alt: 'LWIN' },
    { id: 'LEFT ALT', label: 'Alt', w: 1.2 },
    { id: 'SPACE', label: '', w: 5.2 },
    { id: 'RIGHT ALT', label: 'Alt', w: 1.2 },
    { id: 'RIGHT META', label: 'Win', w: 1.2, alt: 'RWIN' },
    { id: 'RIGHT CTRL', label: 'Ctrl', w: 1.2, alt: 'RCONTROL' },
  ],
];

const ALIAS = {
  RETURN: 'ENTER',
  ESC: 'ESCAPE',
  ARROWUP: 'UP ARROW',
  ARROWDOWN: 'DOWN ARROW',
  ARROWLEFT: 'LEFT ARROW',
  ARROWRIGHT: 'RIGHT ARROW',
  BACKTICK: 'GRAVE',
  'BACK TICK': 'GRAVE',
  CONTROLLEFT: 'LEFT CTRL',
  CONTROLRIGHT: 'RIGHT CTRL',
  METALEFT: 'LEFT META',
  METARIGHT: 'RIGHT META',
  OSLEFT: 'LEFT META',
  OSRIGHT: 'RIGHT META',
  LWIN: 'LEFT META',
  RWIN: 'RIGHT META',
  LCONTROL: 'LEFT CTRL',
  RCONTROL: 'RIGHT CTRL',
  LEFTCTRL: 'LEFT CTRL',
  RIGHTCTRL: 'RIGHT CTRL',
  LEFTMETA: 'LEFT META',
  RIGHTMETA: 'RIGHT META',
  COMMAND: 'LEFT META',
  'LEFT WIN': 'LEFT META',
  'RIGHT WIN': 'RIGHT META',
  WIN: 'LEFT META',
  LEFTWINDOWS: 'LEFT META',
  RIGHTWINDOWS: 'RIGHT META',
  LEFTCONTROL: 'LEFT CTRL',
  RIGHTCONTROL: 'RIGHT CTRL',
};

/** 仅高亮实际按下的键（支持多键同时按下） */
export function getHighlightIds(id) {
  return [id];
}

export function resolveKeyId(rawName) {
  if (!rawName) return null;
  let s = String(rawName).toUpperCase().trim();
  if (ALIAS[s]) s = ALIAS[s];
  if (s.startsWith('KEY') && s.length === 4) s = s.slice(3);
  if (s.startsWith('DIGIT') && s.length === 6) s = s.slice(5);
  if (s.startsWith('NUMPAD')) {
    const tail = s.slice(6);
    if (tail === 'ADD') return 'NUMPAD ADD';
    if (tail === 'SUBTRACT') return 'NUMPAD SUBTRACT';
    if (tail === 'ENTER') return 'NUMPAD ENTER';
    return `NUMPAD ${tail}`;
  }
  return s;
}

export function buildKeyDomMap(container) {
  const map = new Map();
  container.querySelectorAll('[data-key-id]').forEach((el) => {
    map.set(el.dataset.keyId, el);
    if (el.dataset.keyAlt) map.set(el.dataset.keyAlt, el);
  });
  return map;
}
