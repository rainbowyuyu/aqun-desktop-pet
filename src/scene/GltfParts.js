import * as THREE from 'three';

/** 部件名匹配（节点名 / mesh 名 / 路径） */
const HEAD_PATTERNS = [
  /head/i, /face/i, /hair/i, /skull/i, /cranium/i, /jaw/i, /ear/i, /eye/i, /brow/i,
  /头/, /发/, /脸/, /眼/, /帽/,
];

const BODY_PATTERNS = [
  /body/i, /torso/i, /cloth/i, /coat/i, /robe/i, /shirt/i, /pants/i, /skirt/i,
  /arm/i, /hand/i, /leg/i, /foot/i, /shoe/i, /chest/i, /hip/i, /spine/i,
  /身/, /衣/, /袍/, /服/, /手/, /腿/, /脚/, /身体/,
];

const DEFAULT_PARTS = {
  head: ['*head*', '*hair*', '*face*', '*Head*', '*Hair*', '*Face*'],
  body: ['*body*', '*Body*', '*cloth*', '*Cloth*', '*coat*', '*Coat*', '*robe*', '*Robe*'],
  neckBone: null,
  neckYRatio: 0.68,
};

function globMatch(text, pattern) {
  const p = pattern.replace(/\*/g, '.*');
  return new RegExp(`^${p}$`, 'i').test(text);
}

function nodePath(obj) {
  const parts = [];
  let cur = obj;
  while (cur) {
    if (cur.name) parts.unshift(cur.name);
    cur = cur.parent;
  }
  return parts.join('/');
}

/** 遍历模型内所有 mesh 及节点信息 */
export function collectMeshEntries(root) {
  const entries = [];
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    entries.push({
      mesh: obj,
      name: obj.name || '',
      path: nodePath(obj),
    });
  });
  return entries;
}

function classifyByPatterns(entry, config) {
  const text = `${entry.name} ${entry.path}`;
  const matchList = (patterns) =>
    patterns?.some((p) => {
      const core = String(p).replace(/\*/g, '');
      return globMatch(text, p) || (core && text.toLowerCase().includes(core.toLowerCase()));
    });

  if (matchList(config.head)) return 'head';
  if (matchList(config.body)) return 'body';
  if (HEAD_PATTERNS.some((re) => re.test(text))) return 'head';
  if (BODY_PATTERNS.some((re) => re.test(text))) return 'body';
  return 'unknown';
}

export function resolvePartsConfig(custom) {
  if (!custom) return { ...DEFAULT_PARTS };
  return {
    head: custom.head?.length ? custom.head : DEFAULT_PARTS.head,
    body: custom.body?.length ? custom.body : DEFAULT_PARTS.body,
    neckBone: custom.neckBone ?? null,
    neckYRatio: custom.neckYRatio ?? DEFAULT_PARTS.neckYRatio,
  };
}

/** 按 GLB 内节点名 / 配置拆成 head、body 列表 */
export function classifyMeshes(entries, config = DEFAULT_PARTS) {
  const cfg = resolvePartsConfig(config);
  const head = [];
  const body = [];
  const unknown = [];

  for (const entry of entries) {
    const part = classifyByPatterns(entry, cfg);
    if (part === 'head') head.push(entry.mesh);
    else if (part === 'body') body.push(entry.mesh);
    else unknown.push(entry);
  }

  return { head, body, unknown, config: cfg };
}

/** 从 models/{modelId}.parts.json 读取部件表 */
export async function loadPartsConfig(modelId, baseUrl = '', modelUrl = '') {
  const bases = [];
  if (modelUrl) {
    bases.push(modelUrl.replace(/\.glb(\?.*)?$/i, '.parts.json'));
  }
  bases.push(
    `${baseUrl}models/${modelId}.parts.json`,
    `${baseUrl}models/parts/${modelId}.json`
  );

  for (const url of bases) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      return resolvePartsConfig(await res.json());
    } catch {
      /* try next */
    }
  }
  return resolvePartsConfig(null);
}

export function findNeckBone(root, nameHint) {
  if (nameHint) {
    let found = null;
    root.traverse((obj) => {
      if (obj.isBone && obj.name === nameHint) found = obj;
    });
    if (found) return found;
  }

  let best = null;
  let score = 0;
  root.traverse((obj) => {
    if (!obj.isBone) return;
    const n = obj.name || '';
    if (/head|skull/i.test(n) && score < 4) {
      best = obj;
      score = 4;
    } else if (/neck/i.test(n) && score < 3) {
      best = obj;
      score = 3;
    } else if (/spine.*2|spine2|upper/i.test(n) && score < 2) {
      best = obj;
      score = 2;
    }
  });
  return best;
}

export function computeNeckY(headMeshes, bodyMeshes, bounds, ratio = 0.68) {
  if (bodyMeshes.length && headMeshes.length) {
    const bodyBox = new THREE.Box3();
    const headBox = new THREE.Box3();
    bodyMeshes.forEach((m) => {
      m.updateMatrixWorld(true);
      bodyBox.expandByObject(m);
    });
    headMeshes.forEach((m) => {
      m.updateMatrixWorld(true);
      headBox.expandByObject(m);
    });
    if (Number.isFinite(bodyBox.max.y) && Number.isFinite(headBox.min.y)) {
      return (bodyBox.max.y + headBox.min.y) * 0.5;
    }
  }
  const size = bounds.getSize(new THREE.Vector3());
  return bounds.min.y + size.y * ratio;
}

/** 多 mesh 但未命名：按包围盒 Y 分配（不切割几何体） */
export function splitMeshesByBounds(meshes, splitY) {
  const head = [];
  const body = [];
  for (const mesh of meshes) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    if (center.y >= splitY) head.push(mesh);
    else body.push(mesh);
  }
  return { head, body };
}
