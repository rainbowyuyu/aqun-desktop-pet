/** Windows 全局按键轮询（GetAsyncKeyState，不依赖 WinKeyServer.exe） */
const POLL_MS = 18;

const VK_KEYS = [
  [0x1b, 'ESCAPE'],
  [0x70, 'F1'], [0x71, 'F2'], [0x72, 'F3'], [0x73, 'F4'],
  [0x74, 'F5'], [0x75, 'F6'], [0x76, 'F7'], [0x77, 'F8'],
  [0x78, 'F9'], [0x79, 'F10'], [0x7a, 'F11'], [0x7b, 'F12'],
  [0xc0, 'GRAVE'],
  [0x30, '0'], [0x31, '1'], [0x32, '2'], [0x33, '3'], [0x34, '4'],
  [0x35, '5'], [0x36, '6'], [0x37, '7'], [0x38, '8'], [0x39, '9'],
  [0xbd, 'MINUS'], [0xbb, 'EQUALS'], [0x08, 'BACKSPACE'],
  [0x09, 'TAB'],
  [0x51, 'Q'], [0x57, 'W'], [0x45, 'E'], [0x52, 'R'], [0x54, 'T'],
  [0x59, 'Y'], [0x55, 'U'], [0x49, 'I'], [0x4f, 'O'], [0x50, 'P'],
  [0xdb, 'LEFT BRACKET'], [0xdd, 'RIGHT BRACKET'], [0xdc, 'BACKSLASH'],
  [0x14, 'CAPS LOCK'],
  [0x41, 'A'], [0x53, 'S'], [0x44, 'D'], [0x46, 'F'], [0x47, 'G'],
  [0x48, 'H'], [0x4a, 'J'], [0x4b, 'K'], [0x4c, 'L'],
  [0xba, 'SEMICOLON'], [0xde, 'QUOTE'], [0x0d, 'ENTER'],
  [0xa0, 'LEFT SHIFT'], [0xa1, 'RIGHT SHIFT'],
  [0x5a, 'Z'], [0x58, 'X'], [0x43, 'C'], [0x56, 'V'], [0x42, 'B'],
  [0x4e, 'N'], [0x4d, 'M'],
  [0xbc, 'COMMA'], [0xbe, 'PERIOD'], [0xbf, 'SLASH'],
  [0xa2, 'LEFT CTRL'], [0xa3, 'RIGHT CTRL'],
  [0x5b, 'LEFT META'], [0x5c, 'RIGHT META'],
  [0xa4, 'LEFT ALT'], [0xa5, 'RIGHT ALT'],
  [0x20, 'SPACE'],
  [0x26, 'UP ARROW'], [0x28, 'DOWN ARROW'], [0x25, 'LEFT ARROW'], [0x27, 'RIGHT ARROW'],
  [0x2d, 'INSERT'], [0x2e, 'DELETE'],
  [0x24, 'HOME'], [0x23, 'END'], [0x21, 'PAGE UP'], [0x22, 'PAGE DOWN'],
  [0x60, 'NUMPAD 0'], [0x61, 'NUMPAD 1'], [0x62, 'NUMPAD 2'], [0x63, 'NUMPAD 3'],
  [0x64, 'NUMPAD 4'], [0x65, 'NUMPAD 5'], [0x66, 'NUMPAD 6'], [0x67, 'NUMPAD 7'],
  [0x68, 'NUMPAD 8'], [0x69, 'NUMPAD 9'],
  [0x6a, 'NUMPAD ADD'], [0x6d, 'NUMPAD SUBTRACT'], [0x6e, 'NUMPAD DECIMAL'],
  [0x6f, 'NUMPAD DIVIDE'], [0x6c, 'NUMPAD ENTER'],
];

function startKeyboardPoll(onEvent) {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');

  const down = new Uint8Array(VK_KEYS.length);
  const heldAt = new Float64Array(VK_KEYS.length);
  const lastRepeat = new Float64Array(VK_KEYS.length);
  const REPEAT_DELAY_MS = 380;
  const REPEAT_INTERVAL_MS = 42;

  const NO_REPEAT = new Set([
    'LEFT SHIFT', 'RIGHT SHIFT', 'LEFT CTRL', 'RIGHT CTRL',
    'LEFT ALT', 'RIGHT ALT', 'LEFT META', 'RIGHT META',
    'CAPS LOCK', 'TAB', 'ESCAPE',
  ]);

  const timer = setInterval(() => {
    const now = Date.now();
    for (let i = 0; i < VK_KEYS.length; i += 1) {
      const [vk, name] = VK_KEYS[i];
      const pressed = (GetAsyncKeyState(vk) & 0x8000) !== 0;
      if (pressed && !down[i]) {
        down[i] = 1;
        heldAt[i] = now;
        lastRepeat[i] = now;
        onEvent({ code: vk, name, type: 'down', timestamp: now });
      } else if (pressed && down[i] && !NO_REPEAT.has(name)) {
        const held = now - heldAt[i];
        if (held > REPEAT_DELAY_MS && now - lastRepeat[i] >= REPEAT_INTERVAL_MS) {
          lastRepeat[i] = now;
          onEvent({ code: vk, name, type: 'down', timestamp: now, repeat: true });
        }
      } else if (!pressed && down[i]) {
        down[i] = 0;
        heldAt[i] = 0;
        lastRepeat[i] = 0;
        onEvent({ code: vk, name, type: 'up', timestamp: now });
      }
    }
  }, POLL_MS);

  return () => {
    clearInterval(timer);
    down.fill(0);
    heldAt.fill(0);
    lastRepeat.fill(0);
  };
}

module.exports = { startKeyboardPoll };
