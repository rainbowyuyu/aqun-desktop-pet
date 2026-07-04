const {

  app,

  BrowserWindow,

  Tray,

  Menu,

  nativeImage,

  ipcMain,

  screen,

  shell,

  session,

  systemPreferences,

} = require('electron');

const path = require('path');

const fs = require('fs');

const { pathToFileURL } = require('url');

const {
  startKeyboardListener,
  stopKeyboardListener,
  setKeyboardPaused,
  isKeyboardPaused,
  isKeyboardAvailable,
} = require('./keyboard.cjs');
const { startGlobalMouseTracker, stopGlobalMouseTracker } = require('./mouseTracker.cjs');
const aiAssistant = require('./aiAssistant.cjs');
const {
  initContextPopup,
  showContextPopup,
  hideContextPopup,
  resizeContextPopup,
} = require('./contextPopup.cjs');
const {
  initReminders,
  stopReminders,
  getReminders,
  upsertReminder,
  deleteReminder,
  toggleReminder,
  importReminders,
  resetRemindersToDefault,
} = require('./reminders.cjs');
const {
  DEFAULT_SETTINGS,
  RESET_GROUPS,
  pickDefaults,
  getAllDefaults,
} = require('./settingsDefaults.cjs');
const {
  setupGeolocationPermissions,
  pickWebContents,
  getDeviceLocation,
} = require('./geolocation.cjs');
const { checkForUpdate } = require('./updateChecker.cjs');
const {
  resolveActionShortcutBindings,
  registerPetActionShortcuts,
  unregisterPetActionShortcuts,
} = require('./actionShortcuts.cjs');
const repoConfig = require('./repoConfig.cjs');
const { checkNewMachine, commitMachineBinding } = require('./machineBinding.cjs');

const isDev = !app.isPackaged;

const BASE_WIDTH = 320;

const BASE_HEIGHT = 480;

const PANEL_WIDTH = 1380;

const PANEL_HEIGHT = 820;

const PANEL_MIN_WIDTH = 1080;

const PANEL_MIN_HEIGHT = 580;

const POSE_EDITOR_WIDTH = 1280;
const POSE_EDITOR_HEIGHT = 820;



let mainWindow = null;
let settingsWindow = null;
let poseEditorWindow = null;
let appIsQuitting = false;

let tray = null;

let rebuildTrayMenu = null;

let panelBoundsTimer = null;

let dragOffset = null;
let dragLockedSize = null;
let interactionMode = 'idle';
let isDragging = false;
let isResizing = false;
let resizeAnchor = null;



const settings = { ...DEFAULT_SETTINGS };



function settingsPath() {

  return path.join(app.getPath('userData'), 'settings.json');

}



function wipeUserDataArtifacts() {
  const userData = app.getPath('userData');
  const poseDir = path.join(userData, 'pose-libraries');
  if (fs.existsSync(poseDir)) {
    fs.rmSync(poseDir, { recursive: true, force: true });
  }
}

function performFreshMachineReset() {
  wipeUserDataArtifacts();
  resetRemindersToDefault();

  Object.keys(settings).forEach((key) => delete settings[key]);
  Object.assign(settings, getAllDefaults(), {
    welcomeExperiencePending: true,
    tutorialSeen: false,
    birthdayIntroYear: null,
  });
  delete settings.panelBounds;

  saveSettings();
  console.info('[machine-binding] 检测到新电脑，已恢复默认设置并准备欢迎体验');
}

function maybeResetForNewMachine() {
  const { isNewMachine, fingerprint } = checkNewMachine({
    app,
    isDev,
    execPath: process.execPath,
  });
  if (!isNewMachine) return false;

  performFreshMachineReset();
  commitMachineBinding({
    app,
    isDev,
    execPath: process.execPath,
    fingerprint,
  });
  return true;
}

