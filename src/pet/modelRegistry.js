/** 可选 3D 模型（外观仅展示绑骨版） */

export const PET_MODELS = [
  {
    id: 'aqun_rig',
    file: 'aqun_rig.glb',
    name: '阿群 · 绑骨版',
    desc: 'ARP 骨骼 · 眼神跟随 · 姿势编辑',
    rigged: true,
  },
  {
    id: 'ty_rig',
    file: 'ty_rig.glb',
    name: 'TY · 绑骨版',
    desc: 'Blender ARP 骨骼 · 眼神跟随',
    rigged: true,
  },
];

const LEGACY_MODEL_MAP = {
  aqun: 'aqun_rig',
  aqun_pef: 'aqun_rig',
  aqun_tripo: 'aqun_rig',
  ty: 'ty_rig',
};

export function getModelById(id) {
  const normalized = normalizeModelId(id);
  return PET_MODELS.find((m) => m.id === normalized) || PET_MODELS[0];
}

export function resolveModelFile(id) {
  return getModelById(id).file;
}

/** 控制中心「外观」页可选模型（仅绑骨） */
export function getAppearanceModels() {
  return PET_MODELS.filter((m) => m.rigged);
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
  if (LEGACY_MODEL_MAP[id]) return LEGACY_MODEL_MAP[id];
  const known = PET_MODELS.some((m) => m.id === id);
  return known ? id : PET_MODELS[0].id;
}

/** @deprecated 旧版 id 迁移 */
export function migrateLegacyModelId(id) {
  return normalizeModelId(id);
}
