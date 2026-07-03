/** ARP 骨骼名解析：poses.json 无点号别名 ↔ GLB 带点号骨骼名 */

export function legacyAlias(name) {
  if (!name || typeof name !== 'string') return name;
  if (/\.[lrx]$/.test(name)) return name;
  if (name.endsWith('x')) return `${name.slice(0, -1)}.x`;
  if (name.endsWith('l')) return `${name.slice(0, -1)}.l`;
  if (name.endsWith('r')) return `${name.slice(0, -1)}.r`;
  return name;
}

export function boneNameKeys(name) {
  const keys = new Set([name]);
  const alias = legacyAlias(name);
  keys.add(alias);
  keys.add(name.replace(/\./g, ''));
  keys.add(alias.replace(/\./g, ''));
  return keys;
}

export function resolveBoneOnSkeleton(skeleton, name) {
  if (!skeleton?.bones || !name) return null;
  const map = new Map();
  for (const bone of skeleton.bones) {
    for (const key of boneNameKeys(bone.name)) {
      if (!map.has(key)) map.set(key, bone);
    }
  }
  for (const key of boneNameKeys(name)) {
    const hit = map.get(key);
    if (hit) return hit;
  }
  const key = String(name).toLowerCase().replace('.x', '');
  for (const bone of skeleton.bones) {
    const n = bone.name.toLowerCase();
    if (n === key || n.endsWith(key) || n.replace(/\./g, '') === key.replace(/\./g, '')) {
      return bone;
    }
  }
  return null;
}

export function resolveBindEntry(map, name) {
  if (!map || !name) return null;
  for (const key of boneNameKeys(name)) {
    if (map.has(key)) return map.get(key);
  }
  return null;
}
