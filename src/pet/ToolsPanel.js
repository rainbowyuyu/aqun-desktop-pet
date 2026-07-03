import { TOOL_APPS, getToolTemplate, bindTool } from './tools/toolDefinitions.js';

/** 小工具 — 图标入口 + 完整功能页 */
export class ToolsPanel {
  constructor({ root }) {
    this.root = root;
    this._activeTool = null;
    this._pomo = { running: false, left: 25 * 60, mode: 'focus', timer: null };
    this._detailBody = null;
    this._filter = '';
    this._mount();
  }

  _mount() {
    this.root.innerHTML = `
      <div class="tools-hub">
        <div class="tools-launcher" data-tools-launcher>
          <div class="tools-launcher-toolbar">
            <input type="search" class="tools-filter-input" data-tools-filter placeholder="搜索工具…（文献、番茄钟、LaTeX…）" />
            <span class="tools-filter-count" data-tools-count>${TOOL_APPS.length} 个工具</span>
          </div>
          <div class="tools-launcher-grid" data-tools-grid></div>
        </div>
        <div class="tools-detail" data-tools-detail hidden>
          <button type="button" class="tools-back-btn" data-tools-back>← 返回</button>
          <div class="tools-detail-body" data-tools-detail-body></div>
        </div>
      </div>
    `;

    this._launcher = this.root.querySelector('[data-tools-launcher]');
    this._detail = this.root.querySelector('[data-tools-detail]');
    this._detailBody = this.root.querySelector('[data-tools-detail-body]');
    this._grid = this.root.querySelector('[data-tools-grid]');
    this._filterInput = this.root.querySelector('[data-tools-filter]');
    this._countEl = this.root.querySelector('[data-tools-count]');

    this._renderGrid();
    this._filterInput?.addEventListener('input', () => {
      this._filter = (this._filterInput?.value || '').trim().toLowerCase();
      this._renderGrid();
    });
    this.root.querySelector('[data-tools-back]')?.addEventListener('click', () => this._closeTool());
  }

  _renderGrid() {
    if (!this._grid) return;
    const q = this._filter;
    const list = TOOL_APPS.filter(
      (t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.id.includes(q) ||
        (t.category && t.category.includes(q))
    );
    if (this._countEl) {
      this._countEl.textContent = q ? `${list.length} / ${TOOL_APPS.length} 个工具` : `${TOOL_APPS.length} 个工具`;
    }
    this._grid.innerHTML = list
      .map(
        (t) => `
      <button type="button" class="tools-launch-btn" data-tool-id="${t.id}">
        <span class="tools-launch-icon">${t.icon}</span>
        <span class="tools-launch-name">${t.name}</span>
        <span class="tools-launch-desc">${t.desc}</span>
        ${t.category ? `<span class="tools-launch-tag">${t.category}</span>` : ''}
      </button>`
      )
      .join('');
    this._grid.querySelectorAll('[data-tool-id]').forEach((btn) => {
      btn.addEventListener('click', () => this._openTool(btn.dataset.toolId));
    });
  }

  _openTool(id) {
    this._activeTool = id;
    this._launcher.hidden = true;
    this._detail.hidden = false;
    this._detailBody.innerHTML = getToolTemplate(id);
    bindTool(id, this);
  }

  _closeTool() {
    this._activeTool = null;
    this._stopPomo();
    clearInterval(this._tsTimer);
    this._tsTimer = null;
    this._detail.hidden = true;
    this._launcher.hidden = false;
  }

  _startPomo(displayEl, modeEl, startBtn) {

    this._pomo.running = true;
    if (startBtn) startBtn.textContent = '暂停';
    clearInterval(this._pomo.timer);
    this._pomo.timer = setInterval(() => {
      this._pomo.left -= 1;
      if (this._pomo.left <= 0) {
        const prevMode = this._pomo.mode;
        this._pomo.mode = prevMode === 'focus' ? 'break' : 'focus';
        this._pomo.left = this._pomo.mode === 'focus' ? 25 * 60 : 5 * 60;
        this._pomoOnPhaseEnd?.(prevMode);
      }
      this._updatePomoDisplay(displayEl, modeEl);
    }, 1000);
  }

  _stopPomo() {
    this._pomo.running = false;
    clearInterval(this._pomo.timer);
  }

  _updatePomoDisplay(el, modeEl) {
    if (!el) return;
    const m = Math.floor(this._pomo.left / 60);
    const s = this._pomo.left % 60;
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    el.dataset.mode = this._pomo.mode;
    if (modeEl) modeEl.textContent = this._pomo.mode === 'focus' ? '专注中' : '休息中';
  }

  onVisible() {}

  dispose() {
    this._stopPomo();
    clearInterval(this._tsTimer);
  }
}
