/** 自定义右键快捷面板 */
export class ContextMenu {
  constructor({ root, panel, onAction, popupMode = false, onLayoutChange = null }) {
    this.root = root;
    this.panel = panel;
    this.onAction = onAction;
    this.popupMode = popupMode;
    this.onLayoutChange = onLayoutChange;
    this._open = false;
    this._anchor = { x: 0, y: 0 };

    this._onDocPointer = (e) => this._handleOutside(e);
    this._onKey = (e) => {
      if (e.key === 'Escape') this.hide();
    };

    this.panel?.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (!this.popupMode) this.hide();
        this.onAction?.(action);
      });
    });

    this.root?.querySelector('.ctx-backdrop')?.addEventListener('click', () => this.hide());
    this.root?.addEventListener('pointerdown', (e) => e.stopPropagation());
    this._bindContextTips();
  }

  _bindContextTips() {
    this._tipOpen = null;
    this.panel?.querySelectorAll('[data-ctx-tip]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._toggleTip(btn.dataset.ctxTip);
      });
    });
  }

  _toggleTip(key) {
    const pop = this.panel?.querySelector(`[data-ctx-tip-pop="${key}"]`);
    const btn = this.panel?.querySelector(`[data-ctx-tip="${key}"]`);
    if (!pop) return;
    const open = this._tipOpen === key;
    this._closeTips();
    if (!open) {
      pop.hidden = false;
      this._tipOpen = key;
      btn?.classList.add('is-active');
    }
    this._notifyLayoutChange();
  }

  _notifyLayoutChange() {
    if (!this.popupMode || !this.onLayoutChange) return;
    requestAnimationFrame(() => {
      const height = this.panel?.getBoundingClientRect().height ?? 0;
      if (height > 0) this.onLayoutChange(height);
    });
  }

  _closeTips() {
    this.panel?.querySelectorAll('[data-ctx-tip-pop]').forEach((el) => {
      el.hidden = true;
    });
    this.panel?.querySelectorAll('.ctx-tip-btn.is-active').forEach((el) => {
      el.classList.remove('is-active');
    });
    this._tipOpen = null;
    this._notifyLayoutChange();
  }

  isOpen() {
    return this._open;
  }

  showPopup(settings = {}) {
    if (!this.root || !this.panel) return;
    this._closeTips();
    this._syncLabels(settings);
    this._open = true;
    if (this.root) this.root.hidden = false;
    this._notifyLayoutChange();
  }

  async show(clientX, clientY, settings = {}) {
    if (this.popupMode) {
      this.showPopup(settings);
      return;
    }
    if (!this.root || !this.panel) return;

    this._closeTips();
    this._syncLabels(settings);
    this._anchor = { x: clientX, y: clientY };

    this.root.hidden = false;
    this._open = true;

    requestAnimationFrame(() => {
      this._positionPanel(clientX, clientY);
    });

    document.addEventListener('pointerdown', this._onDocPointer, true);
    document.addEventListener('keydown', this._onKey);
  }

  hide() {
    if (this.popupMode) return;
    if (!this._open) return;
    this._closeTips();
    this._open = false;
    if (this.root) this.root.hidden = true;
    document.removeEventListener('pointerdown', this._onDocPointer, true);
    document.removeEventListener('keydown', this._onKey);
  }

  _syncLabels(settings) {
    const visible = settings.windowVisible !== false;
    const visibleEl = this.root?.querySelector('[data-ctx-label="visible"]');
    if (visibleEl) visibleEl.textContent = visible ? '暂时隐藏' : '重新显示';

    const kbEl = this.root?.querySelector('[data-ctx-label="keyboard"]');
    if (kbEl) {
      kbEl.textContent = settings.keyboardPaused ? '恢复监听' : '暂停监听';
      kbEl.closest('.ctx-chip')?.classList.toggle('is-on', !settings.keyboardPaused);
    }

    const topEl = this.root?.querySelector('[data-ctx-label="top"]');
    if (topEl) {
      topEl.textContent = settings.alwaysOnTop ? '置顶中' : '置顶';
      topEl.closest('.ctx-chip')?.classList.toggle('is-on', settings.alwaysOnTop);
    }

    const lockEl = this.root?.querySelector('[data-ctx-label="lock"]');
    if (lockEl) {
      lockEl.textContent = settings.positionLocked ? '已锁定' : '锁定';
      lockEl.closest('.ctx-chip')?.classList.toggle('is-on', settings.positionLocked);
    }

    const throughEl = this.root?.querySelector('[data-ctx-label="through"]');
    if (throughEl) {
      throughEl.textContent = settings.clickThrough ? '穿透中' : '穿透';
      throughEl.closest('.ctx-chip')?.classList.toggle('is-on', settings.clickThrough);
    }
  }

  _positionPanel(clientX, clientY) {
    const pad = 8;
    const rect = this.panel.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - pad;
    const maxY = window.innerHeight - rect.height - pad;
    const x = Math.max(pad, Math.min(clientX, maxX));
    const y = Math.max(pad, Math.min(clientY, maxY));
    this.panel.style.left = `${x}px`;
    this.panel.style.top = `${y}px`;
  }

  _handleOutside(e) {
    if (this.panel?.contains(e.target)) return;
    this.hide();
  }

  dispose() {
    this.hide();
  }
}
