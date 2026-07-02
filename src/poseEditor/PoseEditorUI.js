import {
  blendPoseData,
  cloneLibrary,
  createEmptyLibrary,
  deletePose,
  ease,
  exportPoseFromController,
  findTransition,
  upsertPose,
  validateLibrary,
} from '../scene/PoseLibrary.js';
import {
  DEFAULT_SETTINGS,
  formatShortcut,
  loadSettings,
  matchShortcut,
  saveSettings,
} from './PoseEditorSettings.js';
import { getPoseEditorModels } from '../pet/modelRegistry.js';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export class PoseEditorUI {
  constructor(root, {
    scene,
    getModelId,
    onLibraryChange,
    onApplyToPet,
    onSaveFile,
    onModelSelect,
  }) {
    this.root = root;
    this.scene = scene;
    this.getModelId = getModelId ?? (() => 'aqun_rig');
    this.onLibraryChange = onLibraryChange;
    this.onApplyToPet = onApplyToPet;
    this.onSaveFile = onSaveFile;
    this.onModelSelect = onModelSelect;

    this.library = createEmptyLibrary();
    this.activePoseId = 'bind';
    this.selectedBone = null;
    this._previewRaf = null;
    this.settings = loadSettings();
    this._meshVisibility = new Map();
    this._rigged = true;
    this._loading = false;

    this._cacheDom();
    this._bindEvents();
    this._renderShortcutUI();
    this.setMode(this.settings.mode ?? 'edit', { silent: true });
    this.setTransformTool(this.settings.transformTool ?? 'translate', { silent: true });
  }

  _cacheDom() {
    const q = (sel) => this.root.querySelector(sel);
    this.els = {
      boneSearch: q('[data-bone-search]'),
      boneList: q('[data-bone-list]'),
      boneName: q('[data-bone-name]'),
      bonePos: q('[data-bone-pos]'),
      boneLock: q('[data-bone-lock]'),
      rotX: q('[data-rot-x]'),
      rotY: q('[data-rot-y]'),
      rotZ: q('[data-rot-z]'),
      rotXVal: q('[data-rot-x-val]'),
      rotYVal: q('[data-rot-y-val]'),
      rotZVal: q('[data-rot-z-val]'),
      resetBone: q('[data-reset-bone]'),
      poseList: q('[data-pose-list]'),
      poseName: q('[data-pose-name]'),
      poseNew: q('[data-pose-new]'),
      poseDup: q('[data-pose-dup]'),
      poseDel: q('[data-pose-del]'),
      poseSave: q('[data-pose-save]'),
      assignRest: q('[data-assign-rest]'),
      assignTyping: q('[data-assign-typing]'),
      transFrom: q('[data-trans-from]'),
      transTo: q('[data-trans-to]'),
      transDur: q('[data-trans-dur]'),
      transEase: q('[data-trans-ease]'),
      transPreview: q('[data-trans-preview]'),
      transSave: q('[data-trans-save]'),
      exportJson: q('[data-export-json]'),
      importFile: q('[data-import-file]'),
      applyPet: q('[data-apply-pet]'),
      resetAll: q('[data-reset-all]'),
      status: q('[data-editor-status]'),
      loadProgress: q('[data-load-progress]'),
      modeBtns: [...this.root.querySelectorAll('[data-mode]')],
      viewportMode: q('[data-viewport-mode]'),
      viewportToolbar: q('[data-viewport-toolbar]'),
      boneSliders: q('[data-bone-sliders]'),
      partHead: q('[data-part-head]'),
      partBody: q('[data-part-body]'),
      partOther: q('[data-part-other]'),
      meshList: q('[data-mesh-list]'),
      optSkeleton: q('[data-opt-skeleton]'),
      optBoneBoxes: q('[data-opt-bone-boxes]'),
      shortcutList: q('[data-shortcut-list]'),
      shortcutForm: q('[data-shortcut-form]'),
      modelList: q('[data-model-list]'),
      rigNotice: q('[data-rig-notice]'),
      toolBtns: [...this.root.querySelectorAll('[data-tool]')],
      panelTabs: [...this.root.querySelectorAll('[data-tab]')],
      tabPanels: [...this.root.querySelectorAll('[data-tab-panel]')],
      openSettings: q('[data-open-settings]'),
      settingsBackdrop: q('[data-settings-backdrop]'),
      closeSettings: q('[data-close-settings]'),
    };
    this.els.importJson = q('[data-import-json]');
  }

  _bindEvents() {
    this.els.boneSearch?.addEventListener('input', () => this.renderBoneList());
    this.els.boneLock?.addEventListener('change', () => {
      if (!this.selectedBone) return;
      this.scene.pose.setLocked(this.selectedBone, this.els.boneLock.checked);
      this.scene.selectBone(this.selectedBone);
      this._loadBoneEditor(this.selectedBone);
      this._syncPoseFromViewport();
    });

    for (const axis of ['X', 'Y', 'Z']) {
      const slider = this.els[`rot${axis}`];
      const label = this.els[`rot${axis}Val`];
      slider?.addEventListener('input', () => {
        if (!this.selectedBone || this.scene.getMode() !== 'edit' || this.scene.pose.isLocked(this.selectedBone)) return;
        const val = Number(slider.value);
        if (label) label.textContent = `${val.toFixed(1)}°`;
        const euler = this.scene.pose.getBoneEuler(this.selectedBone);
        const idx = axis === 'X' ? 0 : axis === 'Y' ? 1 : 2;
        euler[idx] = val * DEG2RAD;
        this.scene.pose.setBoneEuler(this.selectedBone, euler);
        this.scene.render();
        this._updateBonePositionDisplay(this.selectedBone);
        this._syncPoseFromViewport();
      });
    }

    this.els.resetBone?.addEventListener('click', () => {
      if (!this.selectedBone) return;
      this.scene.pose.resetBone(this.selectedBone);
      this._loadBoneEditor(this.selectedBone);
      this._syncPoseFromViewport();
      this.scene.render();
    });

    this.els.poseNew?.addEventListener('click', () => this._newPose());
    this.els.poseDup?.addEventListener('click', () => this._dupPose());
    this.els.poseDel?.addEventListener('click', () => this._delPose());
    this.els.poseSave?.addEventListener('click', () => this._savePoseToLibrary());
    this.els.poseName?.addEventListener('change', () => this._renamePose());

    this.els.assignRest?.addEventListener('change', () => {
      this.library.assignments.rest = this.els.assignRest.value;
      this._notifyLibraryChange();
    });
    this.els.assignTyping?.addEventListener('change', () => {
      this.library.assignments.typing = this.els.assignTyping.value;
      this._notifyLibraryChange();
    });

    this.els.transPreview?.addEventListener('click', () => this._previewTransition());
    this.els.transSave?.addEventListener('click', () => this._saveTransition());

    this.els.exportJson?.addEventListener('click', () => this._exportJson());
    this.els.importJson?.addEventListener('click', () => this.els.importFile?.click());
    this.els.importFile?.addEventListener('change', (e) => this._importFile(e));
    this.els.applyPet?.addEventListener('click', () => this.onApplyToPet?.(cloneLibrary(this.library)));
    this.els.resetAll?.addEventListener('click', () => {
      this.scene.pose.resetAll();
      this._loadPose('bind');
      this.setStatus('已重置为 Bind');
    });

    for (const btn of this.els.modeBtns) {
      btn.addEventListener('click', () => this.setMode(btn.dataset.mode));
    }

    this.els.partHead?.addEventListener('change', () => this._onPartGroupChange('head', this.els.partHead.checked));
    this.els.partBody?.addEventListener('change', () => this._onPartGroupChange('body', this.els.partBody.checked));
    this.els.partOther?.addEventListener('change', () => this._onPartGroupChange('other', this.els.partOther.checked));

    this.els.optSkeleton?.addEventListener('change', () => {
      this.settings.showSkeleton = this.els.optSkeleton.checked;
      this._persistSettings();
      this.scene.applyEditorSettings(this.settings);
    });
    this.els.optBoneBoxes?.addEventListener('change', () => {
      this.settings.showBoneBoxes = this.els.optBoneBoxes.checked;
      this._persistSettings();
      this.scene.applyEditorSettings(this.settings);
    });

    for (const btn of this.els.toolBtns ?? []) {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool === 'select') return;
        this.setTransformTool(tool);
      });
    }

    for (const tab of this.els.panelTabs ?? []) {
      tab.addEventListener('click', () => this._switchTab(tab.dataset.tab));
    }

    this.els.openSettings?.addEventListener('click', () => this._openSettingsPanel());
    this.els.closeSettings?.addEventListener('click', () => this._closeSettingsPanel());
    this.els.settingsBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.els.settingsBackdrop) this._closeSettingsPanel();
    });
  }

  _switchTab(tabId) {
    for (const tab of this.els.panelTabs ?? []) {
      const active = tab.dataset.tab === tabId;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    }
    for (const panel of this.els.tabPanels ?? []) {
      const active = panel.dataset.tabPanel === tabId;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    }
  }

  _openSettingsPanel() {
    if (this.els.settingsBackdrop) {
      this.els.settingsBackdrop.hidden = false;
      this._renderShortcutUI();
    }
  }

  _closeSettingsPanel() {
    if (this.els.settingsBackdrop) {
      this.els.settingsBackdrop.hidden = true;
    }
  }

  setTransformTool(tool, { silent = false } = {}) {
    const next = tool === 'rotate' ? 'rotate' : 'translate';
    this.settings.transformTool = next;
    this._persistSettings();
    this.scene.setTransformTool(next);

    for (const btn of this.els.toolBtns ?? []) {
      if (btn.dataset.tool === 'select') continue;
      btn.classList.toggle('is-active', btn.dataset.tool === next);
      btn.disabled = this.scene.getMode() !== 'edit' || !this._rigged;
    }

    this._updateViewportToolbar();
    if (!silent) {
      this.setStatus(next === 'rotate' ? '旋转工具 — 拖拽色环调整骨骼' : '移动工具 — 拖拽箭头调整骨骼位置');
    }
  }

  _updateViewportToolbar() {
    if (!this.els.viewportToolbar) return;
    const mode = this.scene.getMode();
    const tool = this.settings.transformTool ?? 'translate';
    if (mode === 'preview') {
      this.els.viewportToolbar.innerHTML = `
        <span class="pe-toolbar-chip pe-toolbar-chip--accent">拖拽旋转视角</span>
        <span class="pe-toolbar-chip">滚轮缩放</span>
        <span class="pe-toolbar-chip">右键平移</span>`;
      return;
    }
    const toolHint = tool === 'rotate'
      ? '<span class="pe-toolbar-chip pe-toolbar-chip--accent">拖拽色环旋转</span>'
      : '<span class="pe-toolbar-chip pe-toolbar-chip--accent">拖拽箭头移动</span>';
    this.els.viewportToolbar.innerHTML = `
      <span class="pe-toolbar-chip">左键点选骨骼</span>
      ${toolHint}
      <span class="pe-toolbar-chip">G 移动 · R 旋转</span>`;
  }

  initAfterModelLoad() {
    this.renderMeshParts();
    this._syncPartTogglesFromSettings();
    this.scene.applyEditorSettings(this.settings);
    this.setMode(this.settings.mode ?? 'edit', { silent: true });
    this.setTransformTool(this.settings.transformTool ?? 'translate', { silent: true });
  }

  bindShortcuts() {
    this._onKeyDown = (event) => {
      const tag = event.target?.tagName?.toLowerCase();
      const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
      const sc = this.settings.shortcuts;

      if (matchShortcut(event, sc.focusBoneSearch)) {
        event.preventDefault();
        this.els.boneSearch?.focus();
        return;
      }

      if (inField && !matchShortcut(event, sc.deselectBone)) return;

      if (matchShortcut(event, sc.toggleMode)) {
        event.preventDefault();
        this.setMode(this.scene.getMode() === 'preview' ? 'edit' : 'preview');
        return;
      }
      if (matchShortcut(event, sc.previewMode)) {
        event.preventDefault();
        this.setMode('preview');
        return;
      }
      if (matchShortcut(event, sc.editMode)) {
        event.preventDefault();
        this.setMode('edit');
        return;
      }
      if (matchShortcut(event, sc.toggleBoneBoxes)) {
        event.preventDefault();
        this.settings.showBoneBoxes = !this.settings.showBoneBoxes;
        if (this.els.optBoneBoxes) this.els.optBoneBoxes.checked = this.settings.showBoneBoxes;
        this._persistSettings();
        this.scene.applyEditorSettings(this.settings);
        return;
      }
      if (matchShortcut(event, sc.translateTool) && this.scene.getMode() === 'edit') {
        event.preventDefault();
        this.setTransformTool('translate');
        return;
      }
      if (matchShortcut(event, sc.rotateTool) && this.scene.getMode() === 'edit') {
        event.preventDefault();
        this.setTransformTool('rotate');
        return;
      }
      if (matchShortcut(event, sc.toggleSkeleton)) {
        event.preventDefault();
        this.settings.showSkeleton = !this.settings.showSkeleton;
        if (this.els.optSkeleton) this.els.optSkeleton.checked = this.settings.showSkeleton;
        this._persistSettings();
        this.scene.applyEditorSettings(this.settings);
        return;
      }
      if (matchShortcut(event, sc.savePose)) {
        event.preventDefault();
        this._savePoseToLibrary();
        return;
      }
      if (matchShortcut(event, sc.resetBone) && this.scene.getMode() === 'edit' && this.selectedBone) {
        event.preventDefault();
        this.scene.pose.resetBone(this.selectedBone);
        this._loadBoneEditor(this.selectedBone);
        this._syncPoseFromViewport();
        this.scene.render();
        return;
      }
      if (matchShortcut(event, sc.deselectBone)) {
        event.preventDefault();
        if (this.els.settingsBackdrop && !this.els.settingsBackdrop.hidden) {
          this._closeSettingsPanel();
        } else {
          this.clearBoneSelection();
        }
      }
    };
    document.addEventListener('keydown', this._onKeyDown);
  }

  setMode(mode, { silent = false } = {}) {
    const next = mode === 'preview' ? 'preview' : 'edit';
    if (next === 'edit' && !this._rigged) {
      if (!silent) this.setStatus('当前模型无骨骼，无法进入编辑模式');
      return;
    }
    this.settings.mode = next;
    this._persistSettings();
    this.scene.setMode(next);

    for (const btn of this.els.modeBtns) {
      btn.classList.toggle('is-active', btn.dataset.mode === next);
    }

    if (this.els.viewportMode) {
      this.els.viewportMode.textContent = next === 'preview' ? '预览模式' : '编辑模式';
      this.els.viewportMode.dataset.mode = next;
    }

    this._updateViewportToolbar();

    for (const btn of this.els.toolBtns ?? []) {
      if (btn.dataset.tool === 'select') continue;
      btn.disabled = next !== 'edit' || !this._rigged;
    }

    this.root.classList.toggle('pe-app--preview', next === 'preview');
    this.root.classList.toggle('pe-app--edit', next === 'edit');
    this._updateEditability();
    if (!silent) {
      this.setStatus(next === 'preview' ? '预览模式 — 可自由旋转视角' : '编辑模式 — 点选骨骼，G/R 切换移动与旋转');
    }
  }

  _updateEditability() {
    const isEdit = this.scene.getMode() === 'edit' && this._rigged;
    const locked = !this.selectedBone || this.scene.pose.isLocked(this.selectedBone);
    if (this.els.boneLock) this.els.boneLock.disabled = !isEdit || !this.selectedBone;
    if (this.els.resetBone) this.els.resetBone.disabled = !isEdit || !this.selectedBone;
    if (this.els.boneSliders) {
      this.els.boneSliders.classList.toggle('is-disabled', !isEdit);
    }
    for (const axis of ['X', 'Y', 'Z']) {
      const slider = this.els[`rot${axis}`];
      if (slider) slider.disabled = !isEdit || locked || !this.selectedBone;
    }
  }

  clearBoneSelection() {
    this.selectedBone = null;
    this.scene.selectBone(null);
    if (this.els.boneName) this.els.boneName.textContent = '—';
    if (this.els.bonePos) this.els.bonePos.textContent = '世界坐标 —';
    this.renderBoneList();
    this._updateEditability();
    this.setStatus('已取消选中');
  }

  renderMeshParts() {
    const list = this.els.meshList;
    const parts = this.scene.getMeshParts();
    if (!list || !parts?.items?.length) {
      if (list) list.innerHTML = '<p class="pe-empty">暂无网格数据</p>';
      return;
    }

    list.innerHTML = parts.items.map((item) => {
      const checked = item.mesh.visible ? 'checked' : '';
      const groupLabel = item.group === 'head' ? '头' : item.group === 'body' ? '身' : '其他';
      return `<label class="pe-mesh-item">
        <input type="checkbox" data-mesh-id="${item.id}" ${checked} />
        <span class="pe-mesh-item-name">${item.label}</span>
        <span class="pe-mesh-item-tag">${groupLabel}</span>
      </label>`;
    }).join('');

    list.querySelectorAll('[data-mesh-id]').forEach((input) => {
      input.addEventListener('change', () => {
        this.scene.setMeshVisible(input.dataset.meshId, input.checked);
        this._meshVisibility.set(input.dataset.meshId, input.checked);
      });
    });
  }

  _onPartGroupChange(group, visible) {
    const key = group === 'head' ? 'showHeadMeshes' : group === 'body' ? 'showBodyMeshes' : 'showOtherMeshes';
    this.settings[key] = visible;
    this._persistSettings();
    this.scene.setMeshGroupVisible(group, visible);
    this.renderMeshParts();
  }

  _syncPartTogglesFromSettings() {
    if (this.els.partHead) this.els.partHead.checked = this.settings.showHeadMeshes !== false;
    if (this.els.partBody) this.els.partBody.checked = this.settings.showBodyMeshes !== false;
    if (this.els.partOther) this.els.partOther.checked = this.settings.showOtherMeshes !== false;
    if (this.els.optSkeleton) this.els.optSkeleton.checked = this.settings.showSkeleton !== false;
    if (this.els.optBoneBoxes) this.els.optBoneBoxes.checked = this.settings.showBoneBoxes !== false;
    this.setTransformTool(this.settings.transformTool ?? 'translate', { silent: true });
  }

  _persistSettings() {
    saveSettings(this.settings);
  }

  persistSettings() {
    this._persistSettings();
  }

  setLoading(loading) {
    this._loading = loading;
    this.root.classList.toggle('pe-app--loading', loading);
    for (const btn of this.els.modeBtns ?? []) {
      btn.disabled = loading;
    }
    this.root.querySelectorAll('[data-model-id]').forEach((btn) => {
      btn.disabled = loading;
    });
  }

  renderModelList(activeId) {
    const list = this.els.modelList;
    if (!list) return;
    const models = getPoseEditorModels();
    list.innerHTML = models.map((model) => {
      const active = model.id === activeId ? ' is-active' : '';
      const badge = model.rigged
        ? '<span class="pe-model-badge pe-model-badge--rig">绑骨</span>'
        : '<span class="pe-model-badge">静态</span>';
      return `<button type="button" class="pe-model-card${active}" data-model-id="${model.id}">
        <span class="pe-model-card-main">
          <strong class="pe-model-card-name">${model.name}</strong>
          <span class="pe-model-card-desc">${model.desc}</span>
        </span>
        ${badge}
      </button>`;
    }).join('');

    list.querySelectorAll('[data-model-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this._loading || btn.classList.contains('is-active')) return;
        this.onModelSelect?.(btn.dataset.modelId);
      });
    });
  }

  setRigged(rigged, modelMeta = null) {
    this._rigged = rigged;
    this.root.classList.toggle('pe-app--no-rig', !rigged);

    if (this.els.rigNotice) {
      if (rigged) {
        this.els.rigNotice.hidden = true;
      } else {
        this.els.rigNotice.hidden = false;
        this.els.rigNotice.textContent = `${modelMeta?.name ?? '当前模型'} 无骨骼绑定，仅可使用预览模式查看网格。`;
      }
    }

    for (const btn of this.els.modeBtns ?? []) {
      if (btn.dataset.mode === 'edit') {
        btn.disabled = !rigged || this._loading;
      }
    }

    if (this.els.applyPet) this.els.applyPet.disabled = !rigged || this._loading;
    if (this.els.poseSave) this.els.poseSave.disabled = !rigged;

    this._updateEditability();
  }

  _renderShortcutUI() {
    const labels = {
      toggleMode: '切换预览 / 编辑',
      previewMode: '预览模式',
      editMode: '编辑模式',
      translateTool: '移动工具',
      rotateTool: '旋转工具',
      toggleBoneBoxes: '显示骨骼框选',
      toggleSkeleton: '显示骨架线',
      savePose: '保存当前姿势',
      resetBone: '重置选中骨骼',
      deselectBone: '取消选中 / 关闭设置',
      focusBoneSearch: '聚焦骨骼搜索',
    };

    if (this.els.shortcutList) {
      this.els.shortcutList.innerHTML = Object.entries(labels).map(([key, label]) => {
        const combo = this.settings.shortcuts[key] ?? DEFAULT_SETTINGS.shortcuts[key];
        return `<div class="pe-shortcut-row"><span>${label}</span><kbd>${formatShortcut(combo)}</kbd></div>`;
      }).join('');
    }

    if (this.els.shortcutForm) {
      this.els.shortcutForm.innerHTML = Object.entries(labels).map(([key, label]) => {
        const val = this.settings.shortcuts[key] ?? DEFAULT_SETTINGS.shortcuts[key];
        return `<label class="pe-field">${label}
          <input type="text" data-shortcut-key="${key}" value="${val}" />
        </label>`;
      }).join('');

      this.els.shortcutForm.querySelectorAll('[data-shortcut-key]').forEach((input) => {
        input.addEventListener('change', () => {
          const k = input.dataset.shortcutKey;
          const v = input.value.trim();
          if (!v) return;
          this.settings.shortcuts[k] = v;
          this._persistSettings();
          this._renderShortcutUI();
        });
      });
    }
  }

  setLibrary(lib) {
    this.library = validateLibrary(lib) ? cloneLibrary(lib) : createEmptyLibrary(this.getModelId());
    this.renderPoseList();
    this.renderBoneList();
    this._fillAssignSelects();
    this._fillTransitionSelects();
    this._loadPose(this.library.assignments?.rest ?? 'bind');
  }

  setStatus(msg) {
    if (this.els.status) this.els.status.textContent = msg;
  }

  setLoadProgress(ratio) {
    if (!this.els.loadProgress) return;
    const pct = Math.round((ratio ?? 0) * 100);
    this.els.loadProgress.textContent = pct >= 100 ? '模型已加载' : `加载模型 ${pct}%`;
  }

  renderBoneList() {
    const list = this.els.boneList;
    if (!list || !this.scene.pose.isReady) {
      if (list && !this._rigged) {
        list.innerHTML = '<p class="pe-empty">此模型无骨骼</p>';
      }
      return;
    }
    const filter = (this.els.boneSearch?.value ?? '').trim().toLowerCase();
    const bones = this.scene.pose.listBones().filter(
      (b) => !filter || b.name.toLowerCase().includes(filter),
    );
    list.innerHTML = bones.map((b) => {
      const locked = this.scene.pose.isLocked(b.name);
      const active = b.name === this.selectedBone ? ' is-active' : '';
      return `<button type="button" class="pe-bone${active}" data-bone="${b.name}">
        <span class="pe-bone-name">${b.name}</span>
        ${locked ? '<span class="pe-bone-lock" title="已锁定">🔒</span>' : ''}
      </button>`;
    }).join('');

    list.querySelectorAll('[data-bone]').forEach((btn) => {
      btn.addEventListener('click', () => this.selectBone(btn.dataset.bone));
    });
  }

  selectBone(name, { fromViewport = false } = {}) {
    if (!name) {
      this.clearBoneSelection();
      return;
    }
    this.selectedBone = name;
    this.scene.selectBone(name);
    this._loadBoneEditor(name);
    this.renderBoneList();
    this._updateEditability();
    if (fromViewport) {
      this.setStatus(`视口选中：${name}`);
    }
  }

  refreshBoneEditor(name) {
    if (name !== this.selectedBone) return;
    this.scene.pose.syncEulerFromBone(name);
    this._loadBoneEditor(name);
  }

  syncPoseFromViewport() {
    this._syncPoseFromViewport();
  }

  _updateBonePositionDisplay(name) {
    if (!this.els.bonePos) return;
    const pos = this.scene.getBoneWorldPosition(name);
    if (!pos) {
      this.els.bonePos.textContent = '—';
      return;
    }
    this.els.bonePos.textContent = `X ${pos.x.toFixed(3)}  Y ${pos.y.toFixed(3)}  Z ${pos.z.toFixed(3)}`;
  }

  _loadBoneEditor(name) {
    const euler = this.scene.pose.getBoneEuler(name);
    const locked = this.scene.pose.isLocked(name);
    if (this.els.boneName) this.els.boneName.textContent = name;
    if (this.els.boneLock) this.els.boneLock.checked = locked;

    for (const [axis, idx] of [['X', 0], ['Y', 1], ['Z', 2]]) {
      const deg = euler[idx] * RAD2DEG;
      const slider = this.els[`rot${axis}`];
      const label = this.els[`rot${axis}Val`];
      if (slider) {
        slider.value = deg.toFixed(1);
        slider.disabled = locked;
      }
      if (label) label.textContent = `${deg.toFixed(1)}°`;
    }
    this._updateBonePositionDisplay(name);
    this._updateEditability();
  }

  renderPoseList() {
    const list = this.els.poseList;
    if (!list) return;
    const poses = Object.entries(this.library.poses ?? {});
    list.innerHTML = poses.map(([id, pose]) => {
      const active = id === this.activePoseId ? ' is-active' : '';
      const tags = [];
      if (this.library.assignments?.rest === id) tags.push('待机');
      if (this.library.assignments?.typing === id) tags.push('打字');
      return `<button type="button" class="pe-pose${active}" data-pose-id="${id}">
        <span class="pe-pose-name">${pose.name ?? id}</span>
        ${tags.length ? `<span class="pe-pose-tags">${tags.join(' · ')}</span>` : ''}
      </button>`;
    }).join('');

    list.querySelectorAll('[data-pose-id]').forEach((btn) => {
      btn.addEventListener('click', () => this._loadPose(btn.dataset.poseId));
    });

    if (this.els.poseName) {
      this.els.poseName.value = this.library.poses[this.activePoseId]?.name ?? this.activePoseId;
      this.els.poseName.disabled = this.activePoseId === 'bind';
    }
    if (this.els.poseDel) this.els.poseDel.disabled = this.activePoseId === 'bind';
    this._updateBonePositionDisplay(this.selectedBone);
  }

  _loadPose(id) {
    if (!this.library.poses[id]) return;
    this.activePoseId = id;
    this.scene.pose.resetAll();
    this.scene.pose.applyPoseData(this.library.poses[id].bones ?? {}, { respectLocks: false });
    this.renderPoseList();
    if (this.selectedBone) {
      this.scene.selectBone(this.selectedBone);
      this._loadBoneEditor(this.selectedBone);
    }
    this.scene.render();
    this.setStatus(`已加载姿势：${this.library.poses[id].name ?? id}`);
  }

  _syncPoseFromViewport() {
    if (this.activePoseId === 'bind') return;
    const exported = exportPoseFromController(
      this.scene.pose,
      this.activePoseId,
      this.library.poses[this.activePoseId]?.name,
    );
    upsertPose(this.library, this.activePoseId, exported);
    this._notifyLibraryChange(false);
  }

  _savePoseToLibrary() {
    const exported = exportPoseFromController(
      this.scene.pose,
      this.activePoseId,
      this.els.poseName?.value || this.activePoseId,
    );
    exported.name = this.els.poseName?.value || exported.name;
    upsertPose(this.library, this.activePoseId, exported);
    this.renderPoseList();
    this._notifyLibraryChange();
    this.setStatus(`已保存姿势「${exported.name}」`);
  }

  _newPose() {
    const id = `pose_${Date.now().toString(36)}`;
    const exported = exportPoseFromController(this.scene.pose, id, '新姿势');
    upsertPose(this.library, id, exported);
    this.activePoseId = id;
    this.renderPoseList();
    this._fillAssignSelects();
    this._fillTransitionSelects();
    this._notifyLibraryChange();
    this.setStatus('已创建新姿势');
  }

  _dupPose() {
    const src = this.library.poses[this.activePoseId];
    if (!src) return;
    const id = `${this.activePoseId}_copy_${Date.now().toString(36).slice(-4)}`;
    upsertPose(this.library, id, {
      name: `${src.name ?? this.activePoseId} 副本`,
      bones: JSON.parse(JSON.stringify(src.bones ?? {})),
    });
    this.activePoseId = id;
    this.renderPoseList();
    this._fillAssignSelects();
    this._fillTransitionSelects();
    this._notifyLibraryChange();
  }

  _delPose() {
    if (this.activePoseId === 'bind') return;
    deletePose(this.library, this.activePoseId);
    this.activePoseId = 'bind';
    this._loadPose('bind');
    this._fillAssignSelects();
    this._fillTransitionSelects();
    this._notifyLibraryChange();
  }

  _renamePose() {
    if (this.activePoseId === 'bind') return;
    const name = this.els.poseName?.value?.trim();
    if (!name) return;
    this.library.poses[this.activePoseId].name = name;
    this.renderPoseList();
    this._notifyLibraryChange(false);
  }

  _fillAssignSelects() {
    const opts = Object.entries(this.library.poses).map(
      ([id, p]) => `<option value="${id}">${p.name ?? id}</option>`,
    ).join('');
    for (const el of [this.els.assignRest, this.els.assignTyping]) {
      if (!el) continue;
      el.innerHTML = opts;
    }
    if (this.els.assignRest) this.els.assignRest.value = this.library.assignments?.rest ?? 'bind';
    if (this.els.assignTyping) this.els.assignTyping.value = this.library.assignments?.typing ?? 'bind';
  }

  _fillTransitionSelects() {
    const opts = Object.entries(this.library.poses).map(
      ([id, p]) => `<option value="${id}">${p.name ?? id}</option>`,
    ).join('');
    for (const el of [this.els.transFrom, this.els.transTo]) {
      if (!el) continue;
      el.innerHTML = opts;
    }
    if (this.els.transFrom) this.els.transFrom.value = this.activePoseId;
    if (this.els.transTo) this.els.transTo.value = this.library.assignments?.rest ?? 'bind';
  }

  _saveTransition() {
    const from = this.els.transFrom?.value;
    const to = this.els.transTo?.value;
    if (!from || !to) return;
    const tr = {
      id: `${from}_to_${to}`,
      from,
      to,
      duration: Math.max(0.05, Number(this.els.transDur?.value) || 0.35),
      easing: this.els.transEase?.value ?? 'sine.inOut',
    };
    this.library.transitions = (this.library.transitions ?? []).filter(
      (x) => !(x.from === from && x.to === to),
    );
    this.library.transitions.push(tr);
    this._notifyLibraryChange();
    this.setStatus(`已保存过渡 ${from} → ${to}`);
  }

  _previewTransition() {
    const from = this.els.transFrom?.value;
    const to = this.els.transTo?.value;
    if (!from || !to || !this.library.poses[from] || !this.library.poses[to]) return;

    const tr = findTransition(this.library, from, to) ?? {
      duration: Number(this.els.transDur?.value) || 0.35,
      easing: this.els.transEase?.value ?? 'sine.inOut',
    };
    const duration = Math.max(0.05, Number(tr.duration) || 0.35);
    const easing = tr.easing ?? 'sine.inOut';
    const poseA = this.library.poses[from];
    const poseB = this.library.poses[to];
    const locks = { ...this.scene.pose.getLocksMap() };

    if (this._previewRaf) cancelAnimationFrame(this._previewRaf);
    const t0 = performance.now();

    const step = (now) => {
      const raw = Math.min(1, (now - t0) / (duration * 1000));
      const t = ease(easing, raw);
      const blended = blendPoseData(poseA, poseB, t, locks);
      this.scene.pose.resetAll();
      this.scene.pose.applyPoseData(blended.bones, { respectLocks: true });
      this.scene.render();
      if (raw < 1) {
        this._previewRaf = requestAnimationFrame(step);
      } else {
        this.setStatus(`过渡预览完成：${from} → ${to}`);
      }
    };
    this._previewRaf = requestAnimationFrame(step);
  }

  _exportJson() {
    this._savePoseToLibrary();
    const json = JSON.stringify(this.library, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${this.library.modelId ?? 'model'}.poses.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.onSaveFile?.(this.library);
    this.setStatus('已导出 JSON');
  }

  async _importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const lib = JSON.parse(text);
      if (!validateLibrary(lib)) throw new Error('格式无效');
      this.setLibrary(lib);
      this._notifyLibraryChange();
      this.setStatus(`已导入 ${file.name}`);
    } catch (err) {
      this.setStatus(`导入失败：${err.message}`);
    }
    e.target.value = '';
  }

  _notifyLibraryChange(persist = true) {
    this.onLibraryChange?.(cloneLibrary(this.library), persist);
  }

  dispose() {
    if (this._previewRaf) cancelAnimationFrame(this._previewRaf);
    if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
  }
}
