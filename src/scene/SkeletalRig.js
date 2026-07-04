import * as THREE from 'three';
import {
  bakePoseQuaternions,
  blendPoseData,
  cloneLibrary,
  ease,
  applyModelPosePolicy,
  mirrorPoseBones,
  validateLibrary,
} from './PoseLibrary.js';
import { PoseController } from './PoseController.js';
import { resolveBindEntry } from './boneNameUtils.js';
import { getModelProfile } from './modelProfiles.js';

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

const DEFAULT_LIFE = { period: 3.6, amp: { shoulder: 0.004, upper: 0.005, forearm: 0.007, hand: 0.006, head: 0.0045, neck: 0.0035 } };
const DEFAULT_LOOK = {
  bodyFullY: 0.12, bodyFullX: 0.14, bodyIntensity: 1, groupBodyY: 0.34, groupBodyX: 0.14,
  handSmooth: 3.8, torsoSmooth: 9, sideSmooth: 7, handBoneSmooth: 3.2, torsoBoneSmooth: 5.5, viewBreathSmooth: 3.2,
};

const POSE_BLEND_SMOOTH = 8;

function isLookLimbBone(name) {
  return /^(hand|foot|toes_01|c_leg_stretch)/i.test(name);
}

/** look 姿势里不应参与混合的骨（肩/指等 idle 导出会扭曲躯干） */
function isLookExcludedBone(name) {
  const n = String(name || '').toLowerCase();
  if (/^shoulder/.test(n)) return true;
  if (/^(thumb|index|middle|ring|pinky)/.test(n)) return true;
  if (/^c_(thumb|index|middle|ring|pinky)/.test(n)) return true;
  return false;
}

function filterLookPoseBones(bones) {
  const out = {};
  for (const [name, entry] of Object.entries(bones ?? {})) {
    if (!isLookExcludedBone(name)) out[name] = entry;
  }
  return out;
}

function expSmoothing(current, target, delta, speed) {
  const t = 1 - Math.exp(-Math.max(speed, 0.001) * Math.max(delta, 0.001));
  return current + (target - current) * t;
}

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

function quatFromEuler(x, y, z) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'XYZ'));
}

function clampLook(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function scaleEuler(euler, gain) {
  return [euler[0] * gain, euler[1] * gain, euler[2] * gain];
}

function applyLookOnBoneLocal(bone, baseQuat, pitch, yaw) {
  if (!bone || !baseQuat) return;
  // YXZ：先偏航再俯仰，避免 ARP 头骨本地轴拧转
  const lookQ = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, yaw, 0, 'YXZ'),
  );
  bone.quaternion.copy(baseQuat).multiply(lookQ);
}

function applyOffsetFromCurrent(bone, x, y, z) {
  if (!bone) return;
  bone.quaternion.multiply(quatFromEuler(x, y, z));
}

const FINGER_BONE_PATTERN = /thumb|index|middle|ring|pinky/i;

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
 * 蒙皮骨骼：Blender 姿势库（待机/打字/转向）+ 手臂/头部节律微动
 */
export class SkeletalRig {
  constructor() {
    this._profile = getModelProfile('aqun_rig');
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
    this._headLifePhase = Math.random() * Math.PI * 2;
    this._driftSeed = Math.random() * 100;
    this._typingPhase = 0;
    this._poseBlendT = 0;
    this._poseBlendTarget = 0;
    this._animCtx = { typing: false, typingEnergy: 0, gesturing: false };
    this._lookWeightHand = 0;
    this._lookWeightTorso = 0;
    this._lookRightWHand = 0;
    this._lookLeftWHand = 0;
    this._lookRightWTorso = 0;
    this._lookLeftWTorso = 0;
    this._lookUpWTorso = 0;
    this._lookDownWTorso = 0;
    this._lookBodyYSmooth = 0;
    this._lookBodyXSmooth = 0;
    this._viewBreathX = 0;
    this._viewBreathY = 0;
    this._viewSwayPhase = Math.random() * Math.PI * 2;
    this._lookBoneSmooth = new Map();
    this._bindQuats = new Map();
    this._lookBaseQuats = new Map();
    this._gestureHeadQuat = null;
    this._gestureNeckQuat = null;
    this._fullRestPose = null;
    this._fullTypingPose = null;
    this._restPoseData = null;
    this._typingPoseData = null;
    this._currentBaseBaked = null;
    this._lookBodyRightPose = null;
    this._lookBodyLeftPose = null;
    this._lookBodyRightBaked = null;
    this._lookBodyLeftBaked = null;
    this._lookBodyUpPose = null;
    this._lookBodyDownPose = null;
    this._lookBodyUpBaked = null;
    this._lookBodyDownBaked = null;
    this._lookBodyRefYaw = 0.1;
    this._lastLookBodyWeight = 0;
    this._lastLookBodyNeckQuat = null;
    this._poseLibrary = null;
    this._poseController = new PoseController();
    this._modelRoot = null;
    this._skinnedMesh = null;
  }

