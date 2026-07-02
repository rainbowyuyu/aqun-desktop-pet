import * as THREE from 'three';
import {
  bakePoseQuaternions,
  cloneLibrary,
  validateLibrary,
} from './PoseLibrary.js';
import { PoseController } from './PoseController.js';

const HEAD_NAMES = ['c_head.x', 'head.x', 'headx', 'Head', 'head', 'mixamorig:Head'];
const NECK_NAMES = ['c_neck.x', 'neck.x', 'neckx', 'Neck', 'mixamorig:Neck'];
const ROOT_NAMES = ['c_root.x', 'c_root_bend.x', 'c_root_bendx', 'root', 'mixamorig:Hips'];
const SPINE_LOWER_NAMES = [
  'c_spine_01.x', 'c_spine_01_bend.x', 'c_spine_01_bendx',
  'spine_01.x', 'mixamorig:Spine',
];
const SPINE_NAMES = [
  'c_spine_02.x', 'c_spine_02_bend.x', 'c_spine_02_bendx',
  'spine_02.x', 'Spine', 'mixamorig:Spine1',
];
const CHEST_NAMES = ['c_spine_03.x', 'c_spine_03_bend.x', 'c_spine_03_bendx', 'spine_03.x', 'mixamorig:Spine2'];

const ARM_L = {
  shoulder: ['shoulder.l', 'shoulderl'],
  upper: ['c_arm_stretch.l', 'c_arm_stretchl'],
  forearm: ['c_forearm_stretch.l', 'c_forearm_stretchl'],
  hand: ['hand.l', 'handl'],
};
const ARM_R = {
  shoulder: ['shoulder.r', 'shoulderr'],
  upper: ['c_arm_stretch.r', 'c_arm_stretchr'],
  forearm: ['c_forearm_stretch.r', 'c_forearm_stretchr'],
  hand: ['hand.r', 'handr'],
};

const LEG_L = {
  thigh: ['c_thigh_stretch.l', 'c_thigh_stretchl'],
  foot: ['foot.l', 'footl'],
};
const LEG_R = {
  thigh: ['c_thigh_stretch.r', 'c_thigh_stretchr'],
  foot: ['foot.r', 'footr'],
};

const FINGER_CHAINS_L = [
  { names: ['c_thumb2.l', 'c_thumb3.l'], curls: [0.08, 0.12] },
  { names: ['c_index1_base.l', 'c_index2.l', 'c_index3.l'], curls: [0.1, 0.14, 0.1] },
  { names: ['c_middle1_base.l', 'c_middle2.l', 'c_middle3.l'], curls: [0.1, 0.15, 0.11] },
  { names: ['c_ring1_base.l', 'c_ring2.l', 'c_ring3.l'], curls: [0.11, 0.16, 0.12] },
  { names: ['c_pinky1_base.l', 'c_pinky2.l', 'c_pinky3.l'], curls: [0.12, 0.17, 0.13] },
];
const FINGER_CHAINS_R = [
  { names: ['c_thumb2.r', 'c_thumb3.r'], curls: [0.08, 0.12] },
  { names: ['c_index1_base.r', 'c_index2.r', 'c_index3.r'], curls: [0.1, 0.14, 0.1] },
  { names: ['c_middle1_base.r', 'c_middle2.r', 'c_middle3.r'], curls: [0.1, 0.15, 0.11] },
  { names: ['c_ring1_base.r', 'c_ring2.r', 'c_ring3.r'], curls: [0.11, 0.16, 0.12] },
  { names: ['c_pinky1_base.r', 'c_pinky2.r', 'c_pinky3.r'], curls: [0.12, 0.17, 0.13] },
];

/** A-pose：袖子→shoulder，小臂/手掌→arm/forearm/hand，指尖网格→全部指骨 */
const ARM_APOSE_L = {
  shoulder: [0.35, 0.04, -1.15],
  upper: [1.85, 0.03, -0.15],
  forearm: [0.82, 0.01, 0.08],
  hand: [0.35, 0.01, 0.03],
  fingerHang: [1.55, 0.02, -0.12],
};
const ARM_APOSE_R = {
  shoulder: [0.35, -0.04, 1.15],
  upper: [1.85, -0.03, 0.15],
  forearm: [0.82, -0.01, -0.08],
  hand: [0.35, -0.01, -0.03],
  fingerHang: [1.55, -0.02, 0.12],
};

