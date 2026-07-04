/** macOS 鼠标按键状态（CoreGraphics，可选 koffi） */
let readButtons = () => ({ left: false, right: false, middle: false });

if (process.platform === 'darwin') {
  try {
    const koffi = require('koffi');
    const cg = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
    const CGEventSourceKeyState = cg.func('bool CGEventSourceKeyState(int32_t stateID, uint16_t key)');

    const HID_STATE = 1;
    const MOUSE_LEFT = 0;
    const MOUSE_RIGHT = 1;
    const MOUSE_CENTER = 2;

    readButtons = () => ({
      left: CGEventSourceKeyState(HID_STATE, MOUSE_LEFT),
      right: CGEventSourceKeyState(HID_STATE, MOUSE_RIGHT),
      middle: CGEventSourceKeyState(HID_STATE, MOUSE_CENTER),
    });
  } catch (err) {
    console.warn('[mouseButtonsDarwin] 不可用:', err.message);
  }
}

module.exports = { readButtons };
