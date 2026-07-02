/** Windows 鼠标按键状态（可选 koffi） */
let readButtons = null;

if (process.platform === 'win32') {
  try {
    const koffi = require('koffi');
    const user32 = koffi.load('user32.dll');
    const GetAsyncKeyState = user32.func('short __stdcall GetAsyncKeyState(int vKey)');

    readButtons = () => ({
      left: (GetAsyncKeyState(0x01) & 0x8000) !== 0,
      right: (GetAsyncKeyState(0x02) & 0x8000) !== 0,
      middle: (GetAsyncKeyState(0x04) & 0x8000) !== 0,
    });
  } catch {
    readButtons = () => ({ left: false, right: false, middle: false });
  }
} else {
  readButtons = () => ({ left: false, right: false, middle: false });
}

module.exports = { readButtons };