const ARM_TYPING_L = {
  shoulder: [0.32, 0.04, -1.0],
  upper: [1.55, 0.03, -0.22],
  forearm: [0.72, 0.02, 0.06],
  hand: [0.3, 0.02, 0.02],
  fingerHang: [1.35, 0.02, -0.08],
};
const ARM_TYPING_R = {
  shoulder: [0.32, -0.04, 1.0],
  upper: [1.55, -0.03, 0.22],
  forearm: [0.72, -0.02, -0.06],
  hand: [0.3, -0.02, -0.02],
  fingerHang: [1.35, -0.02, 0.08],
};

const ARM_SEGMENTS = ['shoulder', 'upper', 'forearm', 'hand'];
const FINGER_BONE_PATTERN = /thumb|index|middle|ring|pinky/i;

function findBone(skeleton, names) {
  if (!skeleton?.bones) return null;
  const map = new Map(skeleton.bones.map((b) => [b.name, b]));
  for (const name of names) {
    const hit = map.get(name);
    if (hit) return hit;
    const noDot = name.replace(/\./g, '');
    const hit2 = map.get(noDot);
    if (hit2) return hit2;
  }
  for (const name of names) {
    const key = name.toLowerCase().replace('.x', '');
    for (const bone of skeleton.bones) {
      const n = bone.name.toLowerCase();
      if (n === key || n.endsWith(key) || n.replace(/\./g, '') === key.replace(/\./g, '')) {
        return bone;
      }
    }
  }
  return null;
}

function buildFingerChains(skeleton, defs) {
  return defs.map(({ names, curls }) => ({
    bones: names.map((n) => findBone(skeleton, [n, n.replace(/\./g, '')])),
    curls,
  }));
}

function quatFromEuler(x, y, z) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
}

function clampLook(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function applyLookOnBoneLocal(bone, baseQuat, pitch, yaw) {
  if (!bone || !baseQuat) return;
  // YXZ：先偏航再俯仰，避免 ARP 头骨本地轴拧转
  const lookQ = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, yaw, 0, 'YXZ'),
  );
  bone.quaternion.copy(baseQuat).multiply(lookQ);
}

function applyOffsetFromBind(bone, bindQuats, x, y, z) {
  if (!bone) return;
  const bind = bindQuats.get(bone.uuid);
  if (bind) bone.quaternion.copy(bind);
  bone.quaternion.multiply(quatFromEuler(x, y, z));
}

function applyEuler(bone, x, y, z) {
  if (!bone) return;
  bone.quaternion.multiply(quatFromEuler(x, y, z));
}

function isSideBone(name, side) {
  const n = name.toLowerCase();
  if (side === 'left') return n.endsWith('l') || n.includes('.l');
  return n.endsWith('r') || n.includes('.r');
}

function collectFingerBones(skeleton, side) {
  return skeleton.bones.filter(
    (bone) => isSideBone(bone.name, side) && FINGER_BONE_PATTERN.test(bone.name)
  );
}

/**
 * 蒙皮骨骼：头身眼神分离（lookGroup 转体 + 颈/头相对转动）
 * 不叠加手臂姿势、打字手指、躯干呼吸等程序化动作
 */
export class SkeletalRig {
  constructor() {
    this.mode = 'none';
    this.skeleton = null;
    this.headBone = null;
    this.neckBone = null;
    this.rootBone = null;
    this.spineLowerBone = null;
    this.spineBone = null;
    this.chestBone = null;
    this._torsoBones = [];
    this.arms = { left: {}, right: {} };
    this.legs = { left: {}, right: {} };
    this._look = { bodyX: 0, bodyY: 0, headX: 0, headY: 0, handAmount: 0.85 };
    this._idlePhase = Math.random() * Math.PI * 2;
    this._typingPhase = 0;
    this._bindQuats = new Map();
    this._lookBaseQuats = new Map();
    this._gestureHeadQuat = null;
    this._gestureNeckQuat = null;
    this._armRestPose = null;
    this._armTypingPose = null;
    this._fullRestPose = null;
    this._fullTypingPose = null;
    this._poseLibrary = null;
    this._poseController = new PoseController();
    this._modelRoot = null;
    this._skinnedMesh = null;
  }

  get isActive() {
    return this.mode === 'skeleton' && !!this.skeleton;
  }

