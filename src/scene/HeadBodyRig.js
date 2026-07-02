import * as THREE from 'three';
import {
  collectMeshEntries,
  classifyMeshes,
  computeNeckY,
  findNeckBone,
  splitMeshesByBounds,
} from './GltfParts.js';

function collectUpperBones(root, splitY) {
  root.updateMatrixWorld(true);
  const bones = [];
  root.traverse((obj) => {
    if (!obj.isBone) return;
    const wp = new THREE.Vector3();
    obj.getWorldPosition(wp);
    if (wp.y >= splitY - 0.02) bones.push(obj);
  });
  return bones;
}

/**
 * 头身分离：从 GLB 场景读取命名部件并挂载，不切割几何体。
 * - parts：按节点名 / parts.json 分配 mesh
 * - bone：单 mesh 蒙皮时用骨骼叠加
 * - unified：无法拆分时整体微动
 */
export class HeadBodyRig {
  constructor() {
    this.bodyGroup = new THREE.Group();
    this.headPivot = new THREE.Group();
    this.headGroup = new THREE.Group();
    this.headPivot.add(this.headGroup);
    this.headTarget = null;
    this.headBone = null;
    this.headBones = [];
    this.splitMeshes = [];
    this._lastAdditive = { x: 0, y: 0 };
    this._headRest = { x: 0, y: 0, z: 0 };
    this.mode = 'none';
    this.splitY = 0;
  }

  async setup(model, bounds, userScaleGroup, { partsConfig = null } = {}) {
    this.dispose(userScaleGroup);

    const entries = collectMeshEntries(model);
    let { head, body, unknown, config } = classifyMeshes(entries, partsConfig);

    // 配置/名称未识别时：多 mesh 按部件包围盒分配（仍不切割）
    if ((!head.length || !body.length) && entries.length > 1) {
      const size = bounds.getSize(new THREE.Vector3());
      const splitY = bounds.min.y + size.y * (config.neckYRatio ?? 0.68);
      const byBounds = splitMeshesByBounds(entries.map((e) => e.mesh), splitY);
      if (byBounds.head.length && byBounds.body.length) {
        head = byBounds.head;
        body = byBounds.body;
      }
    }

    // 仍未分出：未知 mesh 按 Y 中心归入最近一侧
    if (unknown.length && (head.length || body.length)) {
      const size = bounds.getSize(new THREE.Vector3());
      const splitY = bounds.min.y + size.y * (config.neckYRatio ?? 0.68);
      for (const entry of unknown) {
        const box = new THREE.Box3().setFromObject(entry.mesh);
        const cy = box.getCenter(new THREE.Vector3()).y;
        if (cy >= splitY) head.push(entry.mesh);
        else body.push(entry.mesh);
      }
    }

    const hasSkinnedParts = [...head, ...body].some((m) => m.isSkinnedMesh);
    if (head.length && body.length && !hasSkinnedParts) {
      return this._setupPartsMode(model, bounds, userScaleGroup, head, body, config);
    }
    if (head.length && body.length && hasSkinnedParts) {
      console.info('[HeadBodyRig] 蒙皮 mesh 不做部件分离，改用骨骼/整体模式');
    }

    // 单整体 mesh：骨骼叠加（保持原 mesh 完整）
    userScaleGroup.add(model);
    const size = bounds.getSize(new THREE.Vector3());
    this.splitY = bounds.min.y + size.y * (config.neckYRatio ?? 0.68);
    this.headPivot.position.y = this.splitY;

    const neckBone = findNeckBone(model, config.neckBone);
    const upperBones = collectUpperBones(model, this.splitY);

    if (neckBone || upperBones.length) {
      this.mode = 'bone';
      this.headBone = neckBone || upperBones[0];
      this.headBones = upperBones.length ? upperBones : [this.headBone];
      this.headTarget = this.headBone;
      this._headRest = {
        x: this.headBone.rotation.x,
        y: this.headBone.rotation.y,
        z: this.headBone.rotation.z,
      };
      this.splitMeshes = entries.map((e) => e.mesh);
      console.info('[HeadBodyRig] 单 mesh 模式：骨骼头身分离', this.headBone?.name);
      return this;
    }

    this.mode = 'unified';
    this.headTarget = null;
    this.splitMeshes = entries.map((e) => e.mesh);
    console.warn('[HeadBodyRig] 未识别部件且无骨骼，使用整体转动');
    return this;
  }

  _setupPartsMode(model, bounds, userScaleGroup, headMeshes, bodyMeshes, config) {
    this.mode = 'parts';
    this.headTarget = this.headGroup;
    this.splitY = computeNeckY(headMeshes, bodyMeshes, bounds, config.neckYRatio);
    this.headPivot.position.y = this.splitY;

    userScaleGroup.add(model);
    userScaleGroup.add(this.bodyGroup);
    userScaleGroup.add(this.headPivot);

    for (const mesh of bodyMeshes) {
      this.bodyGroup.attach(mesh);
    }
    for (const mesh of headMeshes) {
      this.headGroup.attach(mesh);
    }

    this.splitMeshes = [...headMeshes, ...bodyMeshes];
    console.info(
      '[HeadBodyRig] 部件模式：',
      headMeshes.map((m) => m.name || '(mesh)').join(', '),
      '| body:',
      bodyMeshes.map((m) => m.name || '(mesh)').join(', ')
    );
    return this;
  }

  revertAdditive() {
    if (this.mode !== 'bone' || (this._lastAdditive.x === 0 && this._lastAdditive.y === 0)) return;
    const ax = this._lastAdditive.x;
    const ay = this._lastAdditive.y;
    for (const bone of this.headBones) {
      const w = bone === this.headBone ? 1 : 0.5;
      bone.rotation.x -= ax * w;
      bone.rotation.y -= ay * w;
    }
  }

  applyAdditive(lookX, lookY) {
    if (this.mode === 'parts' || this.mode === 'unified') return;
    if (this.mode !== 'bone') return;

    for (const bone of this.headBones) {
      const w = bone === this.headBone ? 1 : 0.5;
      bone.rotation.x += lookX * w;
      bone.rotation.y += lookY * w;
    }
    this._lastAdditive = { x: lookX, y: lookY };
  }

  resetHeadPose() {
    if (this.mode === 'bone') {
      this.revertAdditive();
      this._lastAdditive = { x: 0, y: 0 };
    }
    if (this.headGroup && this.mode === 'parts') {
      this.headGroup.rotation.set(0, 0, 0);
    }
  }

  dispose(userScaleGroup) {
    if (this.mode === 'parts') {
      userScaleGroup?.remove(this.bodyGroup);
      userScaleGroup?.remove(this.headPivot);
      this.bodyGroup.clear();
      this.headGroup.clear();
    } else if (userScaleGroup?.children?.length) {
      for (const child of [...userScaleGroup.children]) {
        userScaleGroup.remove(child);
      }
    }
    this.resetHeadPose();
    this.headBone = null;
    this.headBones = [];
    this.headTarget = null;
    this.splitMeshes = [];
    this.mode = 'none';
  }
}
