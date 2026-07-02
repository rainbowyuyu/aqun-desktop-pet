const { BrowserWindow, screen } = require('electron');
const path = require('path');

const CONTEXT_W = 260;
const CONTEXT_MIN_H = 380;
const CONTEXT_MAX_H = 540;
const ROOT_PAD = 8;

let contextPopup = null;
let isDev = false;
let preloadPath = '';
let getMainWindow = null;
let lastAnchor = { x: 0, y: 0 };

function initContextPopup({ dev, preload, getWindow }) {
  isDev = dev;
  preloadPath = preload;
  getMainWindow = getWindow;
}

function hideContextPopup() {
  if (!contextPopup || contextPopup.isDestroyed()) return;
  contextPopup.hide();
}

function clampPopupPosition(x, y, width, height, workArea) {
  const wa = workArea;
  let nextX = x;
  let nextY = y;

  if (nextX + width > wa.x + wa.width - 8) nextX = lastAnchor.x - width;
  if (nextY + height > wa.y + wa.height - 8) nextY = lastAnchor.y - height;

  nextX = Math.max(wa.x + 8, Math.min(nextX, wa.x + wa.width - width - 8));
  nextY = Math.max(wa.y + 8, Math.min(nextY, wa.y + wa.height - height - 8));
  return { x: nextX, y: nextY };
}

function ensureContextPopup() {
  if (contextPopup && !contextPopup.isDestroyed()) return contextPopup;

  contextPopup = new BrowserWindow({
    width: CONTEXT_W,
    height: CONTEXT_MIN_H,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  contextPopup.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    contextPopup.loadURL('http://localhost:5174/context-popup.html');
  } else {
    contextPopup.loadFile(path.join(__dirname, '../dist/context-popup.html'));
  }

  contextPopup.on('blur', () => hideContextPopup());

  return contextPopup;
}

function showContextPopup(screenX, screenY, settings) {
  const popup = ensureContextPopup();
  popup.setAlwaysOnTop(settings?.alwaysOnTop !== false);
  lastAnchor = { x: screenX, y: screenY };
  const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
  const wa = display.workArea;

  const pos = clampPopupPosition(screenX, screenY, CONTEXT_W, CONTEXT_MIN_H, wa);

  popup.setBounds({
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    width: CONTEXT_W,
    height: CONTEXT_MIN_H,
  });

  const payload = { ...settings };
  const present = () => {
    popup.webContents.send('context-popup-show', payload);
    popup.show();
    popup.focus();
  };

  if (popup.webContents.isLoading()) {
    popup.webContents.once('did-finish-load', present);
  } else {
    present();
  }
}

function resizeContextPopup(contentHeight) {
  const popup = contextPopup;
  if (!popup || popup.isDestroyed() || !popup.isVisible()) return;

  const height = Math.min(
    CONTEXT_MAX_H,
    Math.max(CONTEXT_MIN_H, Math.round(contentHeight + ROOT_PAD)),
  );
  const bounds = popup.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
  const pos = clampPopupPosition(bounds.x, bounds.y, CONTEXT_W, height, display.workArea);

  popup.setBounds({
    x: Math.round(pos.x),
    y: Math.round(pos.y),
    width: CONTEXT_W,
    height,
  });
}

function openSettingsFromPopup() {
  const main = getMainWindow?.();
  if (!main || main.isDestroyed()) return;
  hideContextPopup();
  main.show();
  main.focus();
  main.webContents.send('open-settings-panel');
}

module.exports = {
  initContextPopup,
  showContextPopup,
  hideContextPopup,
  resizeContextPopup,
  openSettingsFromPopup,
};