  setup(root) {
    this.dispose();
    this._modelRoot = root;
    root.traverse((obj) => {
      if (obj.isSkinnedMesh && obj.skeleton && !this.skeleton) {
        this.skeleton = obj.skeleton;
        this._skinnedMesh = obj;
      }
    });
    if (!this.skeleton) return this;

    this.headBone = findBone(this.skeleton, HEAD_NAMES);
    this.neckBone = findBone(this.skeleton, NECK_NAMES);
    this.rootBone = findBone(this.skeleton, ROOT_NAMES);
    this.spineLowerBone = findBone(this.skeleton, SPINE_LOWER_NAMES);
    this.spineBone = findBone(this.skeleton, SPINE_NAMES);
    this.chestBone = findBone(this.skeleton, CHEST_NAMES);
    this._torsoBones = [
      this.rootBone,
      this.spineLowerBone,
      this.spineBone,
      this.chestBone,
    ].filter(Boolean);

    this.arms.left = {
      shoulder: findBone(this.skeleton, ARM_L.shoulder),
      upper: findBone(this.skeleton, ARM_L.upper),
      forearm: findBone(this.skeleton, ARM_L.forearm),
      hand: findBone(this.skeleton, ARM_L.hand),
      fingerChains: buildFingerChains(this.skeleton, FINGER_CHAINS_L),
    };
    this.arms.right = {
      shoulder: findBone(this.skeleton, ARM_R.shoulder),
      upper: findBone(this.skeleton, ARM_R.upper),
      forearm: findBone(this.skeleton, ARM_R.forearm),
      hand: findBone(this.skeleton, ARM_R.hand),
      fingerChains: buildFingerChains(this.skeleton, FINGER_CHAINS_R),
    };
    this.legs.left = {
      thigh: findBone(this.skeleton, LEG_L.thigh),
      foot: findBone(this.skeleton, LEG_L.foot),
    };
    this.legs.right = {
      thigh: findBone(this.skeleton, LEG_R.thigh),
      foot: findBone(this.skeleton, LEG_R.foot),
    };

    if (!this.headBone && !this.spineBone) return this;

    this._captureBindPose();
    this._poseController.attach(root);
    this._armRestPose = this._bakeArmPose(ARM_APOSE_L, ARM_APOSE_R);
    this._armTypingPose = this._bakeArmPose(ARM_TYPING_L, ARM_TYPING_R);

    this.mode = 'skeleton';
    console.info('[SkeletalRig] A-pose baked', {
      lUpper: this.arms.left.upper?.name,
      torsoBones: this._torsoBones.map((b) => b.name),
    });
    return this;
  }

