/** 按平台加载全局鼠标按键状态 */
let readButtons;

if (process.platform === 'win32') {
  readButtons = require('./mouseButtonsWin.cjs').readButtons;
} else if (process.platform === 'darwin') {
  readButtons = require('./mouseButtonsDarwin.cjs').readButtons;
} else {
  readButtons = () => ({ left: false, right: false, middle: false });
}

module.exports = { readButtons };
