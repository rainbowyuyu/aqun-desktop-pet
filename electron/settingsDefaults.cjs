/** 设置默认值与分区重置定义（主进程） */
const DEFAULT_SETTINGS = {
  opacity: 1,
  alwaysOnTop: true,
  keyboardPaused: false,
  clickThrough: false,
  petScale: 1,
  settingsOpen: false,
  tutorialSeen: false,
  birthdayIntroYear: null,
  /** 新电脑首次启动：强制播放欢迎动画（含生日开箱）并清本地缓存 */
  welcomeExperiencePending: false,
  lookSensitivity: 1,
  lookHeadSensitivity: 0.8,
  lookBodySensitivity: 0.48,
  lookHandSensitivity: 0.85,
  showKeyLabels: true,
  showBubble: true,
  idleChatter: true,
  positionLocked: false,
  petModelId: 'aqun_rig',
  fpsCap: 60,
  lowPowerMode: false,
  keyboardOpacity: 0.88,
  keyPressColor: '#e07898',
  networkChatter: true,
  remindersEnabled: true,
  aiEnabled: true,
  actionShortcutsEnabled: true,
  actionShortcuts: {
    spin: 'CommandOrControl+1',
    shake: 'CommandOrControl+2',
    headTurnLeft: 'CommandOrControl+3',
    headTurnRight: 'CommandOrControl+4',
    bounce: 'CommandOrControl+5',
  },
  weatherCity: '嘉定',
  weatherLat: 31.3835,
  weatherLon: 121.2505,
  weatherAutoLocate: true,
  weatherLocatedAt: null,
};

/** scope → 要恢复的键；reminders / all 由主进程特殊处理 */
const RESET_GROUPS = {
  appearance: ['petModelId', 'petScale', 'opacity'],
  interaction: [
    'lookSensitivity',
    'lookHeadSensitivity',
    'lookBodySensitivity',
    'lookHandSensitivity',
    'showKeyLabels',
    'showBubble',
    'idleChatter',
    'lowPowerMode',
    'keyboardOpacity',
    'keyPressColor',
    'networkChatter',
    'aiEnabled',
    'actionShortcutsEnabled',
    'actionShortcuts',
  ],
  system: [
    'positionLocked',
    'clickThrough',
    'alwaysOnTop',
    'keyboardPaused',
    'remindersEnabled',
  ],
  tutorial: ['tutorialSeen'],
};

function pickDefaults(keys) {
  const out = {};
  keys.forEach((key) => {
    if (key in DEFAULT_SETTINGS) out[key] = DEFAULT_SETTINGS[key];
  });
  return out;
}

function getAllDefaults() {
  return { ...DEFAULT_SETTINGS };
}

module.exports = {
  DEFAULT_SETTINGS,
  RESET_GROUPS,
  pickDefaults,
  getAllDefaults,
};
