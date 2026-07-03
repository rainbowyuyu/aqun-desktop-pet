import * as THREE from 'three';
import { boneNameKeys, resolveBindEntry, resolveBoneOnSkeleton } from './boneNameUtils.js';
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
    this._bindPositions = new Map();
    this._locks = new Map();
    this._liveEuler = new Map();
    this._livePosition = new Map();
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
    this._bindPositions.clear();
    this._locks.clear();
    this._liveEuler.clear();
    this._livePosition.clear();
  }

  get isReady() {
    return !!this.skeleton;
  }

  captureBindPose() {
    this._bindQuats.clear();
    this._bindPositions.clear();
    this.skeleton.pose();
    this.skeleton.bones.forEach((bone) => {
      const q = bone.quaternion.clone();
      const p = bone.position.clone();
      for (const key of boneNameKeys(bone.name)) {
        this._bindQuats.set(key, q);
        this._bindPositions.set(key, p);
      }
    });
    this._liveEuler.clear();
    this._livePosition.clear();
  }

  listBones() {
    return this.skeleton?.bones ?? [];
  }

  getBone(name) {
    return resolveBoneOnSkeleton(this.skeleton, name);
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
    const bind = resolveBindEntry(this._bindQuats, name);
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

  getBonePosition(name) {
    if (this._livePosition.has(name)) {
      return [...this._livePosition.get(name)];
    }
    return this._computeBonePosition(name);
  }

  _computeBonePosition(name) {
    const bone = this.getBone(name);
    const bind = resolveBindEntry(this._bindPositions, name);
    if (!bone || !bind) return [0, 0, 0];
    return [
      bone.position.x - bind.x,
      bone.position.y - bind.y,
      bone.position.z - bind.z,
    ];
  }

  syncPositionFromBone(name) {
    const pos = this._computeBonePosition(name);
    this._livePosition.set(name, pos);
    return pos;
  }

  setBonePosition(name, position, { skipLive = false } = {}) {
    const bone = this.getBone(name);
    const bind = resolveBindEntry(this._bindPositions, name);
    if (!bone || !bind) return;
    const p = position ?? [0, 0, 0];
    bone.position.set(bind.x + p[0], bind.y + p[1], bind.z + p[2]);
    if (!skipLive) this._livePosition.set(name, [...p]);
  }

  setBoneEuler(name, euler, { skipLive = false } = {}) {
    const bone = this.getBone(name);
    const bind = resolveBindEntry(this._bindQuats, name);
    if (!bone || !bind) return;
    const e = euler ?? [0, 0, 0];
    bone.quaternion.copy(bind).multiply(quatFromEuler(e[0], e[1], e[2]));
    if (!skipLive) this._liveEuler.set(name, [...e]);
  }

  computeBoneQuaternion(name, euler) {
    const bind = resolveBindEntry(this._bindQuats, name);
    if (!bind) return null;
    return bind.clone().multiply(quatFromEuler(euler[0], euler[1], euler[2]));
  }

  resetBone(name) {
    const bind = resolveBindEntry(this._bindQuats, name);
    const bindPos = resolveBindEntry(this._bindPositions, name);
    const bone = this.getBone(name);
    if (bind && bone) bone.quaternion.copy(bind);
    if (bindPos && bone) bone.position.copy(bindPos);
    this._liveEuler.delete(name);
    this._livePosition.delete(name);
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
      if (entry?.position) {
        this.setBonePosition(name, entry.position);
      } else {
        const bindPos = resolveBindEntry(this._bindPositions, name);
        const bone = this.getBone(name);
        if (bindPos && bone) bone.position.copy(bindPos);
        this._livePosition.delete(name);
      }
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
      const position = this.getBonePosition(bone.name);
      bones[bone.name] = {
        euler,
        position,
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
