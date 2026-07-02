const { contextBridge, ipcRenderer } = require('electron');



contextBridge.exposeInMainWorld('aqunPet', {

  getModelUrl: (modelId) => ipcRenderer.invoke('get-model-url', modelId),

  onKeyEvent: (callback) => {

    const handler = (_event, payload) => callback(payload);

    ipcRenderer.on('key-event', handler);

    return () => ipcRenderer.removeListener('key-event', handler);

  },

  isKeyboardAvailable: () => ipcRenderer.invoke('is-keyboard-available'),

  setIgnoreMouseEvents: (ignore, options) =>

    ipcRenderer.invoke('set-ignore-mouse-events', ignore, options),

  getSettings: () => ipcRenderer.invoke('get-settings'),

  getDeviceLocation: () => ipcRenderer.invoke('get-device-location'),

  getWindowState: () => ipcRenderer.invoke('get-window-state'),

  updateSettings: (partial) => ipcRenderer.invoke('update-settings', partial),

  resetSettings: (scope) => ipcRenderer.invoke('reset-settings', { scope }),

  playPreviewAnim: (type) => ipcRenderer.invoke('play-preview-anim', type),

  previewSettings: (partial) => ipcRenderer.send('settings-live', partial),

  previewPetScale: (scale) => ipcRenderer.send('pet-scale-live', scale),

  setWindowScaleLive: (scale) => ipcRenderer.send('window-scale-live', scale),

  commitWindowScale: () => ipcRenderer.invoke('commit-window-scale'),

  setInteractionMode: (mode) => ipcRenderer.send('set-interaction-mode', mode),

  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),

  openPoseEditor: () => ipcRenderer.invoke('open-pose-editor'),

  getPoseLibrary: (modelId) => ipcRenderer.invoke('get-pose-library', modelId),

  savePoseLibrary: (modelId, library) => ipcRenderer.invoke('save-pose-library', modelId, library),

  applyPoseLibrary: (modelId, library) => ipcRenderer.invoke('apply-pose-library', modelId, library),

  onPoseLibraryApplied: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('pose-library-applied', handler);
    return () => ipcRenderer.removeListener('pose-library-applied', handler);
  },

  setSettingsWindowOpen: (open) => ipcRenderer.invoke('set-settings-window-open', open),

  panelWindowMinimize: () => ipcRenderer.invoke('panel-window-minimize'),

  menuAction: (action) => ipcRenderer.invoke('menu-action', action),

  openContextPopup: (screenX, screenY) =>
    ipcRenderer.invoke('open-context-popup', screenX, screenY),

  closeContextPopup: () => ipcRenderer.invoke('close-context-popup'),

  openSettingsFromPopup: () => ipcRenderer.invoke('open-settings-from-popup'),

  onContextPopupShow: (callback) => {
    const handler = (_event, settings) => callback(settings);
    ipcRenderer.on('context-popup-show', handler);
    return () => ipcRenderer.removeListener('context-popup-show', handler);
  },

  onOpenSettingsPanel: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('open-settings-panel', handler);
    return () => ipcRenderer.removeListener('open-settings-panel', handler);
  },

  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),

  getRepoInfo: () => ipcRenderer.invoke('get-repo-info'),

  getReminders: () => ipcRenderer.invoke('get-reminders'),

  saveReminder: (payload) => ipcRenderer.invoke('save-reminder', payload),

  deleteReminder: (id) => ipcRenderer.invoke('delete-reminder', id),

  toggleReminder: (id, enabled) => ipcRenderer.invoke('toggle-reminder', id, enabled),

  importReminders: (items, options) => ipcRenderer.invoke('import-reminders', { items, ...options }),

  onReminderFired: (callback) => {
    const handler = (_event, reminder) => callback(reminder);
    ipcRenderer.on('reminder-fired', handler);
    return () => ipcRenderer.removeListener('reminder-fired', handler);
  },

  onRemindersChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('reminders-changed', handler);
    return () => ipcRenderer.removeListener('reminders-changed', handler);
  },

  windowDragStart: (x, y) => ipcRenderer.send('window-drag-start', x, y),

  windowDragMove: (x, y) => ipcRenderer.send('window-drag-move', x, y),

  windowDragEnd: () => ipcRenderer.send('window-drag-end'),

  onSettingsChanged: (callback) => {

    const handler = (_event, settings) => callback(settings);

    ipcRenderer.on('settings-changed', handler);

    return () => ipcRenderer.removeListener('settings-changed', handler);

  },

  onWindowBoundsChanged: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('window-bounds-changed', handler);
    return () => ipcRenderer.removeListener('window-bounds-changed', handler);
  },

  onInteractionReset: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('interaction-reset', handler);
    return () => ipcRenderer.removeListener('interaction-reset', handler);
  },

  onPlayPreviewAnim: (callback) => {
    const handler = (_event, type) => callback(type);
    ipcRenderer.on('play-preview-anim', handler);
    return () => ipcRenderer.removeListener('play-preview-anim', handler);
  },

  onGlobalMouse: (callback) => {

    const handler = (_event, payload) => callback(payload);

    ipcRenderer.on('global-mouse', handler);

    return () => ipcRenderer.removeListener('global-mouse', handler);

  },

  toggleSettings: () => ipcRenderer.send('toggle-settings'),

});