function loadSettings() {

  try {

    const raw = fs.readFileSync(settingsPath(), 'utf8');

    Object.assign(settings, JSON.parse(raw));

    if (settings.tutorialSeen == null) {
      settings.tutorialSeen = true;
    }

    if (settings.networkChatter == null) {
      settings.networkChatter = true;
    }

    if (settings.lookHeadSensitivity == null) {
      settings.lookHeadSensitivity = DEFAULT_SETTINGS.lookHeadSensitivity;
    }
    if (settings.lookBodySensitivity == null) {
      settings.lookBodySensitivity = DEFAULT_SETTINGS.lookBodySensitivity;
    }
    if (settings.lookHandSensitivity == null) {
      settings.lookHandSensitivity = DEFAULT_SETTINGS.lookHandSensitivity;
    }

    if (settings.actionShortcuts == null || typeof settings.actionShortcuts !== 'object') {
      settings.actionShortcuts = { ...DEFAULT_SETTINGS.actionShortcuts };
    } else {
      settings.actionShortcuts = {
        ...DEFAULT_SETTINGS.actionShortcuts,
        ...settings.actionShortcuts,
      };
      if (settings.actionShortcuts.wave && !settings.actionShortcuts.headTurnLeft) {
        settings.actionShortcuts.headTurnLeft = settings.actionShortcuts.wave;
      }
      delete settings.actionShortcuts.wave;
      delete settings.actionShortcuts.nod;
    }

  } catch {

    /* use defaults */

  }

}


function saveSettings() {

  fs.mkdirSync(path.join(app.getPath('userData')), { recursive: true });

  const payload = { ...settings, settingsOpen: false };
  fs.writeFileSync(settingsPath(), JSON.stringify(payload, null, 2));

}



function broadcastSettings() {
  const payload = { ...settings };
  mainWindow?.webContents?.send('settings-changed', payload);
  settingsWindow?.webContents?.send('settings-changed', payload);
}

function applySettingsSideEffects(partial, { resetInteraction = false } = {}) {
  if (partial.petScale != null) {
    if (resetInteraction) {
      isDragging = false;
      isResizing = false;
      interactionMode = 'idle';
      resizeAnchor = null;
      dragOffset = null;
      dragLockedSize = null;
    }
    if (isDragging || interactionMode === 'drag') {
      settings.petScale = clampScale(settings.petScale);
      return;
    }
    settings.petScale = clampScale(partial.petScale);
    applyWindowScale(settings.petScale, { keepCenter: true });
  }

  if (partial.opacity != null) mainWindow?.setOpacity(settings.opacity);

  if (partial.alwaysOnTop != null) {
    mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);
    settingsWindow?.setAlwaysOnTop(settings.alwaysOnTop);
  }

  if (partial.keyboardPaused != null) setKeyboardPaused(settings.keyboardPaused);

  if (partial.aiEnabled === false) aiAssistant.resetBuffer();

  if (partial.clickThrough != null) applyClickThrough();

  if ('actionShortcutsEnabled' in partial || partial.actionShortcuts) {
    refreshActionShortcuts();
  }
}

function triggerPetShortcutAction(actionId) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('pet-action-shortcut', actionId);
}

function refreshActionShortcuts() {
  const bindings = resolveActionShortcutBindings(settings.actionShortcuts);
  registerPetActionShortcuts(
    settings.actionShortcutsEnabled !== false,
    bindings,
    triggerPetShortcutAction,
  );
}

function applyFullSettingsSideEffects() {
  applySettingsSideEffects(
    {
      petScale: settings.petScale,
      opacity: settings.opacity,
      alwaysOnTop: settings.alwaysOnTop,
      keyboardPaused: settings.keyboardPaused,
      clickThrough: settings.clickThrough,
    },
    { resetInteraction: true },
  );
  refreshActionShortcuts();
}

function broadcastRemindersChanged() {
  mainWindow?.webContents?.send('reminders-changed');
  settingsWindow?.webContents?.send('reminders-changed');
}

function applyResetScope(scope) {
  resetInteractionState();

  if (scope === 'all') {
    const keepOpen = settings.settingsOpen;
    Object.keys(settings).forEach((key) => delete settings[key]);
    Object.assign(settings, getAllDefaults(), { settingsOpen: keepOpen });
    delete settings.panelBounds;
    applyFullSettingsSideEffects();
    resetRemindersToDefault();
    broadcastRemindersChanged();
  } else if (scope === 'reminders') {
    resetRemindersToDefault();
    broadcastRemindersChanged();
  } else if (RESET_GROUPS[scope]) {
    const partial = pickDefaults(RESET_GROUPS[scope]);
    if (scope === 'tutorial') partial.tutorialSeen = false;
    Object.assign(settings, partial);
    applySettingsSideEffects(partial, { resetInteraction: partial.petScale != null });
  } else {
    throw new Error(`Unknown reset scope: ${scope}`);
  }

  saveSettings();
  broadcastSettings();
  return { scope, settings: { ...settings } };
}



