/** 主进程轮询全局鼠标位置，供模型视线跟踪 */
const { screen } = require('electron');
const { readButtons } = require('./mouseButtonsWin.cjs');

const POLL_MS = 28;
let timer = null;
let getWindow = null;
let lastPayload = '';

function sample() {
  const win = getWindow?.();
  if (!win || win.isDestroyed() || !win.isVisible()) return;

  const cursor = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  const display = screen.getDisplayMatching(bounds).workArea;
  const buttons = readButtons();
  const payload = `${cursor.x},${cursor.y},${bounds.x},${bounds.y},${bounds.width},${bounds.height},${display.x},${display.y},${display.width},${display.height},${buttons.left ? 1 : 0},${buttons.right ? 1 : 0},${buttons.middle ? 1 : 0}`;
  if (payload === lastPayload) return;
  lastPayload = payload;

  win.webContents.send('global-mouse', { cursor, bounds, display, buttons });
}

function startGlobalMouseTracker(windowGetter) {
  getWindow = windowGetter;
  if (timer) return;
  timer = setInterval(sample, POLL_MS);
}

function stopGlobalMouseTracker() {
  if (timer) clearInterval(timer);
  timer = null;
  getWindow = null;
  lastPayload = '';
}

module.exports = { startGlobalMouseTracker, stopGlobalMouseTracker };
