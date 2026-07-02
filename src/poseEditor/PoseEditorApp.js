import { PoseEditorScene } from './PoseEditorScene.js';
import { PoseEditorUI } from './PoseEditorUI.js';
import { cloneLibrary, createEmptyLibrary, validateLibrary } from '../scene/PoseLibrary.js';
import { getModelById, normalizeModelId, resolveModelFile } from '../pet/modelRegistry.js';

export class PoseEditorApp {
  constructor() {
    this.canvas = document.getElementById('pe-canvas');
    this.root = document.getElementById('pe-root');
    this.scene = new PoseEditorScene(this.canvas);
    this.modelId = 'aqun_rig';
    this._switching = false;
    this.ui = new PoseEditorUI(this.root, {
      scene: this.scene,
      getModelId: () => this.modelId,
      onLibraryChange: (lib, persist) => this._onLibraryChange(lib, persist),
      onApplyToPet: (lib) => this._applyToPet(lib),
      onSaveFile: (lib) => this._persistLibrary(lib),
      onModelSelect: (id) => this.switchModel(id),
    });
    this.modelId = normalizeModelId(this.ui.settings.modelId);
    this.scene.setBoneCallbacks({
      onSelect: (name) => {
        if (name) this.ui.selectBone(name, { fromViewport: true });
        else this.ui.clearBoneSelection();
      },
      onRotate: (name) => {
        this.ui.refreshBoneEditor(name);
        this.ui.syncPoseFromViewport();
      },
      onModeChange: (mode) => {
        this.ui.setMode(mode, { silent: true });
      },
    });
    this.ui.bindShortcuts();
    this._raf = null;
  }

  async init() {
    this.modelId = await this._resolveInitialModelId();
    this.ui.renderModelList(this.modelId);
    await this.switchModel(this.modelId, { initial: true });
    this._loop();
  }

  async _resolveInitialModelId() {
    const saved = normalizeModelId(this.ui.settings.modelId);
    try {
      const settings = await window.aqunPet?.getSettings?.();
      if (settings?.petModelId) {
        return normalizeModelId(settings.petModelId);
      }
    } catch {
      /* 独立浏览器模式 */
    }
    return saved;
  }

  async switchModel(modelId, { initial = false } = {}) {
    if (this._switching) return;
    const nextId = normalizeModelId(modelId);
    if (!initial && nextId === this.modelId && this.scene.pose.isReady) return;

    this._switching = true;
    this.modelId = nextId;
    this.ui.settings.modelId = nextId;
    this.ui.persistSettings();
    this.ui.renderModelList(nextId);
    this.ui.setLoading(true);

    try {
      const url = await this._resolveModelUrl(nextId);
      const result = await this.scene.loadModel(
        url,
        (p) => this.ui.setLoadProgress(p),
        nextId,
      );
      await this._loadLibrary(nextId);

      const modelMeta = getModelById(nextId);
      const hasSkeleton = result.hasSkeleton ?? this.scene.pose.isReady;
      this.ui.setRigged(hasSkeleton, modelMeta);

      this.ui.initAfterModelLoad();
      this.ui.renderMeshParts();
      this.ui.renderBoneList();

      if (hasSkeleton && this.scene.pose.listBones().length) {
        this.ui.selectBone(this.scene.pose.listBones()[0].name);
      } else {
        this.ui.clearBoneSelection();
        if (!hasSkeleton) {
          this.ui.setMode('preview', { silent: true });
        }
      }

      const modelName = modelMeta.name ?? nextId;
      if (hasSkeleton) {
        this.ui.setStatus(initial
          ? `编辑器就绪 — ${modelName} · Tab 切换预览 / 编辑`
          : `已切换至 ${modelName} — 可编辑骨骼姿势`);
      } else {
        this.ui.setStatus(`${modelName} 无骨骼绑定 — 仅预览模式可用`);
      }
    } catch (err) {
      this.ui.setStatus(`模型加载失败：${err.message}`);
    } finally {
      this.ui.setLoading(false);
      this._switching = false;
    }
  }

  async _resolveModelUrl(modelId) {
    const id = normalizeModelId(modelId);
    if (window.aqunPet?.getModelUrl) {
      return window.aqunPet.getModelUrl(id);
    }
    return `${import.meta.env.BASE_URL}models/${resolveModelFile(id)}`;
  }

  async _loadLibrary(modelId) {
    const id = normalizeModelId(modelId);
    let lib = null;
    try {
      if (window.aqunPet?.getPoseLibrary) {
        lib = await window.aqunPet.getPoseLibrary(id);
      }
    } catch {
      lib = null;
    }
    if (!lib) {
      const res = await fetch(`${import.meta.env.BASE_URL}models/${id}.poses.json`);
      if (res.ok) lib = await res.json();
    }
    if (validateLibrary(lib) && lib.modelId === id) {
      this.ui.setLibrary(lib);
    } else {
      this.ui.setLibrary(createEmptyLibrary(id));
    }
  }

  async _persistLibrary(lib) {
    try {
      await window.aqunPet?.savePoseLibrary?.(this.modelId, lib);
    } catch {
      /* 浏览器模式仅本地导出 */
    }
  }

  async _onLibraryChange(lib, persist) {
    if (persist) await this._persistLibrary(lib);
  }

  async _applyToPet(lib) {
    try {
      await window.aqunPet?.applyPoseLibrary?.(this.modelId, lib);
      const name = getModelById(this.modelId).name ?? this.modelId;
      this.ui.setStatus(`已应用到主窗口 — ${name} 姿势库即时生效`);
    } catch (err) {
      this.ui.setStatus(`应用失败：${err.message}`);
    }
  }

  _loop() {
    this.scene.update();
    this.scene.render();
    this._raf = requestAnimationFrame(() => this._loop());
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this.ui.dispose();
    this.scene.dispose();
  }
}
