import * as THREE from 'three';
import { ModelLoader } from '../scene/ModelLoader.js';

/** 设置面板内模型缩略预览 */
export class ModelPreview {
  constructor(canvas, modelUrl) {
    this.canvas = canvas;
    this.modelUrl = modelUrl;
    this._running = false;
    this._raf = null;
    this._root = null;
    this._ready = null;
    this._resizeObserver = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.01, 50);
    this.camera.position.set(0, 0.78, 2.35);
    this.camera.lookAt(0, 0.72, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    const hemi = new THREE.HemisphereLight(0xfff8f0, 0xc8dcc8, 0.9);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(2, 3, 2);
    const fill = new THREE.DirectionalLight(0xe8f0ff, 0.45);
    fill.position.set(-2, 1, -1);
    this.scene.add(hemi, key, fill);

    this._ready = this._load();
  }

  async _load() {
    try {
      const loader = new ModelLoader();
      const result = await loader.loadWithRetry(this.modelUrl, 2);
      if (!result?.model) return;

      this._root = new THREE.Group();
      this._root.add(result.model);
      this.scene.add(this._root);
      this._resize();
    } catch (err) {
      console.warn('[ModelPreview] 加载失败:', this.modelUrl, err);
    }
  }

  whenReady() {
    return this._ready;
  }

  _resize() {
    const w = this.canvas.clientWidth || 120;
    const h = this.canvas.clientHeight || 88;
    if (w < 2 || h < 2) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _observeResize() {
    if (this._resizeObserver || typeof ResizeObserver === 'undefined') return;
    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.canvas);
  }

  async start() {
    if (this._running) return;
    await this._ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    this._resize();
    this._observeResize();
    if (!this._root) return;

    this._running = true;
    const tick = () => {
      if (!this._running) return;
      this._raf = requestAnimationFrame(tick);
      this._root.rotation.y += 0.008;
      this.renderer.render(this.scene, this.camera);
    };
    tick();
  }

  stop() {
    this._running = false;
    if (this._raf != null) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  async dispose() {
    this.stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    await this._ready.catch(() => {});
    if (this._root) {
      this._root.traverse((obj) => {
        if (obj.isMesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m?.dispose?.());
        }
      });
      this.scene.remove(this._root);
      this._root = null;
    }
    this.renderer.dispose();
  }
}
