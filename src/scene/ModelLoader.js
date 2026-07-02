import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { yieldFrames } from '../utils/scheduler.js';

/** 模型自身 Y 旋转 — 非绑骨 -90° 朝相机；绑骨在 Blender 朝前，再右旋 90° 面向观众 */
export const MODEL_FACE_Y = -Math.PI / 2;
export const RIG_FACE_Y = 0;
const TARGET_HEIGHT = 1.35;
const RIG_TARGET_HEIGHT = 1.28;

export class ModelLoader {
  constructor(onProgress) {
    this.onProgress = onProgress;
    this._lastProgressAt = 0;
    this.loader = new GLTFLoader();
    this.model = null;
    this.meshes = [];
    this.originalMaterials = new Map();
    this.animations = [];
    this.mixer = null;
    this.bounds = new THREE.Box3();
    this.actions = new Map();
    this._idleAction = null;
  }

  load(url) {
    const u = String(url || '');
    if (u.startsWith('file:')) return this._loadLegacy(u);
    return this._loadStreaming(u).catch(() => this._loadLegacy(u));
  }

  async loadWithRetry(url, retries = 3) {
    let lastErr;
    for (let i = 0; i < retries; i += 1) {
      try {
        return await this.load(url);
      } catch (err) {
        lastErr = err;
        if (i < retries - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
    }
    throw lastErr;
  }

  async _loadStreaming(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const total = Number(response.headers.get('Content-Length')) || 0;
    let buffer;

    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        this._emitProgress(loaded, total);
      }
      buffer = new Uint8Array(loaded);
      let offset = 0;
      for (const chunk of chunks) {
        buffer.set(chunk, offset);
        offset += chunk.length;
      }
      buffer = buffer.buffer;
    } else {
      buffer = await response.arrayBuffer();
      this._emitProgress(buffer.byteLength, total || buffer.byteLength);
    }

    await yieldFrames(1);
    const gltf = await this.loader.parseAsync(buffer, url);
    return this._finalize(gltf);
  }

  _loadLegacy(url) {
    return new Promise((resolve, reject) => {
      this.loader.load(
        url,
        (gltf) => this._finalize(gltf).then(resolve).catch(reject),
        (xhr) => {
          if (xhr.total > 0) this._emitProgress(xhr.loaded, xhr.total);
          else if (xhr.loaded > 0) this._emitProgress(xhr.loaded, 60000000);
        },
        reject
      );
    });
  }

  _emitProgress(loaded, total) {
    const now = performance.now();
    if (now - this._lastProgressAt < 120) return;
    this._lastProgressAt = now;
    if (total > 0) this.onProgress?.(loaded / total);
    else if (loaded > 0) this.onProgress?.(Math.min(loaded / 60000000, 0.95));
  }

  async _finalize(gltf) {
    this.model = gltf.scene;
    this.animations = gltf.animations || [];
    this._isRigModel = this._detectRigModel();
    await yieldFrames(1);
    this._normalizeModel();
    await yieldFrames(1);
    this._collectMeshes();

    if (this.animations.length > 0) {
      this.mixer = new THREE.AnimationMixer(this.model);
      this.animations.forEach((clip) => {
        this.actions.set(clip.name, this.mixer.clipAction(clip));
      });
      this._startIdleLoop();
    }

    return {
      model: this.model,
      meshes: this.meshes,
      bounds: this.bounds,
      mixer: this.mixer,
      animations: this.animations,
      actions: this.actions,
    };
  }

