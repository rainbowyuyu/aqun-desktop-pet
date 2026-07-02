const STORAGE_KEY = 'pe-editor-settings-v1';

export const DEFAULT_SETTINGS = {
  mode: 'edit',
  modelId: 'aqun_rig',
  showSkeleton: true,
  showBoneBoxes: true,
  showHeadMeshes: true,
  showBodyMeshes: true,
  showOtherMeshes: true,
  transformTool: 'translate',
  shortcuts: {
    toggleMode: 'Tab',
    previewMode: '1',
    editMode: '2',
    translateTool: 'g',
    rotateTool: 'r',
    toggleBoneBoxes: 'b',
    toggleSkeleton: 'h',
    savePose: 'Control+s',
    resetBone: 'Alt+r',
    deselectBone: 'Escape',
    focusBoneSearch: 'Control+f',
  },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, shortcuts: { ...DEFAULT_SETTINGS.shortcuts } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...(parsed.shortcuts ?? {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, shortcuts: { ...DEFAULT_SETTINGS.shortcuts } };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function formatShortcut(combo) {
  return String(combo)
    .replace(/Control/gi, 'Ctrl')
    .replace(/\+/g, ' + ');
}

function normalizeKey(key) {
  if (key === ' ') return 'Space';
  if (key.length === 1) return key.toLowerCase();
  return key;
}

export function matchShortcut(event, combo) {
  if (!combo) return false;
  const parts = String(combo).split('+').map((p) => p.trim());
  const keyPart = normalizeKey(parts[parts.length - 1]);
  const needCtrl = parts.some((p) => /^control$/i.test(p));
  const needShift = parts.some((p) => /^shift$/i.test(p));
  const needAlt = parts.some((p) => /^alt$/i.test(p));

  if (needCtrl !== (event.ctrlKey || event.metaKey)) return false;
  if (needShift !== event.shiftKey) return false;
  if (needAlt !== event.altKey) return false;

  const eventKey = normalizeKey(event.key);
  return eventKey === keyPart || event.code === keyPart;
}
