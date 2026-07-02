import * as THREE from 'three';
import { ModelLoader } from '../scene/ModelLoader.js';
import { PetLighting } from '../scene/PetLighting.js';
import { HeadBodyRig } from '../scene/HeadBodyRig.js';
import { SkeletalRig } from '../scene/SkeletalRig.js';
import { loadPartsConfig } from '../scene/GltfParts.js';
import { loadMessageForProgress } from './bubbleCopy.js';

const VIEW_BASE_WIDTH = 320;
const VIEW_BASE_HEIGHT = 480;
const VIEW_ASPECT = VIEW_BASE_WIDTH / VIEW_BASE_HEIGHT;

export class PetScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.modelGroup = new THREE.Group();
    this.lookGroup = new THREE.Group();
    this.userScaleGroup = new THREE.Group();
    this.modelGroup.add(this.lookGroup);
    this.lookGroup.add(this.userScaleGroup);
    this.scene.add(this.modelGroup);
    this._hologramActive = false;
    this._visible = true;

    this.camera = new THREE.PerspectiveCamera(
      30,
      window.innerWidth / window.innerHeight,
      0.01,
      50
    );
    this.camera.position.set(0, 0.78, 2.35);
    this.camera.lookAt(0, 0.72, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.lighting = new PetLighting(this.scene, this.renderer);
    this.modelLoader = new ModelLoader();
    this.headBodyRig = new HeadBodyRig();
    this.skeletalRig = new SkeletalRig();
    this.model = null;
    this.meshes = [];
    this._headLookApply = null;
    this._skeletalLookApply = null;
    this._loadChain = Promise.resolve();

    this._onResize = () => {
      if (this._resizeDelegate) {
        this._resizeDelegate();
        return;
      }
      this.onResize();
    };
    this._onVisibility = () => {
      this._visible = !document.hidden;
      if (this._visible) this.render();
    };
    this._onContextLost = (e) => e.preventDefault();
    this._onContextRestored = () => {
      this.lighting?.ensureMinimumLight(0);
      this.render();
    };
    window.addEventListener('resize', this._onResize);
    document.addEventListener('visibilitychange', this._onVisibility);
    this.canvas.addEventListener('webglcontextlost', this._onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
  }

  clearModel() {
    this.headBodyRig?.revertAdditive?.();
    this.headBodyRig?.resetHeadPose?.();
    this.skeletalRig?.dispose?.();
    this.modelLoader?.mixer?.stopAllAction?.();

    while (this.userScaleGroup.children.length > 0) {
      const child = this.userScaleGroup.children[0];
      this.userScaleGroup.remove(child);
      this._disposeObject3D(child);
    }

    this.model = null;
    this.meshes = [];
    this._headLookApply = null;
    this._skeletalLookApply = null;
    this.headBodyRig = new HeadBodyRig();
    this.skeletalRig = new SkeletalRig();
    this.modelLoader = new ModelLoader();
  }

  queueLoadModel(url, onProgress, modelId = 'aqun_rig') {
    const run = () => this._loadModelInternal(url, onProgress, modelId);
    const next = this._loadChain.then(run, run);
    this._loadChain = next.catch(() => {});
    return next;
  }

  async _loadModelInternal(url, onProgress, modelId = 'aqun_rig') {
    this.clearModel();
    this.modelLoader.onProgress = onProgress;
    const result = await this.modelLoader.loadWithRetry(url, 3);
    if (!result?.model) throw new Error('模型为空');
    this.model = result.model;
    this.meshes = result.meshes;
    this.modelGroup.rotation.set(0, 0, 0);
    this.userScaleGroup.add(this.model);

    const partsConfig = await loadPartsConfig(modelId, import.meta.env.BASE_URL, url);
    this.skeletalRig.setup(this.model);

    if (this.skeletalRig.isActive) {
      await this.skeletalRig.loadPoseLibraryFromUrl(
        `${import.meta.env.BASE_URL}models/${modelId}.poses.json`,
      );
      this.headBodyRig.mode = 'skeleton';
      console.info('[PetScene] 蒙皮骨骼模式');
    } else {
      await this.headBodyRig.setup(this.model, this.modelLoader.bounds, this.userScaleGroup, {
        partsConfig,
      });
      if (this.headBodyRig.splitMeshes.length > 0) {
        this.meshes = this.headBodyRig.splitMeshes;
      }
    }
    this.lighting.enhanceMaterials(this.meshes);
    this.lighting.fadeInDaylight(1.8);
    this.lighting.ensureMinimumLight(2500);
    this.render();
    return result;
  }

  async swapModel(url, onProgress, modelId) {
    return this.queueLoadModel(url, onProgress, modelId);
  }

  async loadModel(url, onProgress, modelId) {
    return this.queueLoadModel(url, onProgress, modelId);
  }

  _disposeObject3D(root) {
    root.traverse((obj) => {
      if (obj.isMesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });
  }

  setLightingMood(mode) {
    if (this._hologramActive && mode !== 'idle') return;
    this.lighting.setMood(mode);
  }

  setHologramMode(enabled) {
    this._hologramActive = enabled;
    this.lighting.setHologramTint(enabled);
    const emissive = enabled ? 0x44ddcc : 0x000000;
    const emissiveIntensity = enabled ? 0.35 : 0;
    this.meshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat) return;
        mat.emissive?.setHex(emissive);
        if (mat.emissiveIntensity != null) mat.emissiveIntensity = emissiveIntensity;
        mat.transparent = enabled;
        mat.opacity = enabled ? 0.85 : 1;
        mat.needsUpdate = true;
      });
    });
  }

  setResizeDelegate(fn) {
    this._resizeDelegate = fn;
  }

  onResize(explicitW, explicitH) {
    let w = Math.max(1, explicitW || window.innerWidth);
    let h = Math.max(1, explicitH || window.innerHeight);

    if (!explicitW || !explicitH) {
      const ratio = w / h;
      if (Math.abs(ratio - VIEW_ASPECT) > 0.012) {
        h = Math.round(w / VIEW_ASPECT);
      }
    } else {
      const ratio = w / h;
      if (Math.abs(ratio - VIEW_ASPECT) > 0.012) {
        h = Math.round(w / VIEW_ASPECT);
      }
    }

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  update(delta) {
    if (!this.skeletalRig?.isActive) {
      this.headBodyRig?.revertAdditive();
    }
    this.modelLoader.update(delta);
    if (this.skeletalRig?.isActive) {
      const clipDrives = this.modelLoader.isSkinnedClipDriving?.();
      if (!clipDrives) {
        this.skeletalRig.preMixerUpdate();
        this.skeletalRig.applyIdleMotion(delta);
      }
      const headGesture = this.modelLoader.isHeadGestureActive?.();
      if (headGesture) {
        this.skeletalRig.snapshotGestureHeadPose();
      } else {
        this.skeletalRig.clearGestureHeadSnapshot();
        this.skeletalRig.restoreHeadNeckBind();
      }
      if (this._skeletalLookApply) {
        this.skeletalRig.applyLook(this._skeletalLookApply);
      }
      this.skeletalRig.finalizeUpdate();
    } else if (this._headLookApply) {
      this.headBodyRig?.applyAdditive(this._headLookApply.x, this._headLookApply.y);
    }
  }

  setSkeletalAnimContext(ctx) {
    this._skeletalAnimCtx = ctx;
  }

  setHeadLookApply(pose) {
    this._headLookApply = pose;
    this._skeletalLookApply = null;
  }

  setSkeletalLookApply(pose) {
    this._skeletalLookApply = pose;
    this._headLookApply = null;
  }

  get usesSkeleton() {
    return this.skeletalRig?.isActive ?? false;
  }

  shouldRender() {
    return this._visible;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
    this.renderer.dispose();
  }
}

export function resolveModelUrl() {
  if (window.aqunPet?.getModelUrl) {
    return window.aqunPet.getModelUrl();
  }
  return `${import.meta.env.BASE_URL}models/aqun_rig.glb`;
}

export { loadMessageForProgress };