  _collectMeshes() {
    this.meshes = [];
    this.model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        this.originalMaterials.set(child, child.material);
        this.meshes.push(child);
      }
    });
  }

  _detectRigModel() {
    let skinned = 0;
    this.model.traverse((child) => {
      if (child.isSkinnedMesh) skinned += 1;
    });
    return skinned > 0;
  }

  _normalizeModel() {
    const isRig = this._isRigModel;
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const targetH = isRig ? RIG_TARGET_HEIGHT : TARGET_HEIGHT;
    const scale = targetH / size.y;
    this.model.scale.setScalar(scale);
    this.model.rotation.y = isRig ? RIG_FACE_Y : MODEL_FACE_Y;
    this.model.updateMatrixWorld(true);
    box.setFromObject(this.model);
    box.getCenter(center);
    this.model.position.sub(center);
    this.model.position.y += (box.max.y - box.min.y) / 2;
    if (isRig) {
      // 绑骨模型以躯干为中心，略向前抬升使头部居中
      this.model.position.y += 0.04;
      this.model.position.z -= 0.06;
    }
    this.bounds.setFromObject(this.model);
  }

  _startIdleLoop() {
    const idle = this.findClip(/^idle$/i) || this.findClip(/idle|breath|stand/i);
    if (!idle) return;
    idle.setLoop(THREE.LoopRepeat, Infinity);
    idle.clampWhenFinished = false;
    idle.reset().fadeIn(0.2).play();
    idle.setEffectiveTimeScale(this._isRigModel ? 1 : 0.9);
    this._idleAction = idle;
  }

  findClip(pattern) {
    if (typeof pattern === 'string') {
      return this.actions.get(pattern) ?? null;
    }
    for (const [name, action] of this.actions) {
      if (pattern.test(name)) return action;
    }
    return null;
  }

  playClip(nameOrPattern, { fade = 0.25, loop = false, timeScale = 1 } = {}) {
    if (!this.mixer) return null;
    let next = typeof nameOrPattern === 'string'
      ? this.actions.get(nameOrPattern)
      : null;
    if (!next && typeof nameOrPattern === 'string') {
      next = this.findClip(new RegExp(nameOrPattern, 'i'));
    }
    if (!next && nameOrPattern instanceof RegExp) {
      next = this.findClip(nameOrPattern);
    }
    if (!next) return null;

    const resumeIdle = !loop && this._idleAction && next !== this._idleAction;

    for (const action of this.actions.values()) {
      if (action !== next && action !== this._idleAction) action.fadeOut(fade);
    }
    if (resumeIdle) {
      this._idleAction.fadeOut(fade);
    }

    next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.setEffectiveTimeScale(timeScale);
    next.reset().fadeIn(fade).play();

    if (resumeIdle) {
      const onFinished = (e) => {
        if (e.action !== next) return;
        this.mixer.removeEventListener('finished', onFinished);
        this._idleAction.reset().setEffectiveWeight(1).fadeIn(fade).play();
      };
      this.mixer.addEventListener('finished', onFinished);
    }

    return next;
  }

  playClipOnce(nameOrPattern, fade = 0.2) {
    return this.playClip(nameOrPattern, { fade, loop: false });
  }

  hasClips() {
    return this.actions.size > 0;
  }

  /** 当前在播片段里实际有轨道的骨骼名 */
  getAnimatedBoneNames() {
    const names = new Set();
    if (!this.mixer) return names;
    for (const action of this.actions.values()) {
      if (!action.isRunning() || action.getEffectiveWeight() <= 0.12) continue;
      const clip = action.getClip();
      clip.tracks.forEach((track) => {
        const boneName = track.name.split('.')[0];
        if (boneName) names.add(boneName);
      });
    }
    return names;
  }

  /** 点头/戳等片段是否在驱动头颈（眼神应叠在动画之上而非跳过） */
  isHeadGestureActive() {
    if (!this.mixer) return false;
    const headGestures = /^(nod|poke)/i;
    for (const [name, action] of this.actions) {
      if (action === this._idleAction) continue;
      if (!headGestures.test(name)) continue;
      if (action.isRunning() && action.getEffectiveWeight() > 0.35) return true;
    }
    return false;
  }

  isGestureActive() {
    if (!this.mixer) return false;
    const gesturePattern = /^(wave|poke|nod|spin|sway)/i;
    for (const [name, action] of this.actions) {
      if (action === this._idleAction) continue;
      if (!action.isRunning() || action.getEffectiveWeight() <= 0.35) continue;
      if (this._isRigModel && !gesturePattern.test(name)) continue;
      return true;
    }
    return false;
  }

  /** 绑骨 GLB 动画是否正在驱动骨骼（含 idle 循环） */
  isSkinnedClipDriving() {
    if (!this.mixer || !this._isRigModel) return false;
    for (const action of this.actions.values()) {
      if (action.isRunning() && action.getEffectiveWeight() > 0.15) return true;
    }
    return false;
  }

  update(delta) {
    this.mixer?.update(delta);
  }
}
