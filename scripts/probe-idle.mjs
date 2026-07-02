import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

globalThis.self = globalThis;

const buf = fs.readFileSync('public/models/aqun_rig.glb');
const gltf = await (new GLTFLoader()).parseAsync(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  '',
);

let skinned = null;
gltf.scene.traverse((o) => {
  if (o.isSkinnedMesh) skinned = o;
});
const sk = skinned.skeleton;

function handY(side) {
  const b = sk.bones.find((x) => x.name === `hand${side}`);
  const p = new THREE.Vector3();
  b.getWorldPosition(p);
  return p;
}

function sample(t) {
  sk.pose();
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clip = gltf.animations.find((c) => c.name === 'idle');
  const action = mixer.clipAction(clip);
  action.play();
  action.time = t;
  mixer.update(0);
  sk.update();
  gltf.scene.updateMatrixWorld(true);
  const l = handY('l');
  const r = handY('r');
  console.log(`t=${t.toFixed(2)} handL (${l.x.toFixed(3)}, ${l.y.toFixed(3)}) handR (${r.x.toFixed(3)}, ${r.y.toFixed(3)})`);
}

sk.pose();
gltf.scene.updateMatrixWorld(true);
const bindL = handY('l');
console.log(`bind handL (${bindL.x.toFixed(3)}, ${bindL.y.toFixed(3)})`);
for (const t of [0, 0.5, 1, 2, 3]) sample(t);
