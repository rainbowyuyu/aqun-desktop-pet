const { BrowserWindow, screen } = require('electron');
const path = require('path');

const CONTEXT_W = 252;
const CONTEXT_H = 352;

let contextPopup = null;
let isDev = false;
let preloadPath = '';
let getMainWindow = null;

function initContextPopup({ dev, preload, getWindow }) {
  isDev = dev;
  preloadPath = preload;
  getMainWindow = getWindow;
}

function hideContextPopup() {
  if (!contextPopup || contextPopup.isDestroyed()) return;
  contextPopup.hide();
}

function ensureContextPopup() {
  if (contextPopup && !contextPopup.isDestroyed()) return contextPopup;

  contextPopup = new BrowserWindow({
    width: CONTEXT_W,
    height: CONTEXT_H,
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
  const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
  const wa = display.workArea;

  let x = screenX;
  let y = screenY;
  if (x + CONTEXT_W > wa.x + wa.width - 8) x = screenX - CONTEXT_W;
  if (y + CONTEXT_H > wa.y + wa.height - 8) y = screenY - CONTEXT_H;
  x = Math.max(wa.x + 8, Math.min(x, wa.x + wa.width - CONTEXT_W - 8));
  y = Math.max(wa.y + 8, Math.min(y, wa.y + wa.height - CONTEXT_H - 8));

  popup.setBounds({
    x: Math.round(x),
    y: Math.round(y),
    width: CONTEXT_W,
    height: CONTEXT_H,
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
  openSettingsFromPopup,
};