  get isActive() {
    return this.mode === 'skeleton' && !!this.skeleton;
  }

  setProfile(profile) {
    this._profile = profile ?? getModelProfile('aqun_rig');
  }

  _lifeCfg() {
    return this._profile?.life ?? DEFAULT_LIFE;
  }

  _lookCfg() {
    return this._profile?.look ?? DEFAULT_LOOK;
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
    };
    this.arms.right = {
      shoulder: findBone(this.skeleton, ARM_R.shoulder),
      upper: findBone(this.skeleton, ARM_R.upper),
      forearm: findBone(this.skeleton, ARM_R.forearm),
      hand: findBone(this.skeleton, ARM_R.hand),
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

    this.mode = 'skeleton';
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
    if (lib.modelId && this._profile?.id && lib.modelId !== this._profile.id) {
      console.warn('[SkeletalRig] 姿势库 modelId 不匹配，已跳过', {
        expected: this._profile.id,
        got: lib.modelId,
      });
      return this;
    }
    this._poseLibrary = applyModelPosePolicy(cloneLibrary(lib), this._profile);
    const poseLib = this._poseLibrary;
    const lookCfg = this._lookCfg();
    const lookIntensity = lookCfg.bodyIntensity ?? 1;
    const restId = poseLib.assignments?.rest;
    const typingId = poseLib.assignments?.typing;
    if (restId && poseLib.poses?.[restId]?.bones) {
      this._restPoseData = poseLib.poses[restId].bones;
      this._fullRestPose = this._bakeFullPose(this._restPoseData);
    }
    if (typingId && poseLib.poses?.[typingId]?.bones) {
      this._typingPoseData = poseLib.poses[typingId].bones;
      this._fullTypingPose = this._bakeFullPose(this._typingPoseData);
    }
    const lookRightId = poseLib.assignments?.lookBodyRight ?? poseLib.assignments?.lookBody;
    const lookLeftId = poseLib.assignments?.lookBodyLeft;
    if (lookRightId && poseLib.poses?.[lookRightId]?.bones) {
      this._lookBodyRightPose = filterLookPoseBones(poseLib.poses[lookRightId].bones);
      this._lookBodyRightBaked = this._bakeFullPose(this._lookBodyRightPose, lookIntensity);
      const spineKey = Object.keys(this._lookBodyRightPose).find((n) => /spine_01/i.test(n));
      const spineY = Math.abs(this._lookBodyRightPose[spineKey]?.euler?.[1] ?? 0);
      this._lookBodyRefYaw = spineY > 1e-4 ? spineY * lookIntensity : 0.1;
    } else {
      this._lookBodyRightPose = null;
      this._lookBodyRightBaked = null;
      this._lookBodyRefYaw = 0.1;
    }
    if (lookLeftId && poseLib.poses?.[lookLeftId]?.bones) {
      this._lookBodyLeftPose = filterLookPoseBones(poseLib.poses[lookLeftId].bones);
      this._lookBodyLeftBaked = this._bakeFullPose(this._lookBodyLeftPose, lookIntensity);
    } else if (this._lookBodyRightPose) {
      this._lookBodyLeftPose = mirrorPoseBones(this._lookBodyRightPose);
      this._lookBodyLeftBaked = this._bakeFullPose(this._lookBodyLeftPose, 1);
    } else {
      this._lookBodyLeftPose = null;
      this._lookBodyLeftBaked = null;
    }
    const lookUpId = poseLib.assignments?.lookBodyUp;
    const lookDownId = poseLib.assignments?.lookBodyDown;
    if (lookUpId && poseLib.poses?.[lookUpId]?.bones) {
      this._lookBodyUpPose = filterLookPoseBones(poseLib.poses[lookUpId].bones);
      this._lookBodyUpBaked = this._bakeFullPose(this._lookBodyUpPose, lookIntensity);
    } else {
      this._lookBodyUpPose = null;
      this._lookBodyUpBaked = null;
    }
    if (lookDownId && poseLib.poses?.[lookDownId]?.bones) {
      this._lookBodyDownPose = filterLookPoseBones(poseLib.poses[lookDownId].bones);
      this._lookBodyDownBaked = this._bakeFullPose(this._lookBodyDownPose, lookIntensity);
    } else {
      this._lookBodyDownPose = null;
      this._lookBodyDownBaked = null;
    }
    console.info('[SkeletalRig] pose library applied', {
      rest: restId,
      typing: typingId,
      lookBodyRight: lookRightId,
      lookBodyLeft: lookLeftId ?? '(mirrored)',
      lookBodyUp: lookUpId,
      lookBodyDown: lookDownId,
      bones: Object.keys(poseLib.poses?.[restId]?.bones ?? {}).length,
      bindOnlyRest: !!this._profile?.bindOnlyRest,
    });
    this.applyRestPose();
    return this;
  }