  async loadPoseLibraryFromUrl(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return this;
      const lib = await res.json();
      this.applyPoseLibrary(lib);
    } catch (err) {
      console.warn('[SkeletalRig] pose library load failed', err);
    }
    return this;
  }

  applyPoseLibrary(lib) {
    if (!validateLibrary(lib)) return this;
    this._poseLibrary = cloneLibrary(lib);
    const restId = lib.assignments?.rest;
    const typingId = lib.assignments?.typing;
    if (restId && lib.poses?.[restId]?.bones) {
      this._fullRestPose = this._bakeFullPose(lib.poses[restId].bones);
    }
    if (typingId && lib.poses?.[typingId]?.bones) {
      this._fullTypingPose = this._bakeFullPose(lib.poses[typingId].bones);
    }
    console.info('[SkeletalRig] pose library applied', {
      rest: restId,
      typing: typingId,
      bones: Object.keys(lib.poses?.[restId]?.bones ?? {}).length,
    });
    return this;
  }

  _bakeFullPose(poseBones) {
    if (!this._poseController.isReady) return null;
    return bakePoseQuaternions(this._poseController, poseBones);
  }

  _applyFullPose(baked) {
    if (!baked?.size) return;
    for (const bone of this.skeleton.bones) {
      const q = baked.get(bone.name);
      if (q) bone.quaternion.copy(q);
    }
  }

  _captureBindPose() {
    this._bindQuats.clear();
    this.skeleton.pose();
    this.skeleton.bones.forEach((bone) => {
      this._bindQuats.set(bone.uuid, bone.quaternion.clone());
    });
  }

  _restoreBind(bone) {
    if (!bone) return;
    const q = this._bindQuats.get(bone.uuid);
    if (q) bone.quaternion.copy(q);
  }

  _bakeArmPose(restL, restR) {
    const bakeSide = (arm, rest, side) => {
      const segments = {};
      for (const key of ARM_SEGMENTS) {
        this._restoreBind(arm[key]);
        const e = rest[key];
        applyEuler(arm[key], e[0], e[1], e[2]);
        segments[key] = arm[key].quaternion.clone();
      }

      const fingerHang = [];
      const hang = rest.fingerHang;
      if (hang) {
        collectFingerBones(this.skeleton, side).forEach((bone) => {
          this._restoreBind(bone);
          applyEuler(bone, hang[0], hang[1], hang[2]);
          fingerHang.push({ bone, quat: bone.quaternion.clone() });
        });
      }

      const fingers = [];
      arm.fingerChains?.forEach((chain) => {
        chain.bones.forEach((bone, i) => {
          if (!bone) return;
          const baked = fingerHang.find((f) => f.bone === bone);
          if (baked) {
            fingers.push(baked);
            return;
          }
          this._restoreBind(bone);
          const mirror = side === 'left' ? 1 : -1;
          const curl = chain.curls[i] ?? 0.1;
          applyEuler(bone, curl, 0.01 * mirror, 0.02 * mirror);
          fingers.push({ bone, quat: bone.quaternion.clone() });
        });
      });

      return { segments, fingerHang, fingers };
    };
    return {
      left: bakeSide(this.arms.left, restL, 'left'),
      right: bakeSide(this.arms.right, restR, 'right'),
    };
  }

  _applyBakedArmPose(baked) {
    if (!baked) return;
    for (const side of ['left', 'right']) {
      const arm = this.arms[side];
      const data = baked[side];
      for (const key of ARM_SEGMENTS) {
        if (arm[key] && data.segments[key]) {
          arm[key].quaternion.copy(data.segments[key]);
        }
      }
      const applied = new Set();
      data.fingerHang?.forEach(({ bone, quat }) => {
        if (bone && quat) {
          bone.quaternion.copy(quat);
          applied.add(bone.uuid);
        }
      });
      data.fingers.forEach(({ bone, quat }) => {
        if (bone && quat && !applied.has(bone.uuid)) {
          bone.quaternion.copy(quat);
        }
      });
    }
  }

  preMixerUpdate() {
    if (!this.isActive) return;
    this.skeleton.pose();
  }

  /** 骨骼修改后必须刷新 matrixWorld，蒙皮才会生效 */
  finalizeUpdate() {
    if (!this.isActive) return;
    this._modelRoot?.updateMatrixWorld(true);
    this.skeleton.update();
  }

  /** 非手势时强制头/颈回到 bind，避免 idle 烘焙轨道残留 */
  restoreHeadNeckBind() {
    this._restoreBind(this.headBone);
    this._restoreBind(this.neckBone);
  }

  /** nod/poke 播放后、applyLook 前：记录 mixer 输出的头/颈姿态 */
  snapshotGestureHeadPose() {
    this._gestureHeadQuat = this.headBone?.quaternion.clone() ?? null;
    this._gestureNeckQuat = this.neckBone?.quaternion.clone() ?? null;
  }

  clearGestureHeadSnapshot() {
    this._gestureHeadQuat = null;
    this._gestureNeckQuat = null;
  }

  applyLook({ bodyX = 0, bodyY = 0, headX = 0, headY = 0, handAmount = 0.85 } = {}) {
    if (!this.isActive || !this.headBone) return;
    this._look = { bodyX, bodyY, headX, headY, handAmount };

    const relPitch = clampLook(headX - bodyX * 0.18, -0.28, 0.28);
    const relYaw = clampLook(headY - bodyY * 0.18, -0.42, 0.42);

    const headBind = this._gestureHeadQuat ?? this._bindQuats.get(this.headBone.uuid);
    applyLookOnBoneLocal(this.headBone, headBind, relPitch, relYaw);

    // 颈骨保持 bind / 手势基准，不参与眼神旋转，避免双骨拧转
    if (this.neckBone) {
      const neckBase = this._gestureNeckQuat ?? this._bindQuats.get(this.neckBone.uuid);
      if (neckBase) this.neckBone.quaternion.copy(neckBase);
    }
  }

  /** 待机微动：呼吸、手脚轻摆、重心转移（每帧从 bind pose 叠加） */
  applyIdleMotion(delta) {
    if (!this.isActive) return;
    this._idlePhase += delta;
    const t = this._idlePhase;
    const breath = Math.sin(t * 0.85) * 0.0035;
    applyOffsetFromBind(this.chestBone, this._bindQuats, breath, 0, 0);
    applyOffsetFromBind(this.spineBone, this._bindQuats, breath * 0.55, 0, 0);

    const swayL = Math.sin(t * 0.62 + 0.4) * 0.014;
    const swayR = Math.sin(t * 0.58 + 2.0) * 0.014;
    applyOffsetFromBind(this.arms.left.forearm, this._bindQuats, swayL * 0.35, swayL * 0.12, swayL * 0.5);
    applyOffsetFromBind(this.arms.left.hand, this._bindQuats, swayL * 0.25, swayL * 0.18, swayL * 0.15);
    applyOffsetFromBind(this.arms.right.forearm, this._bindQuats, swayR * 0.35, -swayR * 0.12, -swayR * 0.5);
    applyOffsetFromBind(this.arms.right.hand, this._bindQuats, swayR * 0.25, -swayR * 0.18, -swayR * 0.15);

    const fingerWave = Math.sin(t * 0.9 + 1.1) * 0.018;
    for (const side of ['left', 'right']) {
      const mirror = side === 'left' ? 1 : -1;
      collectFingerBones(this.skeleton, side).forEach((bone, i) => {
        const w = 0.35 + (i % 3) * 0.08;
        applyOffsetFromBind(bone, this._bindQuats, fingerWave * w, fingerWave * 0.06 * mirror, 0);
      });
    }

    const weight = Math.sin(t * 0.48) * 0.005;
    applyOffsetFromBind(this.legs.left.thigh, this._bindQuats, 0, 0, weight);
    applyOffsetFromBind(this.legs.right.thigh, this._bindQuats, 0, 0, -weight);
    applyOffsetFromBind(this.legs.left.foot, this._bindQuats, weight * 0.6, 0, 0);
    applyOffsetFromBind(this.legs.right.foot, this._bindQuats, -weight * 0.6, 0, 0);
    applyOffsetFromBind(this.rootBone, this._bindQuats, 0, Math.sin(t * 0.42) * 0.0025, Math.sin(t * 0.5) * 0.0035);
  }

  postMixerUpdate(_delta, _ctx = {}) {
    /* idle 由 applyIdleMotion 驱动 */
  }

  /** 保留 API；绑骨模型不再叠加手臂/打字姿势 */
  applyArmPoseLayer(_delta, _ctx = {}) {
    /* no-op */
  }

  _applyIdleBodyMotion(_typing, _energy) {
    /* no-op */
  }

  _applyArmPose(typing, energy) {
    const useTyping = typing && energy > 0.1;
    const full = useTyping ? this._fullTypingPose : this._fullRestPose;
    if (full?.size) {
      this._applyFullPose(full);
      return;
    }
    const baked = useTyping ? this._armTypingPose : this._armRestPose;
    this._applyBakedArmPose(baked);
  }

  _applyTypingMotion(delta, energy) {
    this._typingPhase += delta * (6 + energy * 6);
    const t = this._typingPhase;
    const e = Math.max(0.12, energy);

    this._applyTypingFingers(this.arms.left, 1, t, e);
    this._applyTypingFingers(this.arms.right, -1, t + 1.2, e * 0.78);
  }

  _applyTypingFingers(arm, mirror, t, energy) {
    if (!arm?.fingerChains?.length) return;
    const tap = 0.16 + energy * 0.24;

    arm.fingerChains.forEach((chain, chainIdx) => {
      const isThumb = chainIdx === 0;
      chain.bones.forEach((bone, segIdx) => {
        if (!bone) return;
        const speed = 2.6 + chainIdx * 0.28 + segIdx * 0.1;
        const phase = t * speed + chainIdx * 0.45 + segIdx * 0.2;
        const press = Math.max(0, Math.sin(phase)) * tap;
        const thumbScale = isThumb ? 0.4 : 1;
        applyEuler(bone, press * thumbScale * (0.45 + segIdx * 0.18), 0, 0);
      });
    });

    const wrist = Math.sin(t * 2.2) * (0.008 + energy * 0.01);
    applyEuler(arm.hand, wrist, 0, wrist * 0.3 * mirror);
  }

  resetPose() {
    this._look = { bodyX: 0, bodyY: 0, headX: 0, headY: 0, handAmount: 0.85 };
    this._typingPhase = 0;
  }

  dispose() {
    this.resetPose();
    this._bindQuats.clear();
    this._lookBaseQuats.clear();
    this._gestureHeadQuat = null;
    this._gestureNeckQuat = null;
    this._armRestPose = null;
    this._armTypingPose = null;
    this._fullRestPose = null;
    this._fullTypingPose = null;
    this._poseLibrary = null;
    this._poseController?.dispose?.();
    this.mode = 'none';
    this.skeleton = null;
    this.headBone = null;
    this.neckBone = null;
    this.rootBone = null;
    this.spineLowerBone = null;
    this.spineBone = null;
    this.chestBone = null;
    this._torsoBones = [];
    this.arms = { left: {}, right: {} };
    this.legs = { left: {}, right: {} };
    this._modelRoot = null;
    this._skinnedMesh = null;
  }
}
