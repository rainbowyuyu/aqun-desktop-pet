/** 各绑骨模型独立参数：缩放、眼神、微动、姿势缩放（勿混用） */

const DEFAULT_LOOK = {
  bodyFullY: 0.12,
  bodyFullX: 0.14,
  bodyIntensity: 1,
  groupBodyY: 0.34,
  groupBodyX: 0.14,
  handSmooth: 3.8,
  torsoSmooth: 9,
  sideSmooth: 7,
  handBoneSmooth: 3.2,
  torsoBoneSmooth: 5.5,
  viewBreathSmooth: 3.2,
};

const DEFAULT_LIFE = {
  period: 3.6,
  amp: {
    shoulder: 0.004,
    upper: 0.005,
    forearm: 0.007,
    hand: 0.006,
    head: 0.0045,
    neck: 0.0035,
  },
};

export const MODEL_PROFILES = {
  aqun_rig: {
    id: 'aqun_rig',
    rigTargetHeight: 1.28,
    rigFaceY: 0,
    rigPositionOffset: { x: 0, y: 0.04, z: -0.06 },
    hasGltfAnimations: true,
    idleClipTimeScale: 1,
    poseEulerScale: 1,
    look: { ...DEFAULT_LOOK },
    life: {
      period: DEFAULT_LIFE.period,
      amp: { ...DEFAULT_LIFE.amp },
    },
  },
  ty_rig: {
    id: 'ty_rig',
    rigTargetHeight: 1.26,
    rigFaceY: 0,
    rigPositionOffset: { x: 0, y: 0.02, z: -0.05 },
    hasGltfAnimations: false,
    idleClipTimeScale: 0,
    poseEulerScale: 1,
    look: {
      bodyFullY: 0.095,
      bodyFullX: 0.11,
      bodyIntensity: 0.9,
      groupBodyY: 0.28,
      groupBodyX: 0.11,
      handSmooth: 3.4,
      torsoSmooth: 8,
      sideSmooth: 6.2,
      handBoneSmooth: 2.8,
      torsoBoneSmooth: 4.8,
      viewBreathSmooth: 2.8,
    },
    life: {
      period: 3.8,
      amp: {
        shoulder: 0.0035,
        upper: 0.0045,
        forearm: 0.006,
        hand: 0.005,
        head: 0.004,
        neck: 0.003,
      },
    },
  },
  aqun: {
    id: 'aqun',
    targetHeight: 1.34,
    positionOffset: { x: 0, y: 0.01, z: -0.03 },
    hasGltfAnimations: false,
    look: {
      bodyFullY: 0.14,
      bodyFullX: 0.16,
      bodyIntensity: 1,
      groupBodyY: 0.48,
      groupBodyX: 0.2,
      handSmooth: 3.8,
      torsoSmooth: 9,
      sideSmooth: 7,
      handBoneSmooth: 3.2,
      torsoBoneSmooth: 5.5,
      viewBreathSmooth: 3.2,
    },
    staticLife: {
      breathAmp: 0.011,
      breathPeriod: 2.9,
      swayAmp: 0.007,
      swayPeriod: 3.8,
      idleHeadAmp: 0.035,
    },
    staticLook: {
      inputMul: 1.38,
      headMul: 1.28,
      bodyMul: 1.45,
      followMul: 1.32,
      groupRotMul: 1.4,
    },
  },
  ty: {
    id: 'ty',
    targetHeight: 1.32,
    positionOffset: { x: 0, y: 0.01, z: -0.03 },
    hasGltfAnimations: false,
    look: {
      bodyFullY: 0.13,
      bodyFullX: 0.15,
      bodyIntensity: 0.95,
      groupBodyY: 0.46,
      groupBodyX: 0.19,
      handSmooth: 3.6,
      torsoSmooth: 8.5,
      sideSmooth: 6.8,
      handBoneSmooth: 3,
      torsoBoneSmooth: 5,
      viewBreathSmooth: 3,
    },
    staticLife: {
      breathAmp: 0.01,
      breathPeriod: 3,
      swayAmp: 0.006,
      swayPeriod: 4,
      idleHeadAmp: 0.032,
    },
    staticLook: {
      inputMul: 1.35,
      headMul: 1.25,
      bodyMul: 1.42,
      followMul: 1.3,
      groupRotMul: 1.38,
    },
  },
};

export function getModelProfile(modelId) {
  const id = modelId || 'aqun_rig';
  return MODEL_PROFILES[id] ?? MODEL_PROFILES.aqun_rig;
}
