let listener = null;
let paused = false;
let onEvent = null;
let available = false;
let stopPoll = null;

/** node-global-key-listener 键名 → 近似 keycode（供 Konami 等） */
const NAME_TO_CODE = {
  SPACE: 57,
  RETURN: 28,
  ENTER: 28,
  BACKSPACE: 14,
  TAB: 15,
  ESCAPE: 1,
  ESC: 1,
  'LEFT SHIFT': 42,
  'RIGHT SHIFT': 54,
  'LEFT CTRL': 29,
  'RIGHT CTRL': 3613,
  'LEFT META': 91,
  'RIGHT META': 92,
  'LEFT ALT': 56,
  'RIGHT ALT': 3640,
  'UP ARROW': 57416,
  'DOWN ARROW': 57424,
  'LEFT ARROW': 57419,
  'RIGHT ARROW': 57421,
  HOME: 57415,
  END: 57423,
  'PAGE UP': 57417,
  'PAGE DOWN': 57425,
  INSERT: 57426,
  DELETE: 57427,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  MINUS: 12, EQUALS: 13,
  'LEFT BRACKET': 26, 'RIGHT BRACKET': 27,
  BACKSLASH: 43, SEMICOLON: 39, QUOTE: 40,
  COMMA: 51, PERIOD: 52, SLASH: 53,
  'BACK TICK': 41,
  GRAVE: 41,
  'CAPS LOCK': 58,
  'NUM LOCK': 69,
  'PRINT SCREEN': 3639,
  'SCROLL LOCK': 70,
  'PAUSE/BREAK': 3653,
  'NUMPAD 0': 82, 'NUMPAD 1': 79, 'NUMPAD 2': 80, 'NUMPAD 3': 81,
  'NUMPAD 4': 75, 'NUMPAD 5': 76, 'NUMPAD 6': 77,
  'NUMPAD 7': 71, 'NUMPAD 8': 72, 'NUMPAD 9': 73,
  'NUMPAD ADD': 78, 'NUMPAD SUBTRACT': 74, 'NUMPAD MULTIPLY': 55,
  'NUMPAD DIVIDE': 3637, 'NUMPAD ENTER': 3612, 'NUMPAD DECIMAL': 83,
  W: 17, A: 30, S: 31, D: 32,
};

function normalizeKeyName(name) {
  const u = String(name || '').toUpperCase().trim();
  const aliases = {
    LWIN: 'LEFT META',
    RWIN: 'RIGHT META',
    LCONTROL: 'LEFT CTRL',
    RCONTROL: 'RIGHT CTRL',
    LSHIFT: 'LEFT SHIFT',
    RSHIFT: 'RIGHT SHIFT',
    LALT: 'LEFT ALT',
    RALT: 'RIGHT ALT',
    LEFTCTRL: 'LEFT CTRL',
    RIGHTCTRL: 'RIGHT CTRL',
    LEFTMETA: 'LEFT META',
    RIGHTMETA: 'RIGHT META',
    RETURN: 'ENTER',
  };
  return aliases[u] || u;
}

function mapName(name) {
  const upper = normalizeKeyName(name);
  if (NAME_TO_CODE[upper] != null) return NAME_TO_CODE[upper];
  if (upper.length === 1) {
    const c = upper.charCodeAt(0);
    if (c >= 65 && c <= 90) return c - 64 + 16;
    if (c >= 48 && c <= 57) return c - 48 + 2;
  }
  return upper.split('').reduce((h, ch) => h + ch.charCodeAt(0), 0);
}

function emitPayload(rawName, type, vkCode) {
  if (paused || !onEvent) return;
  const name = normalizeKeyName(rawName);
  if (!name) return;
  onEvent({
    code: vkCode != null ? vkCode : mapName(name),
    name,
    type,
    timestamp: Date.now(),
  });
}

function startWinPoll() {
  const { startKeyboardPoll } = require('./keyboardPollWin.cjs');
  stopPoll = startKeyboardPoll((payload) => {
    emitPayload(payload.name, payload.type, payload.code);
  });
  available = true;
}

function startNodeGlobalListener() {
  const { GlobalKeyboardListener } = require('node-global-key-listener');
  listener = new GlobalKeyboardListener({ windows: { onError: () => {} } });

  listener.addListener((event) => {
    const raw = event.name || '';
    if (!raw) return;
    const name = normalizeKeyName(raw);

    if (event.state === 'UP') {
      emitPayload(name, 'up');
    } else if (event.state === 'DOWN') {
      emitPayload(name, 'down');
    }
  });

  available = true;
}

function startKeyboardListener(callback) {
  onEvent = callback;
  if (listener || stopPoll) return;

  if (process.platform === 'win32') {
    try {
      startWinPoll();
      return;
    } catch (err) {
      console.warn('[keyboard] koffi 轮询不可用:', err.message);
    }
  }

  try {
    startNodeGlobalListener();
  } catch (err) {
    console.warn('[keyboard] 全局按键不可用:', err.message);
    available = false;
  }
}

function stopKeyboardListener() {
  try {
    listener?.kill?.();
  } catch {
    /* ignore */
  }
  listener = null;

  if (stopPoll) {
    stopPoll();
    stopPoll = null;
  }

  available = false;
}

function setKeyboardPaused(value) {
  paused = Boolean(value);
}

function isKeyboardPaused() {
  return paused;
}

function isKeyboardAvailable() {
  return available;
}

module.exports = {
  startKeyboardListener,
  stopKeyboardListener,
  setKeyboardPaused,
  isKeyboardPaused,
  isKeyboardAvailable,
};
