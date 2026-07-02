import * as THREE from 'three';
import { EULER_ORDER } from './PoseLibrary.js';

function quatFromEuler(x, y, z) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, EULER_ORDER));
}

/**
 * 骨骼姿势控制器 — 编辑器与运行时共用
 * 欧拉均为相对 bind pose 的偏移
 */
export class PoseController {
  constructor() {
    this.skeleton = null;
    this.modelRoot = null;
    this._bindQuats = new Map();
    this._locks = new Map();
    this._liveEuler = new Map();
  }

  attach(root) {
    this.detach();
    this.modelRoot = root;
    root.traverse((obj) => {
      if (obj.isSkinnedMesh && obj.skeleton && !this.skeleton) {
        this.skeleton = obj.skeleton;
      }
    });
    if (!this.skeleton) return false;
    this.captureBindPose();
    return true;
  }

  detach() {
    this.skeleton = null;
    this.modelRoot = null;
    this._bindQuats.clear();
    this._locks.clear();
    this._liveEuler.clear();
  }

  get isReady() {
    return !!this.skeleton;
  }

  captureBindPose() {
    this._bindQuats.clear();
    this.skeleton.pose();
    this.skeleton.bones.forEach((bone) => {
      this._bindQuats.set(bone.name, bone.quaternion.clone());
    });
    this._liveEuler.clear();
  }

  listBones() {
    return this.skeleton?.bones ?? [];
  }

  getBone(name) {
    return this.skeleton?.bones.find((b) => b.name === name) ?? null;
  }

  isLocked(name) {
    return this._locks.get(name) ?? false;
  }

  setLocked(name, locked) {
    this._locks.set(name, !!locked);
  }

  setAllLocked(locked) {
    for (const bone of this.listBones()) {
      this._locks.set(bone.name, !!locked);
    }
  }

  getLocksMap() {
    const out = {};
    for (const bone of this.listBones()) {
      if (this.isLocked(bone.name)) out[bone.name] = true;
    }
    return out;
  }

  getBoneEuler(name) {
    if (this._liveEuler.has(name)) {
      return [...this._liveEuler.get(name)];
    }
    return this._computeBoneEuler(name);
  }

  _computeBoneEuler(name) {
    const bone = this.getBone(name);
    const bind = this._bindQuats.get(name);
    if (!bone || !bind) return [0, 0, 0];

    const delta = bind.clone().invert().multiply(bone.quaternion.clone());
    const e = new THREE.Euler().setFromQuaternion(delta, EULER_ORDER);
    return [e.x, e.y, e.z];
  }

  syncEulerFromBone(name) {
    const euler = this._computeBoneEuler(name);
    this._liveEuler.set(name, euler);
    return euler;
  }

  setBoneEuler(name, euler, { skipLive = false } = {}) {
    const bone = this.getBone(name);
    const bind = this._bindQuats.get(name);
    if (!bone || !bind) return;
    const e = euler ?? [0, 0, 0];
    bone.quaternion.copy(bind).multiply(quatFromEuler(e[0], e[1], e[2]));
    if (!skipLive) this._liveEuler.set(name, [...e]);
  }

  computeBoneQuaternion(name, euler) {
    const bind = this._bindQuats.get(name);
    if (!bind) return null;
    return bind.clone().multiply(quatFromEuler(euler[0], euler[1], euler[2]));
  }

  resetBone(name) {
    const bind = this._bindQuats.get(name);
    const bone = this.getBone(name);
    if (bind && bone) bone.quaternion.copy(bind);
    this._liveEuler.delete(name);
  }

  resetAll() {
    this.skeleton?.pose();
    this._liveEuler.clear();
    this.finalize();
  }

  applyPoseData(poseBones, { respectLocks = false, onlyUnlocked = false } = {}) {
    if (!poseBones) return;
    for (const [name, entry] of Object.entries(poseBones)) {
      if (respectLocks && this.isLocked(name)) continue;
      if (onlyUnlocked && this.isLocked(name)) continue;
      if (entry?.locked && respectLocks) continue;
      this.setBoneEuler(name, entry?.euler ?? [0, 0, 0]);
    }
    this.finalize();
  }

  applyBakedQuaternions(quatMap) {
    for (const [name, quat] of quatMap) {
      const bone = this.getBone(name);
      if (bone && quat) bone.quaternion.copy(quat);
    }
    this.finalize();
  }

  captureCurrentPose() {
    const bones = {};
    for (const bone of this.listBones()) {
      const euler = this.getBoneEuler(bone.name);
      bones[bone.name] = {
        euler,
        locked: this.isLocked(bone.name),
      };
    }
    return { bones };
  }

  finalize() {
    if (!this.skeleton) return;
    this.modelRoot?.updateMatrixWorld(true);
    this.skeleton.update();
  }

  dispose() {
    this.detach();
  }
}

export { quatFromEuler, EULER_ORDER };
