#!/usr/bin/env node
/** 列出 GLB 内所有 mesh / bone 节点名，用于编写 *.parts.json */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('用法: node scripts/inspect-glb-parts.cjs <model.glb>');
  process.exit(1);
}

function readGlb(p) {
  const b = fs.readFileSync(p);
  const magic = b.toString('utf8', 0, 4);
  if (magic !== 'glTF') throw new Error('不是 GLB 文件');
  const jsonLen = b.readUInt32LE(12);
  const jsonType = b.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error('JSON chunk 缺失');
  const jsonStr = b.toString('utf8', 20, 20 + jsonLen);
  return JSON.parse(jsonStr);
}

let gltf;
try {
  gltf = readGlb(path.resolve(file));
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

console.log('\n=== Meshes ===');
(gltf.meshes || []).forEach((m, i) => {
  console.log(`[mesh ${i}] name=${m.name || '(none)'}`);
});

console.log('\n=== Nodes (含 mesh / skin) ===');
(gltf.nodes || []).forEach((n, i) => {
  const parts = [`[node ${i}] name=${n.name || '(none)'}`];
  if (n.mesh != null) parts.push(`mesh=${n.mesh}`);
  if (n.skin != null) parts.push(`skin=${n.skin}`);
  console.log(parts.join(' '));
});

console.log('\n=== Skins / Joints ===');
(gltf.skins || []).forEach((s, i) => {
  console.log(`[skin ${i}] name=${s.name || '(none)'} joints=${(s.joints || []).length}`);
  (s.joints || []).forEach((j) => {
    const joint = gltf.nodes[j];
    console.log(`  - joint ${j}: ${joint?.name || '(none)'}`);
  });
});

console.log('\n可写入 public/models/<modelId>.parts.json 示例:');
console.log(
  JSON.stringify(
    { head: ['*Head*'], body: ['*Body*', '*Coat*'], neckBone: null, neckYRatio: 0.68 },
    null,
    2
  )
);
