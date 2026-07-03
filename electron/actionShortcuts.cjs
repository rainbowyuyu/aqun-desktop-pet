const { globalShortcut } = require('electron');

const DEFAULT_ACTION_SHORTCUTS = {
  spin: 'CommandOrControl+1',
  shake: 'CommandOrControl+2',
  headTurnLeft: 'CommandOrControl+3',
  headTurnRight: 'CommandOrControl+4',
  bounce: 'CommandOrControl+5',
};

const ACTION_IDS = ['spin', 'shake', 'headTurnLeft', 'headTurnRight', 'bounce'];

let registeredAccelerators = [];

function resolveActionShortcutBindings(custom) {
  const src = custom && typeof custom === 'object' ? custom : {};
  const legacyWave = src.wave && !src.headTurnLeft ? { headTurnLeft: src.wave } : {};
  const merged = { ...DEFAULT_ACTION_SHORTCUTS, ...legacyWave, ...src };
  delete merged.wave;
  delete merged.nod;
  return ACTION_IDS
    .map((id) => ({ id, accelerator: merged[id] || DEFAULT_ACTION_SHORTCUTS[id] }))
    .filter((item) => item.accelerator);
}

function unregisterAll() {
  for (const acc of registeredAccelerators) {
    try {
      globalShortcut.unregister(acc);
    } catch {
      /* ignore */
    }
  }
  registeredAccelerators = [];
}

function registerPetActionShortcuts(enabled, bindings, onAction) {
  unregisterAll();
  if (!enabled) return;

  for (const action of bindings) {
    try {
      const ok = globalShortcut.register(action.accelerator, () => {
        onAction?.(action.id);
      });
      if (ok) {
        registeredAccelerators.push(action.accelerator);
      } else {
        console.warn('[actionShortcuts] failed to register', action.accelerator);
      }
    } catch (err) {
      console.warn('[actionShortcuts] register error', action.accelerator, err.message);
    }
  }
}

function unregisterPetActionShortcuts() {
  unregisterAll();
}

module.exports = {
  DEFAULT_ACTION_SHORTCUTS,
  resolveActionShortcutBindings,
  registerPetActionShortcuts,
  unregisterPetActionShortcuts,
};
