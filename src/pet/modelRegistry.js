/** 可选 3D 模型 */

export const PET_MODELS = [
  {
    id: 'aqun_rig',
    file: 'aqun_rig.glb',
    name: '阿群',
    desc: 'ARP 骨骼 · 眼神跟随 · 姿势编辑',
    rigged: true,
  },
  {
    id: 'ty_rig',
    file: 'ty_rig.glb',
    name: 'TY',
    desc: 'ARP 骨骼 · 眼神跟随 · 姿势编辑',
    rigged: true,
  },
  {
    id: 'aqun',
    file: 'aqun.glb',
    name: '阿群（静态）',
    desc: '无骨骼 · 整体微动 · 眼神跟随',
    rigged: false,
  },
  {
    id: 'ty',
    file: 'ty.glb',
    name: 'TY（静态）',
    desc: '无骨骼 · 整体微动 · 眼神跟随',
    rigged: false,
  },
];

const LEGACY_MODEL_MAP = {
  aqun_pef: 'aqun_rig',
  aqun_tripo: 'aqun_rig',
};

export function getModelById(id) {
  const normalized = normalizeModelId(id);
  return PET_MODELS.find((m) => m.id === normalized) || PET_MODELS[0];
}

export function resolveModelFile(id) {
  return getModelById(id).file;
}

/** 控制中心「外观」页可选模型 */
export function getAppearanceModels() {
  return [...PET_MODELS];
}

/** 姿势编辑器可选模型 */
export function getPoseEditorModels() {
  return PET_MODELS.filter((m) => m.rigged);
}

export function isRiggedModel(id) {
  return !!getModelById(id).rigged;
}

export function normalizeModelId(id) {
  if (!id) return PET_MODELS[0].id;
  if (PET_MODELS.some((m) => m.id === id)) return id;
  if (LEGACY_MODEL_MAP[id]) return LEGACY_MODEL_MAP[id];
  return PET_MODELS[0].id;
}

/** @deprecated 旧版 id 迁移 */
export function migrateLegacyModelId(id) {
  return normalizeModelId(id);
}

export { getModelProfile } from '../scene/modelProfiles.js';