function resolveIcon() {

  const isMac = process.platform === 'darwin';

  const candidates = isMac
    ? [
        path.join(__dirname, '../build/icon.png'),
        path.join(__dirname, '../public/logo.png'),
        path.join(process.resourcesPath, 'logo.png'),
      ]
    : [
        path.join(__dirname, '../build/icon.ico'),
        path.join(__dirname, '../build/icon.png'),
        path.join(__dirname, '../public/logo.png'),
        path.join(process.resourcesPath, 'logo.png'),
      ];

  for (const p of candidates) {

    if (fs.existsSync(p)) return p;

  }

  return null;

}



function resolveRainbowIcon() {

  const candidates = [

    path.join(__dirname, '../public/logo_rainbow.png'),

    path.join(process.resourcesPath, 'logo_rainbow.png'),

  ];

  for (const p of candidates) {

    if (fs.existsSync(p)) return p;

  }

  return resolveIcon();

}



function clampScale(scale) {

  return Math.max(0.6, Math.min(1.8, Number(scale) || 1));

}



function windowSizeForScale(scale) {

  const s = clampScale(scale);

  return {

    width: Math.round(BASE_WIDTH * s),

    height: Math.round(BASE_HEIGHT * s),

  };

}



function applyWindowScale(scale, { keepCenter = true, anchor = null } = {}) {

  if (!mainWindow || mainWindow.isDestroyed()) return;

  const s = clampScale(scale);

  const { width, height } = windowSizeForScale(s);

  let x;
  let y;

  if (anchor) {
    x = Math.round(anchor.cx - width / 2);
    y = Math.round(anchor.cy - height / 2);
  } else if (keepCenter) {

    const [posX, posY] = mainWindow.getPosition();

    const [oldW, oldH] = mainWindow.getSize();

    x = posX + Math.round((oldW - width) / 2);
    y = posY + Math.round((oldH - height) / 2);

  } else {

    mainWindow.setSize(width, height, false);
    notifyWindowBoundsChanged(width, height);
    return;

  }

  mainWindow.setBounds(x, y, width, height, false);
  notifyWindowBoundsChanged(width, height);
}

function applyLivePetScale(scale, { anchor = null } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (isDragging || interactionMode === 'drag') return;
  const next = clampScale(scale);
  settings.petScale = next;
  if (anchor) {
    applyWindowScale(next, { anchor });
  } else {
    applyWindowScale(next, { keepCenter: true });
  }
}

function resetInteractionState() {
  isDragging = false;
  isResizing = false;
  interactionMode = 'idle';
  resizeAnchor = null;
  dragOffset = null;
  dragLockedSize = null;
  applyClickThrough();
  mainWindow?.webContents?.send('interaction-reset');
}

function notifyWindowBoundsChanged(width, height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  mainWindow.webContents.send('window-bounds-changed', {
    width: width ?? bounds.width,
    height: height ?? bounds.height,
    petScale: settings.petScale,
  });
}



function getSettingsWindowBounds() {
  if (settings.panelBounds) {
    return { ...settings.panelBounds };
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    const b = mainWindow.getBounds();
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return {
      x: Math.round(cx - PANEL_WIDTH / 2),
      y: Math.round(Math.max(40, cy - PANEL_HEIGHT / 2)),
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
    };
  }
  return { width: PANEL_WIDTH, height: PANEL_HEIGHT };
}

function persistPanelBounds() {
  if (!settingsWindow || settingsWindow.isDestroyed()) return;
  settings.panelBounds = settingsWindow.getBounds();
  saveSettings();
}

function schedulePersistPanelBounds() {
  if (panelBoundsTimer) clearTimeout(panelBoundsTimer);
  panelBoundsTimer = setTimeout(() => {
    panelBoundsTimer = null;
    persistPanelBounds();
  }, 280);
}

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) return settingsWindow;

  const bounds = getSettingsWindowBounds();
  const iconPath = resolveIcon();
  const winIcon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  settingsWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    title: '桌面模型 · 控制中心',
    resizable: true,
    minWidth: PANEL_MIN_WIDTH,
    minHeight: PANEL_MIN_HEIGHT,
    alwaysOnTop: settings.alwaysOnTop,
    backgroundColor: '#f0f4f2',
    hasShadow: true,
    icon: winIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  settingsWindow.setMenu(null);
  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.on('close', (e) => {
    if (!appIsQuitting) {
      e.preventDefault();
      hideSettingsWindow();
    }
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.on('move', schedulePersistPanelBounds);
  settingsWindow.on('resize', schedulePersistPanelBounds);

  settingsWindow.webContents.on('did-finish-load', () => {
    broadcastSettings();
  });

  if (isDev) {
    settingsWindow.loadURL('http://localhost:5174/panel.html');
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../dist/panel.html'));
  }

  return settingsWindow;
}

function showSettingsWindow() {
  const win = createSettingsWindow();
  settings.settingsOpen = true;
  saveSettings();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  broadcastSettings();
}

function hideSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    persistPanelBounds();
    settingsWindow.hide();
  }
  settings.settingsOpen = false;
  saveSettings();
  broadcastSettings();
}

