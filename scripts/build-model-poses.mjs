#!/usr/bin/env node
/**
 * 从模板姿势库生成目标模型专用 poses.json（正确骨骼名 + 独立缩放）
 * 用法: node scripts/build-model-poses.mjs ty_rig aqun_rig
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const targetId = process.argv[2] || 'ty_rig';
const templateId = process.argv[3] || 'aqun_rig';

const PROFILES = {
  aqun_rig: { poseEulerScale: 1 },
  ty_rig: { poseEulerScale: 0.88 },
};

function readGlbJson(glbPath) {
  const b = fs.readFileSync(glbPath);
  const jsonLen = b.readUInt32LE(12);
  return JSON.parse(b.toString('utf8', 20, 20 + jsonLen));
}

function deformBoneSet(gltf) {
  const skin = gltf.skins?.[0];
  if (!skin) return new Set();
  return new Set(skin.joints.map((i) => gltf.nodes[i]?.name).filter(Boolean));
}

function legacyAlias(name) {
  if (/\.[lrx]$/.test(name)) return name;
  if (name.endsWith('x')) return `${name.slice(0, -1)}.x`;
  if (name.endsWith('l')) return `${name.slice(0, -1)}.l`;
  if (name.endsWith('r')) return `${name.slice(0, -1)}.r`;
  return name;
}

function resolveTargetBoneName(name, deform) {
  const candidates = [
    name,
    legacyAlias(name),
    name.replace(/\./g, ''),
    legacyAlias(name).replace(/\./g, ''),
  ];
  return candidates.find((c) => deform.has(c)) ?? null;
}

function retargetPoseBones(poseBones, deform, scale) {
  const out = {};
  for (const [name, entry] of Object.entries(poseBones ?? {})) {
    const targetName = resolveTargetBoneName(name, deform);
    if (!targetName) continue;
    const e = entry?.euler ?? [0, 0, 0];
    out[targetName] = {
      euler: [e[0] * scale, e[1] * scale, e[2] * scale],
      locked: entry?.locked ?? false,
    };
    if (entry?.position) {
      out[targetName].position = [...entry.position];
    }
  }
  return out;
}

function main() {
  const templatePath = path.join(root, 'public/models', `${templateId}.poses.json`);
  const glbPath = path.join(root, 'public/models', `${targetId}.glb`);
  const outPath = path.join(root, 'public/models', `${targetId}.poses.json`);

  if (!fs.existsSync(templatePath)) {
    console.error('模板不存在:', templatePath);
    process.exit(1);
  }
  if (!fs.existsSync(glbPath)) {
    console.error('GLB 不存在:', glbPath);
    process.exit(1);
  }

  const template = JSON.parse(fs.readFileSync(templatePath, 'utf8'));
  const gltf = readGlbJson(glbPath);
  const deform = deformBoneSet(gltf);
  const scale = PROFILES[targetId]?.poseEulerScale ?? 1;

  const poses = {};
  for (const [id, pose] of Object.entries(template.poses ?? {})) {
    poses[id] = {
      ...pose,
      id,
      bones: retargetPoseBones(pose.bones, deform, id === 'bind' ? 1 : scale),
    };
  }

  const lib = {
    version: template.version ?? 1,
    modelId: targetId,
    eulerOrder: template.eulerOrder ?? 'XYZ',
    poses,
    assignments: { ...template.assignments },
    transitions: JSON.parse(JSON.stringify(template.transitions ?? [])),
  };

  fs.writeFileSync(outPath, `${JSON.stringify(lib, null, 2)}\n`, 'utf8');

  const idleCount = Object.keys(poses.idle?.bones ?? {}).length;
  console.log(`✓ ${outPath}`);
  console.log(`  modelId=${targetId}, idle bones=${idleCount}, deform bones=${deform.size}, scale=${scale}`);
}

main();
