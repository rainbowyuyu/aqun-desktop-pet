/** 模型窗口动作快捷键（渲染进程 UI + 逻辑共用） */
export const PET_BASE_WIDTH = 320;
export const PET_BASE_HEIGHT = 480;

export const DEFAULT_ACTION_SHORTCUTS = {
  spin: 'CommandOrControl+1',
  shake: 'CommandOrControl+2',
  headTurnLeft: 'CommandOrControl+3',
  headTurnRight: 'CommandOrControl+4',
  bounce: 'CommandOrControl+5',
};

export const PET_ACTION_SHORTCUTS = [
  {
    id: 'spin',
    slot: 1,
    label: '360° 旋转',
    desc: '正面 → 背面 → 正面转一圈',
  },
  {
    id: 'shake',
    slot: 2,
    label: '左右摇晃',
    desc: '轻轻左右晃一晃',
  },
  {
    id: 'headTurnLeft',
    slot: 3,
    label: '头向左转',
    desc: '头部向左旋转看过去',
  },
  {
    id: 'headTurnRight',
    slot: 4,
    label: '头向右转',
    desc: '头部向右旋转看过去',
  },
  {
    id: 'bounce',
    slot: 5,
    label: '蹦跳',
    desc: '小跳一下，活跃气氛',
  },
];

export function resolveActionShortcuts(custom = null) {
  const src = custom && typeof custom === 'object' ? custom : {};
  const legacyWave = src.wave && !src.headTurnLeft ? { headTurnLeft: src.wave } : {};
  const merged = { ...DEFAULT_ACTION_SHORTCUTS, ...legacyWave, ...src };
  delete merged.wave;
  delete merged.nod;
  return PET_ACTION_SHORTCUTS.map((meta) => ({
    ...meta,
    accelerator: merged[meta.id] || DEFAULT_ACTION_SHORTCUTS[meta.id],
  })).filter((item) => item.accelerator);
}

export function formatShortcutDisplay(accelerator) {
  return String(accelerator || '')
    .replace(/CommandOrControl/gi, 'Ctrl')
    .replace(/Command/gi, 'Cmd')
    .replace(/\+/g, ' + ');
}

const KEY_ALIASES = {
  ' ': 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
};

/** 从键盘事件生成 Electron accelerator 字符串 */
export function acceleratorFromKeyboardEvent(e) {
  if (!e || e.repeat) return null;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;

  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  let key = KEY_ALIASES[e.key] || e.key;
  if (key.length === 1) key = key.toUpperCase();
  if (/^F\d+$/.test(key)) {
    /* F1–F12 */
  } else if (/^\d$/.test(key)) {
    /* digit */
  } else if (key.length > 1) {
    key = key.charAt(0).toUpperCase() + key.slice(1);
  }

  parts.push(key);
  return parts.join('+');
}

export function windowSizeForPetScale(scale) {
  const s = Math.max(0.6, Math.min(1.8, Number(scale) || 1));
  return {
    width: Math.round(PET_BASE_WIDTH * s),
    height: Math.round(PET_BASE_HEIGHT * s),
  };
}