function poseLibraryUserPath(modelId) {
  const dir = path.join(app.getPath('userData'), 'pose-libraries');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${modelId || 'aqun_rig'}.poses.json`);
}

function poseLibraryBundledPath(modelId) {
  const file = `${modelId || 'aqun_rig'}.poses.json`;
  const devPath = path.join(__dirname, '../public/models', file);
  if (isDev && fs.existsSync(devPath)) return devPath;
  const candidates = [
    path.join(process.resourcesPath, 'models', file),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'models', file),
    path.join(app.getAppPath(), 'models', file),
    devPath,
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function readBundledPoseLibrary(modelId) {
  const bundled = poseLibraryBundledPath(modelId);
  if (!fs.existsSync(bundled)) return null;
  return JSON.parse(fs.readFileSync(bundled, 'utf8'));
}

function readUserPoseLibrary(modelId) {
  const userPath = poseLibraryUserPath(modelId);
  if (!fs.existsSync(userPath)) return null;
  return JSON.parse(fs.readFileSync(userPath, 'utf8'));
}

function readPoseLibrary(modelId) {
  const bundled = readBundledPoseLibrary(modelId);
  const user = readUserPoseLibrary(modelId);
  let merged = null;
  if (!bundled && !user) return null;
  if (!user) merged = bundled;
  else if (!bundled) merged = user;
  else {
    merged = {
      ...user,
      poses: { ...bundled.poses, ...user.poses },
      assignments: { ...bundled.assignments, ...user.assignments },
    };
  }
  if ((modelId === 'aqun_rig' || modelId === 'ty_rig') && merged?.assignments) {
    merged = {
      ...merged,
      assignments: { ...merged.assignments, rest: 'bind', typing: 'bind' },
    };
  }
  return merged;
}

function resolveModelFilePath(modelId) {
  const id = modelId || settings.petModelId || 'aqun_rig';
  const files = {
    aqun_rig: 'aqun_rig.glb',
    ty_rig: 'ty_rig.glb',
    aqun: 'aqun.glb',
    ty: 'ty.glb',
    aqun_pef: 'aqun_rig.glb',
    aqun_tripo: 'aqun_rig.glb',
  };
  const file = files[id] || files.aqun_rig;
  if (isDev) return path.join(__dirname, '../public/models', file);

  const candidates = [
    path.join(process.resourcesPath, 'models', file),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'models', file),
    path.join(app.getAppPath(), 'models', file),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0];
}

function createPoseEditorWindow() {
  if (poseEditorWindow && !poseEditorWindow.isDestroyed()) return poseEditorWindow;

  const iconPath = resolveRainbowIcon();
  const winIcon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  poseEditorWindow = new BrowserWindow({
    width: POSE_EDITOR_WIDTH,
    height: POSE_EDITOR_HEIGHT,
    show: false,
    title: '骨骼姿势编辑器',
    backgroundColor: '#12161a',
    icon: winIcon,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  poseEditorWindow.setMenu(null);
  poseEditorWindow.on('closed', () => {
    poseEditorWindow = null;
  });

  if (isDev) {
    poseEditorWindow.loadURL('http://localhost:5174/pose-editor.html');
  } else {
    poseEditorWindow.loadFile(path.join(__dirname, '../dist/pose-editor.html'));
  }

  return poseEditorWindow;
}

function showPoseEditorWindow() {
  const win = createPoseEditorWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
  return win;
}

function applyClickThrough() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const through = settings.clickThrough && !isDragging && !isResizing;
  mainWindow.setIgnoreMouseEvents(through, { forward: true });
}

function createWindow() {

  loadSettings();

  settings.settingsOpen = false;

  const iconPath = resolveIcon();

  const winIcon = iconPath ? nativeImage.createFromPath(iconPath) : undefined;

  const { width, height } = windowSizeForScale(settings.petScale);



  mainWindow = new BrowserWindow({

    width,

    height,

    transparent: true,

    frame: false,

    alwaysOnTop: settings.alwaysOnTop,

    skipTaskbar: false,

    resizable: false,

    hasShadow: false,

    thickFrame: false,

    backgroundColor: '#00000000',

    icon: winIcon,

    webPreferences: {

      preload: path.join(__dirname, 'preload.cjs'),

      contextIsolation: true,

      nodeIntegration: false,

      sandbox: false,

    },

  });



  mainWindow.setOpacity(settings.opacity);

  if (winIcon && !winIcon.isEmpty()) {

    mainWindow.setIcon(winIcon);

  }

  applyClickThrough();



  if (isDev) {

    mainWindow.loadURL('http://localhost:5174');

  } else {

    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  }



  mainWindow.on('closed', () => {
    mainWindow = null;
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.destroy();
      settingsWindow = null;
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    broadcastSettings();
    notifyWindowBoundsChanged();
  });
}



function createTray() {

  const iconPath = resolveIcon();

  const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon.resize({ width: 16, height: 16 }));



  const rebuildMenu = () => {

    tray.setContextMenu(

      Menu.buildFromTemplate([

        {

          label: mainWindow?.isVisible() ? '◉  暂时隐藏' : '○  重新显示',

          click: () => {

            if (!mainWindow) return;

            if (mainWindow.isVisible()) mainWindow.hide();

            else mainWindow.show();

          },

        },

        {

          label: '✦  控制中心',

          click: () => {
            showSettingsWindow();
            mainWindow?.show();
          },

        },

        { type: 'separator' },

        {

          label: settings.keyboardPaused ? '▶  恢复按键监听' : '⏸  暂停按键监听',

          type: 'checkbox',

          checked: !settings.keyboardPaused,

          click: () => {

            settings.keyboardPaused = !settings.keyboardPaused;

            setKeyboardPaused(settings.keyboardPaused);

            saveSettings();

            rebuildMenu();

            broadcastSettings();

          },

        },

        {

          label: '始终置顶',

          type: 'checkbox',

          checked: settings.alwaysOnTop,

          click: (item) => {

            settings.alwaysOnTop = item.checked;

            mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);

            saveSettings();

            broadcastSettings();

          },

        },

        {

          label: '锁定位置',

          type: 'checkbox',

          checked: settings.positionLocked,

          click: (item) => {

            settings.positionLocked = item.checked;

            saveSettings();

            broadcastSettings();

          },

        },

        {

          label: '窗口穿透',

          type: 'checkbox',

          checked: settings.clickThrough,

          click: (item) => {

            settings.clickThrough = item.checked;

            applyClickThrough();

            saveSettings();

            broadcastSettings();

          },

        },

        { type: 'separator' },

        {

          label: '⏻  关闭礼物',

          click: () => app.quit(),

        },

      ])

    );

  };



  rebuildMenu();

  rebuildTrayMenu = rebuildMenu;

  tray.setToolTip('桌面模型 · 3D 模型');

  tray.on('click', () => {

    if (!mainWindow) return;

    if (mainWindow.isVisible()) mainWindow.focus();

    else mainWindow.show();

  });

}



function requestMacAccessibilityIfNeeded() {
  if (process.platform !== 'darwin') return;
  setTimeout(() => {
    try {
      if (!systemPreferences.isTrustedAccessibilityClient(false)) {
        systemPreferences.isTrustedAccessibilityClient(true);
      }
    } catch (err) {
      console.warn('[mac] 辅助功能权限请求失败:', err.message);
    }
  }, 1500);
}

function setupKeyboardBridge() {

  aiAssistant.configure({
    getSettingsFn: () => settings,
    onSuggestion: (payload) => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send('ai-suggestion', payload);
    },
  });

  startKeyboardListener((payload) => {

    aiAssistant.onKeyEvent(payload);

    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.webContents.send('key-event', payload);

  });

  setKeyboardPaused(settings.keyboardPaused);

}



function setupIpc() {

  ipcMain.handle('get-device-location', async () => {
    const wc = pickWebContents([
      () => mainWindow?.webContents,
      () => settingsWindow?.webContents,
    ]);
    if (!wc) throw new Error('窗口未就绪，无法定位');
    return getDeviceLocation(wc);
  });

  ipcMain.handle('is-keyboard-available', () => isKeyboardAvailable());

  ipcMain.handle('get-model-url', (_event, modelId) => {
    const id = modelId || settings.petModelId || 'aqun_rig';
    const files = {
      aqun_rig: 'aqun_rig.glb',
      ty_rig: 'ty_rig.glb',
      aqun: 'aqun.glb',
      ty: 'ty.glb',
      aqun_pef: 'aqun_rig.glb',
      aqun_tripo: 'aqun_rig.glb',
    };
    const file = files[id] || files.aqun_rig;

    if (isDev) return `http://localhost:5174/models/${file}`;

    const modelPath = resolveModelFilePath(id);
    if (!fs.existsSync(modelPath)) {
      console.warn('[get-model-url] 模型文件缺失:', modelPath);
    }
    // pathToFileURL 正确编码中文/空格路径，避免 GLTFLoader 在便携目录下加载失败
    return pathToFileURL(modelPath).href;
  });

  ipcMain.handle('open-pose-editor', () => {
    showPoseEditorWindow();
    return { ok: true };
  });

  ipcMain.handle('get-pose-library', (_event, modelId) => {
    return readPoseLibrary(modelId || settings.petModelId || 'aqun_rig');
  });

  ipcMain.handle('save-pose-library', (_event, modelId, library) => {
    const id = modelId || settings.petModelId || 'aqun_rig';
    const target = poseLibraryUserPath(id);
    fs.writeFileSync(target, JSON.stringify(library, null, 2), 'utf8');
    return { ok: true, path: target };
  });

  ipcMain.handle('apply-pose-library', (_event, modelId, library) => {
    const id = modelId || settings.petModelId || 'aqun_rig';
    const target = poseLibraryUserPath(id);
    fs.writeFileSync(target, JSON.stringify(library, null, 2), 'utf8');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pose-library-applied', { modelId: id, library });
    }
    return { ok: true };
  });



  ipcMain.handle('get-window-state', () => ({
    windowVisible: mainWindow?.isVisible?.() ?? true,
  }));

  ipcMain.handle('open-context-popup', (_event, screenX, screenY) => {
    showContextPopup(screenX, screenY, {
      ...settings,
      windowVisible: mainWindow?.isVisible?.() ?? true,
    });
    return true;
  });

  ipcMain.handle('close-context-popup', () => {
    hideContextPopup();
    return true;
  });

  ipcMain.handle('resize-context-popup', (_event, contentHeight) => {
    resizeContextPopup(contentHeight);
    return true;
  });

  ipcMain.handle('open-settings-from-popup', () => {
    hideContextPopup();
    showSettingsWindow();
    mainWindow?.show();
    return true;
  });

  ipcMain.handle('open-settings-window', () => {
    showSettingsWindow();
    return true;
  });

  ipcMain.handle('set-settings-window-open', (_event, open) => {
    if (open) showSettingsWindow();
    else hideSettingsWindow();
    return true;
  });

  ipcMain.handle('panel-window-minimize', () => {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.minimize();
    }
    return true;
  });



  ipcMain.handle('open-external', (_event, url) => {

    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {

      shell.openExternal(url);

    }

  });

  ipcMain.handle('check-for-update', async () => {
    try {
      return await checkForUpdate({
        owner: repoConfig.owner,
        repo: repoConfig.repo,
        branch: repoConfig.branch,
        currentVersion: repoConfig.getCurrentVersion(),
      });
    } catch (err) {
      return {
        ok: false,
        error: err?.message || String(err),
        currentVersion: repoConfig.getCurrentVersion(),
        repoUrl: repoConfig.getRepoUrls().repoUrl,
      };
    }
  });

  ipcMain.handle('get-repo-info', () => ({
    owner: repoConfig.owner,
    repo: repoConfig.repo,
    branch: repoConfig.branch,
    currentVersion: repoConfig.getCurrentVersion(),
    ...repoConfig.getRepoUrls(),
  }));

  ipcMain.handle('get-reminders', () => getReminders());

  ipcMain.handle('save-reminder', (_event, payload) => upsertReminder(payload || {}));

  ipcMain.handle('delete-reminder', (_event, id) => deleteReminder(id));

  ipcMain.handle('toggle-reminder', (_event, id, enabled) => toggleReminder(id, enabled));

  ipcMain.handle('import-reminders', (_event, { items, replaceClasses } = {}) => {
    const list = importReminders(items || [], { replaceClasses: Boolean(replaceClasses) });
    broadcastRemindersChanged();
    return list;
  });



  ipcMain.handle('menu-action', (_event, action) => {

    switch (action) {

      case 'toggle-visible':

        if (!mainWindow) break;

        if (mainWindow.isVisible()) mainWindow.hide();

        else mainWindow.show();

        break;

      case 'toggle-keyboard':

        settings.keyboardPaused = !settings.keyboardPaused;

        setKeyboardPaused(settings.keyboardPaused);

        saveSettings();

        rebuildTrayMenu?.();

        broadcastSettings();

        break;

      case 'toggle-top':

        settings.alwaysOnTop = !settings.alwaysOnTop;

        mainWindow?.setAlwaysOnTop(settings.alwaysOnTop);

        saveSettings();

        rebuildTrayMenu?.();

        broadcastSettings();

        break;

      case 'toggle-lock':

        settings.positionLocked = !settings.positionLocked;

        saveSettings();

        rebuildTrayMenu?.();

        broadcastSettings();

        break;

      case 'toggle-through':

        settings.clickThrough = !settings.clickThrough;

        applyClickThrough();

        saveSettings();

        rebuildTrayMenu?.();

        broadcastSettings();

        break;

      case 'quit':

        app.quit();

        break;

      default:

        break;

    }

    return { ...settings, windowVisible: mainWindow?.isVisible?.() ?? true };

  });



  ipcMain.handle('get-settings', () => ({ ...settings }));

  ipcMain.handle('reset-settings', (_event, { scope } = {}) => {
    if (!scope || typeof scope !== 'string') {
      throw new Error('Missing reset scope');
    }
    return applyResetScope(scope);
  });

  ipcMain.handle('play-preview-anim', (_event, type) => {
    if (!mainWindow || mainWindow.isDestroyed()) return { ok: false };
    if (type !== 'tutorial' && type !== 'birthday') {
      throw new Error('Unknown preview type');
    }
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('play-preview-anim', type);
    return { ok: true };
  });



  ipcMain.on('settings-live', (_event, partial) => {
    Object.assign(settings, partial);
    applySettingsSideEffects(partial);
    if (!('petScale' in partial) || Object.keys(partial).length > 1) {
      broadcastSettings();
    }
  });

  ipcMain.on('pet-scale-live', (_event, scale) => {
    if (interactionMode === 'drag' || isDragging) return;
    applyLivePetScale(clampScale(scale));
  });

  ipcMain.handle('preview-pet-scale', (_event, scale) => {
    if (interactionMode === 'drag' || isDragging) return settings.petScale;
    applyLivePetScale(clampScale(scale));
    return settings.petScale;
  });

  ipcMain.handle('update-settings', (_event, partial) => {

    Object.assign(settings, partial);

    applySettingsSideEffects(partial, { resetInteraction: partial.petScale != null && !isResizing });

    if (partial.settingsOpen === true) showSettingsWindow();
    else if (partial.settingsOpen === false) hideSettingsWindow();

    saveSettings();

    broadcastSettings();

    return { ...settings };

  });



  ipcMain.on('window-scale-live', (_event, scale) => {
    if (interactionMode === 'drag' || isDragging) return;

    if (!isResizing) {
      interactionMode = 'resize';
      isResizing = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds();
        resizeAnchor = {
          cx: bounds.x + bounds.width / 2,
          cy: bounds.y + bounds.height / 2,
        };
      }
      applyClickThrough();
    }

    applyLivePetScale(scale, { anchor: resizeAnchor });
  });

  ipcMain.handle('set-window-scale-live', (_event, scale) => {
    if (interactionMode === 'drag' || isDragging) return settings.petScale;

    if (!isResizing) {
      interactionMode = 'resize';
      isResizing = true;
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds();
        resizeAnchor = {
          cx: bounds.x + bounds.width / 2,
          cy: bounds.y + bounds.height / 2,
        };
      }
      applyClickThrough();
    }

    applyLivePetScale(scale, { anchor: resizeAnchor });
    return settings.petScale;
  });



  ipcMain.handle('commit-window-scale', () => {

    settings.petScale = clampScale(settings.petScale);

    isResizing = false;
    interactionMode = 'idle';
    resizeAnchor = null;
    applyClickThrough();

    saveSettings();

    broadcastSettings();

    notifyWindowBoundsChanged();

    return settings.petScale;

  });



  ipcMain.on('toggle-settings', () => {
    if (settings.settingsOpen) hideSettingsWindow();
    else showSettingsWindow();
  });

  ipcMain.on('open-settings-panel', () => {
    showSettingsWindow();
  });



  ipcMain.handle('set-ignore-mouse-events', (_event, ignore, options) => {

    mainWindow?.setIgnoreMouseEvents(Boolean(ignore), options || { forward: true });

  });



  ipcMain.on('show-context-menu', () => {

    tray?.popUpContextMenu();

  });



  ipcMain.on('set-interaction-mode', (_event, mode) => {
    if (mode === 'drag') {
      interactionMode = 'drag';
      isDragging = true;
      isResizing = false;
      resizeAnchor = null;
      applyClickThrough();
      return;
    }
    if (mode === 'resize') {
      interactionMode = 'resize';
      isResizing = true;
      isDragging = false;
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds();
        resizeAnchor = {
          cx: bounds.x + bounds.width / 2,
          cy: bounds.y + bounds.height / 2,
        };
      }
      applyClickThrough();
      return;
    }
    interactionMode = 'idle';
    isDragging = false;
    isResizing = false;
    resizeAnchor = null;
    applyClickThrough();
  });

  ipcMain.on('window-drag-start', (_event, screenX, screenY) => {
    if (!mainWindow) return;
    interactionMode = 'drag';
    isDragging = true;
    isResizing = false;
    resizeAnchor = null;
    applyClickThrough();

    const expected = windowSizeForScale(settings.petScale);
    dragLockedSize = { width: expected.width, height: expected.height };

    const [curW, curH] = mainWindow.getSize();
    if (curW !== expected.width || curH !== expected.height) {
      applyWindowScale(settings.petScale, { keepCenter: true });
    }

    const [x, y] = mainWindow.getPosition();
    const sx = Number.isFinite(screenX) ? screenX : screen.getCursorScreenPoint().x;
    const sy = Number.isFinite(screenY) ? screenY : screen.getCursorScreenPoint().y;
    dragOffset = { x: sx - x, y: sy - y };
  });

  ipcMain.on('window-drag-move', (_event, screenX, screenY) => {
    if (!mainWindow || !dragOffset || !dragLockedSize) return;
    const sx = Number.isFinite(screenX) ? screenX : screen.getCursorScreenPoint().x;
    const sy = Number.isFinite(screenY) ? screenY : screen.getCursorScreenPoint().y;
    mainWindow.setBounds(
      {
        x: Math.round(sx - dragOffset.x),
        y: Math.round(sy - dragOffset.y),
        width: dragLockedSize.width,
        height: dragLockedSize.height,
      },
      false,
    );
  });

  ipcMain.on('window-drag-end', () => {
    if (mainWindow && !mainWindow.isDestroyed() && dragLockedSize) {
      const bounds = mainWindow.getBounds();
      if (bounds.width !== dragLockedSize.width || bounds.height !== dragLockedSize.height) {
        mainWindow.setBounds(
          {
            x: bounds.x,
            y: bounds.y,
            width: dragLockedSize.width,
            height: dragLockedSize.height,
          },
          false,
        );
      }
      notifyWindowBoundsChanged(dragLockedSize.width, dragLockedSize.height);
    }
    dragOffset = null;
    dragLockedSize = null;
    isDragging = false;
    interactionMode = 'idle';
    applyClickThrough();
  });

}



app.whenReady().then(() => {

  setupGeolocationPermissions(session.defaultSession);

  if (process.platform === 'win32') {

    app.setAppUserModelId('com.rainbowyu.aqun-pet');

  }

  maybeResetForNewMachine();

  createWindow();

  initContextPopup({
    dev: isDev,
    preload: path.join(__dirname, 'preload.cjs'),
    getWindow: () => mainWindow,
  });

  initReminders({
    getWindow: () => mainWindow,
    getIcon: resolveIcon,
    getEnabled: () => settings.remindersEnabled !== false,
  });

  createTray();

  setupIpc();

  setupKeyboardBridge();
  requestMacAccessibilityIfNeeded();
  startGlobalMouseTracker(() => mainWindow);
  refreshActionShortcuts();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (!mainWindow.isVisible()) mainWindow.show();
});

app.on('before-quit', () => {
  appIsQuitting = true;
  unregisterPetActionShortcuts();
  stopGlobalMouseTracker();
  stopKeyboardListener();
  stopReminders();
});

