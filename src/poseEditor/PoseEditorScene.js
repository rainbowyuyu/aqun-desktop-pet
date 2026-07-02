import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ModelLoader } from '../scene/ModelLoader.js';
import { PetLighting } from '../scene/PetLighting.js';
import { PoseController } from '../scene/PoseController.js';
import { collectMeshEntries, classifyMeshes, loadPartsConfig } from '../scene/GltfParts.js';
import { BoneEditorOverlay } from './BoneEditorOverlay.js';

export class PoseEditorScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1f24);

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    this.camera.position.set(0, 0.85, 2.6);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.72, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.mouseButtons = {
      LEFT: null,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.controls.update();

    this.lighting = new PetLighting(this.scene, this.renderer);
    this.modelLoader = new ModelLoader();
    this.pose = new PoseController();
    this.boneOverlay = null;
    this.model = null;
    this.meshes = [];
    this.meshParts = null;
    this._onBoneSelect = null;
    this._onBoneRotate = null;
    this._onModeChange = null;
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  setBoneCallbacks({ onSelect, onRotate, onModeChange } = {}) {
    this._onBoneSelect = onSelect;
    this._onBoneRotate = onRotate;
    this._onModeChange = onModeChange;
  }

  async loadModel(url, onProgress, modelId = 'aqun_rig') {
    this.modelLoader.onProgress = onProgress;
    const result = await this.modelLoader.loadWithRetry(url, 2);
    if (this.model) {
      this.scene.remove(this.model);
    }
    this.model = result.model;
    this.meshes = result.meshes;
    this.scene.add(this.model);
    this.pose.attach(this.model);
    const hasSkeleton = this.pose.isReady;

    const partsConfig = await loadPartsConfig(modelId, import.meta.env.BASE_URL, url);
    this._setupMeshParts(this.model, partsConfig);

    this.boneOverlay?.dispose();
    this.boneOverlay = new BoneEditorOverlay(
      this.scene,
      this.camera,
      this.canvas,
      this.pose,
      this.controls,
    );
    this.boneOverlay.onBoneSelect = (name) => this._onBoneSelect?.(name);
    this.boneOverlay.onBoneRotate = (name) => this._onBoneRotate?.(name);
    this.boneOverlay.onModeChange = (mode) => this._onModeChange?.(mode);
    if (hasSkeleton) {
      this.boneOverlay.attachToModel(this.model);
    }

    this.lighting.enhanceMaterials(this.meshes);
    this.lighting.fadeInDaylight(1.2);
    this.resize();
    this.render();
    return { ...result, hasSkeleton, modelId };
  }

  _setupMeshParts(model, partsConfig) {
    const entries = collectMeshEntries(model);
    const classified = classifyMeshes(entries, partsConfig);
    const meshMeta = entries.map((entry) => {
      let group = 'other';
      if (classified.head.includes(entry.mesh)) group = 'head';
      else if (classified.body.includes(entry.mesh)) group = 'body';
      return {
        id: entry.path || entry.name || `mesh_${entries.indexOf(entry)}`,
        label: entry.name || entry.path || '未命名网格',
        mesh: entry.mesh,
        group,
      };
    });

    this.meshParts = {
      head: classified.head,
      body: classified.body,
      other: classified.unknown.map((u) => u.mesh),
      items: meshMeta,
    };
  }

  getMeshParts() {
    return this.meshParts;
  }

  setMeshGroupVisible(group, visible) {
    if (!this.meshParts) return;
    const meshes = this.meshParts[group] ?? [];
    for (const mesh of meshes) {
      mesh.visible = visible;
    }
    this.render();
  }

  setMeshVisible(meshId, visible) {
    const item = this.meshParts?.items?.find((m) => m.id === meshId);
    if (!item) return;
    item.mesh.visible = visible;
    this.render();
  }

  applyEditorSettings(settings = {}) {
    if (settings.mode) {
      this.setMode(settings.mode);
    }
    if (settings.transformTool) {
      this.setTransformTool(settings.transformTool);
    }
    this.boneOverlay?.applySettings({
      showSkeleton: settings.showSkeleton,
      showBoneBoxes: settings.showBoneBoxes,
      transformTool: settings.transformTool,
    });
    if (this.meshParts) {
      this.setMeshGroupVisible('head', settings.showHeadMeshes !== false);
      this.setMeshGroupVisible('body', settings.showBodyMeshes !== false);
      this.setMeshGroupVisible('other', settings.showOtherMeshes !== false);
    }
  }

  setMode(mode) {
    this.boneOverlay?.setMode(mode);
  }

  setTransformTool(tool) {
    this.boneOverlay?.setTransformTool(tool);
  }

  getTransformTool() {
    return this.boneOverlay?.getTransformTool() ?? 'translate';
  }

  getMode() {
    return this.boneOverlay?.getMode() ?? 'edit';
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = Math.max(1, parent?.clientWidth ?? window.innerWidth);
    const h = Math.max(1, parent?.clientHeight ?? window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update() {
    const delta = this.clock.getDelta();
    this.controls.update();
    this.modelLoader.update(delta);
    this.pose.finalize();
    this.boneOverlay?.update();
  }

  selectBone(name) {
    this.boneOverlay?.setSelectedBone(name ?? null);
  }

  getBoneWorldPosition(name) {
    return this.boneOverlay?.getBoneWorldPosition(name) ?? null;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  playClip(name) {
    this.modelLoader.playClipOnce(name, 0.15);
  }

  stopClips() {
    this.modelLoader.mixer?.stopAllAction?.();
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.boneOverlay?.dispose();
    this.boneOverlay = null;
    this.pose.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
