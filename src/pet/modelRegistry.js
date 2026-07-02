/** 可选 3D 模型 */

export const PET_MODELS = [
  {
    id: 'aqun_rig',
    file: 'aqun_rig.glb',
    name: '阿群 · 绑骨版',
    desc: 'ARP 骨骼绑定 · 姿势编辑',
    rigged: true,
  },
  {
    id: 'aqun',
    file: 'aqun.glb',
    name: '阿群 · 标准版',
    desc: '静态模型 · 可预览网格',
    rigged: false,
  },
  {
    id: 'aqun_pef',
    file: 'aqun_pef.glb',
    name: '阿群 · PEF 版',
    desc: '静态模型 · 可预览网格',
    rigged: false,
  },
  {
    id: 'aqun_tripo',
    file: 'aqun_tripo.glb',
    name: '阿群 · Tripo 版',
    desc: '静态模型 · 可预览网格',
    rigged: false,
  },
  {
    id: 'ty',
    file: 'ty.glb',
    name: 'TY 模型',
    desc: '静态模型 · 可预览网格',
    rigged: false,
  },
];

export function getModelById(id) {
  return PET_MODELS.find((m) => m.id === id) || PET_MODELS[0];
}

export function resolveModelFile(id) {
  return getModelById(id).file;
}

/** 姿势编辑器可选模型（含绑骨与静态，绑骨可编辑骨骼） */
export function getPoseEditorModels() {
  return PET_MODELS;
}

export function isRiggedModel(id) {
  return !!getModelById(id).rigged;
}

export function normalizeModelId(id) {
  if (!id) return PET_MODELS[0].id;
  const known = PET_MODELS.some((m) => m.id === id);
  return known ? id : PET_MODELS[0].id;
}

/** @deprecated 旧版 id 迁移 */
export function migrateLegacyModelId(id) {
  return normalizeModelId(id);
}