  _bakeFullPose(poseBones, intensity = 1) {
    if (!this._poseController.isReady) return null;
    if (intensity === 1) {
      return bakePoseQuaternions(this._poseController, poseBones);
    }
    const scaled = {};
    for (const [name, entry] of Object.entries(poseBones ?? {})) {
      scaled[name] = {
        ...entry,
        euler: scaleEuler(entry?.euler ?? [0, 0, 0], intensity),
      };
    }
    return bakePoseQuaternions(this._poseController, scaled);
  }

  _captureBindPose() {
    this._bindQuats.clear();
    this.skeleton.pose();
    this.skeleton.bones.forEach((bone) => {
      this._bindQuats.set(bone.uuid, bone.quaternion.clone());
    });
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

  /** 非手势时头/颈回到姿势库基准（非 bind） */
  restoreHeadNeckBind() {
    const headQ = this._getBasePoseQuat(this.headBone?.name, this.headBone);
    const neckQ = this._getBasePoseQuat(this.neckBone?.name, this.neckBone);
    if (headQ && this.headBone) this.headBone.quaternion.copy(headQ);
    if (neckQ && this.neckBone) this.neckBone.quaternion.copy(neckQ);
  }

  _getBasePoseQuat(boneName, bone) {
    if (!boneName || !bone) return null;
    const fromCurrent = resolveBindEntry(this._currentBaseBaked, boneName);
    if (fromCurrent) return fromCurrent;
    const fromRest = resolveBindEntry(this._fullRestPose, boneName);
    if (fromRest) return fromRest;
    return this._bindQuats.get(bone.uuid) ?? null;
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

  hasLookBodyPose() {
    return !!(
      this._lookBodyRightBaked?.size
      || this._lookBodyLeftBaked?.size
      || this._lookBodyUpBaked?.size
      || this._lookBodyDownBaked?.size
    );
  }

  /** 0=中心原始姿势，1=满幅度 Blender 转向姿势（线性） */
  getLookBodyLinearWeight(bodyY) {
    const cfg = this._lookCfg();
    return clampLook(Math.abs(bodyY) / cfg.bodyFullY, 0, 1);
  }

  getLookGroupBodyRotation(bodyX, bodyY) {
    const cfg = this._lookCfg();
    const w = Math.max(
      this._lookRightWTorso,
      this._lookLeftWTorso,
      this._lookUpWTorso,
      this._lookDownWTorso,
    );
    return {
      x: this._lookBodyXSmooth * cfg.groupBodyX * w,
      y: this._lookBodyYSmooth * cfg.groupBodyY * w,
    };
  }

  _lookBoneNames() {
    const names = new Set([
      ...Object.keys(this._lookBodyRightPose ?? {}),
      ...Object.keys(this._lookBodyLeftPose ?? {}),
      ...Object.keys(this._lookBodyUpPose ?? {}),
      ...Object.keys(this._lookBodyDownPose ?? {}),
    ]);
    for (const name of [...names]) {
      if (isLookExcludedBone(name)) names.delete(name);
    }
    return names;
  }

  _getLookRestQuat(boneName, bone) {
    return this._getBasePoseQuat(boneName, bone);
  }

  _resolveBone(name) {
    return this.skeleton?.bones.find((b) => b.name === name) ?? findBone(this.skeleton, [name]);
  }

  _computeLookTargetQuat(boneName, restQ, isLimb) {
    const rightW = isLimb ? this._lookRightWHand : this._lookRightWTorso;
    const leftW = isLimb ? this._lookLeftWHand : this._lookLeftWTorso;
    const upW = isLimb ? 0 : this._lookUpWTorso;
    const downW = isLimb ? 0 : this._lookDownWTorso;
    if (rightW < 1e-4 && leftW < 1e-4 && upW < 1e-4 && downW < 1e-4) return restQ.clone();

    let q = restQ.clone();
    const rightTarget = resolveBindEntry(this._lookBodyRightBaked, boneName);
    const leftTarget = resolveBindEntry(this._lookBodyLeftBaked, boneName);
    const upTarget = resolveBindEntry(this._lookBodyUpBaked, boneName);
    const downTarget = resolveBindEntry(this._lookBodyDownBaked, boneName);
    if (rightW > 1e-4 && rightTarget) q.slerp(rightTarget, rightW);
    if (leftW > 1e-4 && leftTarget) q.slerp(leftTarget, leftW);
    if (upW > 1e-4 && upTarget) q.slerp(upTarget, upW);
    if (downW > 1e-4 && downTarget) q.slerp(downTarget, downW);
    return q;
  }

  _applyLookBodyPose(bodyY, bodyX = 0, handY = bodyY, handAmount = 0.85, delta = 0.016) {
    const cfg = this._lookCfg();
    const dt = Math.max(0.001, delta);
    const targetRightTorso = clampLook(bodyY / cfg.bodyFullY, 0, 1);
    const targetLeftTorso = clampLook(-bodyY / cfg.bodyFullY, 0, 1);
    const targetUpTorso = clampLook(-bodyX / cfg.bodyFullX, 0, 1);
    const targetDownTorso = clampLook(bodyX / cfg.bodyFullX, 0, 1);
    const targetRightHand = clampLook(handY / cfg.bodyFullY, 0, 1) * handAmount;
    const targetLeftHand = clampLook(-handY / cfg.bodyFullY, 0, 1) * handAmount;

    this._lookRightWTorso = expSmoothing(this._lookRightWTorso, targetRightTorso, dt, cfg.torsoSmooth);
    this._lookLeftWTorso = expSmoothing(this._lookLeftWTorso, targetLeftTorso, dt, cfg.torsoSmooth);
    this._lookUpWTorso = expSmoothing(this._lookUpWTorso, targetUpTorso, dt, cfg.torsoSmooth);
    this._lookDownWTorso = expSmoothing(this._lookDownWTorso, targetDownTorso, dt, cfg.torsoSmooth);
    this._lookRightWHand = expSmoothing(this._lookRightWHand, targetRightHand, dt, cfg.handSmooth);
    this._lookLeftWHand = expSmoothing(this._lookLeftWHand, targetLeftHand, dt, cfg.handSmooth);

    this._lookBodyYSmooth = expSmoothing(this._lookBodyYSmooth, bodyY, dt, cfg.sideSmooth);
    this._lookBodyXSmooth = expSmoothing(this._lookBodyXSmooth, bodyX, dt, cfg.sideSmooth);

    this._lookWeightHand = Math.max(this._lookRightWHand, this._lookLeftWHand);
    this._lookWeightTorso = Math.max(this._lookRightWTorso, this._lookLeftWTorso, this._lookUpWTorso, this._lookDownWTorso);
    this._lastLookBodyWeight = Math.max(this._lookWeightHand, this._lookWeightTorso);
    this._lastLookBodyNeckQuat = null;

    const boneNames = this._lookBoneNames();
    if (!boneNames.size) return;

    for (const boneName of boneNames) {
      const bone = this._resolveBone(boneName);
      const restQ = this._getLookRestQuat(boneName, bone);
      if (!bone || !restQ) continue;

      const isLimb = isLookLimbBone(boneName);
      const idealQ = this._computeLookTargetQuat(boneName, restQ, isLimb);
      const boneSpeed = isLimb ? cfg.handBoneSmooth : cfg.torsoBoneSmooth;
      const prevQ = this._lookBoneSmooth.get(boneName);

      if (!prevQ) {
        bone.quaternion.copy(idealQ);
        this._lookBoneSmooth.set(boneName, idealQ.clone());
      } else {
        const t = 1 - Math.exp(-boneSpeed * dt);
        const smoothQ = prevQ.clone().slerp(idealQ, t);
        bone.quaternion.copy(smoothQ);
        this._lookBoneSmooth.set(boneName, smoothQ.clone());
      }

      if (bone === this.neckBone) {
        this._lastLookBodyNeckQuat = bone.quaternion.clone();
      }
    }
  }

  /** 视角转向时手臂轻微跟随（不动躯干） */
  _applyLookArmBias(bodyX, bodyY, delta) {
    const cfg = this._lookCfg();
    const dt = Math.max(0.001, delta);
    const lookMag = Math.hypot(bodyX, bodyY);
    if (lookMag < 0.008) return;

    this._viewBreathX = expSmoothing(this._viewBreathX, bodyX, dt, cfg.viewBreathSmooth);
    this._viewBreathY = expSmoothing(this._viewBreathY, bodyY, dt, cfg.viewBreathSmooth);

    const bias = this._viewBreathY * 0.004 + this._viewBreathX * 0.002;
    applyOffsetFromCurrent(this.arms.left.shoulder, 0, -bias, lookMag * 0.0015);
    applyOffsetFromCurrent(this.arms.right.shoulder, 0, bias, -lookMag * 0.0015);
  }

  /** 头部 / 颈部节律微动（在眼神之后叠加） */
  applyHeadLifeRhythm(delta) {
    this._applyHeadLifeRhythm(delta);
  }

  /** 头部 / 颈部节律微动（在眼神之后叠加；打字时频率与幅度均降低） */
  _applyHeadLifeRhythm(delta) {
    const life = this._lifeCfg();
    const amp = life.amp;
    const typing = this._animCtx?.typing && (this._animCtx?.typingEnergy ?? 0) > 0.05;
    const e = typing ? Math.min(1, this._animCtx.typingEnergy) : 0;
    this._headLifePhase += delta * (typing ? 0.85 + e * 0.55 : 0.7);
    const t = this._headLifePhase;

    const headAmp = typing ? amp.head * (0.45 + e * 0.25) : amp.head * 0.8;
    const nod = Math.sin(t * (typing ? 1.6 : 1.35)) * headAmp;
    const sway = Math.sin(t * (typing ? 0.95 : 0.85) + this._driftSeed) * headAmp * 0.4;
    const tilt = Math.sin(t * (typing ? 1.15 : 0.65) + 1.2) * headAmp * 0.22;

    if (this.headBone) {
      applyOffsetFromCurrent(this.headBone, nod, sway, tilt);
    }
    if (this.neckBone) {
      applyOffsetFromCurrent(this.neckBone, nod * 0.4, sway * 0.45, tilt * 0.25);
    }
  }

  _applyArmLifeRhythm(side, slow, fast, amp, phaseOff) {
    const life = this._lifeCfg();
    const lifeAmp = life.amp;
    const arm = this.arms[side];
    if (!arm?.shoulder) return;
    const mirror = side === 'left' ? 1 : -1;
    const w = slow * Math.cos(phaseOff) + fast * 0.42 * Math.sin(phaseOff);
    const w2 = fast * Math.cos(phaseOff * 0.65 + 0.3);

    applyOffsetFromCurrent(arm.shoulder, w * amp * lifeAmp.shoulder / lifeAmp.forearm, w2 * amp * 0.22 * mirror, w * amp * 0.18 * mirror);
    applyOffsetFromCurrent(arm.upper, w2 * amp * lifeAmp.upper / lifeAmp.forearm, w * amp * 0.14 * mirror, w2 * amp * 0.08 * mirror);
    applyOffsetFromCurrent(arm.forearm, w * amp, w2 * amp * 0.28 * mirror, w * amp * 0.22 * mirror);
    applyOffsetFromCurrent(arm.hand, w2 * amp * lifeAmp.hand / lifeAmp.forearm, w * amp * 0.1 * mirror, w2 * amp * 0.2 * mirror);
  }

  applyLook({
    bodyX = 0, bodyY = 0, handX = bodyX, handY = bodyY,
    headX = 0, headY = 0, handAmount = 0.85, delta = 0.016,
    typing = false, typingEnergy = 0,
  } = {}) {
    if (!this.isActive || !this.headBone) return;
    this._look = { bodyX, bodyY, handX, handY, headX, headY, handAmount };
    this._animCtx = {
      ...this._animCtx,
      typing: !!typing,
      typingEnergy: typingEnergy ?? 0,
    };

    const typingActive = typing && typingEnergy > 0.05;
    const inputMag = Math.hypot(bodyX, bodyY, handX ?? bodyX, handY ?? bodyY);
    /** 打字时仍允许眼神驱动；输入较小时保留适度跟随，有鼠标/全局视线时全幅度 */
    const lookStrength = typingActive
      ? Math.max(0.58, Math.min(1, inputMag * 2.8 + 0.58))
      : 1;

    this._applyLookBodyPose(
      bodyY * lookStrength,
      bodyX * lookStrength,
      (handY ?? bodyY) * lookStrength,
      handAmount * lookStrength,
      delta,
    );
    this._applyLookArmBias(bodyX * lookStrength, bodyY * lookStrength, delta);

    const relPitch = clampLook(headX - bodyX * 0.12, -0.28, 0.28);
    const relYaw = clampLook(headY - bodyY * 0.12, -0.42, 0.42);

    const headBase = this._gestureHeadQuat
      ?? this._getBasePoseQuat(this.headBone.name, this.headBone);
    applyLookOnBoneLocal(this.headBone, headBase, relPitch, relYaw);

    // 颈骨保持姿势库 / 手势基准，不参与眼神旋转，避免双骨拧转
    if (this.neckBone) {
      if (this._lastLookBodyWeight > 0 && this._lastLookBodyNeckQuat) {
        this.neckBone.quaternion.copy(this._lastLookBodyNeckQuat);
      } else {
        const neckBase = this._gestureNeckQuat
          ?? this._getBasePoseQuat(this.neckBone.name, this.neckBone);
        if (neckBase) this.neckBone.quaternion.copy(neckBase);
      }
    }
  }

  hasPoseLibrary() {
    return !!(this._fullRestPose?.size);
  }

  /** 待机 / 打字：手臂节律微动（叠加在 Blender 姿势上，不动胸部） */
  applyLifeRhythmEffect(delta, { typing = false, typingEnergy = 0 } = {}) {
    if (!this.isActive) return;
    const typingActive = typing && typingEnergy > 0.05;
    const e = typingActive ? Math.min(1, typingEnergy) : 0;
    const rate = typingActive ? 1.6 + e * 1.2 : 1;
    this._idlePhase += delta * rate;

    const life = this._lifeCfg();
    const period = life.period;
    const t = this._idlePhase;
    const omega = (Math.PI * 2) / (typingActive ? period * 0.72 : period);
    const slow = Math.sin(t * omega);
    const fast = Math.sin(t * omega * 1.38 + this._driftSeed);

    const armAmp = typingActive ? 0.006 + e * 0.009 : 0.007;
    this._applyArmLifeRhythm('left', slow, fast, armAmp, 0);
    this._applyArmLifeRhythm('right', slow, fast, armAmp, Math.PI * 0.62);
  }

  /** @deprecated 别名，供旧调用路径使用 */
  applyBreathEffect(delta, opts = {}) {
    this.applyLifeRhythmEffect(delta, {
      typing: opts.typing ?? this._animCtx?.typing,
      typingEnergy: opts.typingEnergy ?? this._animCtx?.typingEnergy ?? 0,
    });
  }

  /** 打字：指骨敲击（仅手指，避免与眼神/手臂跟随抢姿态） */
  applyTypingEffect(delta, energy) {
    if (!this.isActive || energy < 0.05) return;
    this._typingPhase += delta * (2.5 + energy * 3.5);
    const t = this._typingPhase;
    const e = Math.min(1, energy);
    const tap = 0.05 + e * 0.08;

    for (const side of ['left', 'right']) {
      const phaseOff = side === 'left' ? 0 : Math.PI * 0.55;

      collectFingerBones(this.skeleton, side).forEach((bone, i) => {
        const chain = Math.floor(i / 3);
        const speed = 2.0 + (chain % 5) * 0.25;
        const press = Math.max(0, Math.sin(t * speed + phaseOff + i * 0.12)) * tap;
        applyOffsetFromCurrent(bone, press * 0.6, 0, 0);
      });
    }
  }

  postMixerUpdate(_delta, _ctx = {}) {
    /* 微动由 applyLifeRhythmEffect / applyTypingEffect 驱动 */
  }

  /** 应用 Blender 姿势库 idle；打字时不切换 typing 姿势，避免锁死手臂 */
  applyArmPoseLayer(delta, { gesturing = false } = {}) {
    if (!this.isActive) return;
    this._animCtx = {
      ...this._animCtx,
      gesturing,
    };

    this._poseBlendTarget = 0;
    this._poseBlendT = 0;
    this._applyBlendedBasePose();
  }

  _applyBlendedBasePose() {
    if (!this._fullRestPose?.size) {
      this._currentBaseBaked = null;
      return;
    }

    this._applyBakedPose(this._fullRestPose);
    this._currentBaseBaked = this._fullRestPose;
  }

  _applyBakedPose(baked) {
    for (const bone of this.skeleton.bones) {
      const q = resolveBindEntry(baked, bone.name);
      if (q) bone.quaternion.copy(q);
    }
  }

  /** 加载姿势库后立即应用待机，避免首帧 bind/idle 不一致 */
  applyRestPose() {
    if (!this.isActive || !this._fullRestPose?.size) return this;
    this._applyBlendedBasePose();
    this.finalizeUpdate();
    return this;
  }

  resetPose() {
    this._look = { bodyX: 0, bodyY: 0, headX: 0, headY: 0, handAmount: 0.85 };
    this._typingPhase = 0;
    this._poseBlendT = 0;
    this._poseBlendTarget = 0;
    this._lookWeightHand = 0;
    this._lookWeightTorso = 0;
    this._lookRightWHand = 0;
    this._lookLeftWHand = 0;
    this._lookRightWTorso = 0;
    this._lookLeftWTorso = 0;
    this._lookUpWTorso = 0;
    this._lookDownWTorso = 0;
    this._lookBodyYSmooth = 0;
    this._lookBodyXSmooth = 0;
    this._viewBreathX = 0;
    this._viewBreathY = 0;
    this._lookBoneSmooth.clear();
  }

  resetSkeletonToBind() {
    if (!this.isActive) return this;
    this.resetPose();
    this.clearGestureHeadSnapshot();
    if (this._fullRestPose?.size) {
      this.applyRestPose();
      return this;
    }
    this.skeleton.pose();
    this.finalizeUpdate();
    return this;
  }

  dispose() {
    this.resetPose();
    this._bindQuats.clear();
    this._lookBaseQuats.clear();
    this._gestureHeadQuat = null;
    this._gestureNeckQuat = null;
    this._fullRestPose = null;
    this._fullTypingPose = null;
    this._restPoseData = null;
    this._typingPoseData = null;
    this._currentBaseBaked = null;
    this._lookBodyRightPose = null;
    this._lookBodyLeftPose = null;
    this._lookBodyRightBaked = null;
    this._lookBodyLeftBaked = null;
    this._lookBodyUpPose = null;
    this._lookBodyDownPose = null;
    this._lookBodyUpBaked = null;
    this._lookBodyDownBaked = null;
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
