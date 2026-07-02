import * as THREE from 'three';

/** 场景全息特效：平台环、鼠标指向光束、按键脉冲环 */
export class HoloEffects {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this._mouseDir = new THREE.Vector3(0, 0, 1);
    this._smoothDir = new THREE.Vector3(0, 0, 1);
    this._ripples = [];
    this._keyGlow = 0;
    this._typingGlow = 0;

    this._buildPlatform();
    this._buildBeam();
  }

  _buildPlatform() {
    const geo = new THREE.TorusGeometry(0.42, 0.012, 8, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x66ddff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.platform = new THREE.Mesh(geo, mat);
    this.platform.rotation.x = Math.PI / 2;
    this.platform.position.y = 0.02;
    this.group.add(this.platform);

    const geo2 = new THREE.TorusGeometry(0.48, 0.006, 8, 64);
    const mat2 = mat.clone();
    mat2.opacity = 0.18;
    this.platformOuter = new THREE.Mesh(geo2, mat2);
    this.platformOuter.rotation.x = Math.PI / 2;
    this.platformOuter.position.y = 0.018;
    this.group.add(this.platformOuter);
  }

  _buildBeam() {
    const points = [new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(0, 0.75, 1.2)];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0x88eeff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.beam = new THREE.Line(geo, mat);
    this.group.add(this.beam);

    const coneGeo = new THREE.ConeGeometry(0.06, 0.18, 3);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xaaffee,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.beamTip = new THREE.Mesh(coneGeo, coneMat);
    this.beamTip.rotation.x = Math.PI / 2;
    this.group.add(this.beamTip);
  }

  setMouseLook(nx, ny) {
    this._mouseDir.set(nx * 0.85, -ny * 0.55, 1).normalize();
  }

  pulseKey(intensity = 1) {
    this._keyGlow = Math.min(1, this._keyGlow + 0.35 * intensity);
    this._spawnRipple(0.28 + intensity * 0.12, 0x66eeff);
  }

  setTypingLevel(level) {
    this._typingGlow = Math.max(0, Math.min(1, level));
  }

  _spawnRipple(radius, color) {
    const geo = new THREE.RingGeometry(radius * 0.35, radius, 32);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.04;
    this.group.add(mesh);
    this._ripples.push({ mesh, age: 0, life: 0.65 });
  }

  applyModelGlow(meshes, delta) {
    this._keyGlow = Math.max(0, this._keyGlow - delta * 2.8);
    const glow = this._keyGlow * 0.55 + this._typingGlow * 0.22;

    meshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat?.emissive) return;
        if (glow < 0.01) {
          mat.emissive.setHex(0x000000);
          if (mat.emissiveIntensity != null) mat.emissiveIntensity = 0;
        } else {
          mat.emissive.setHex(0x2288aa);
          if (mat.emissiveIntensity != null) mat.emissiveIntensity = glow;
        }
        mat.needsUpdate = true;
      });
    });
  }

  update(delta) {
    const t = performance.now() * 0.001;
    this.platform.rotation.z = t * 0.35;
    this.platformOuter.rotation.z = -t * 0.22;

    const follow = 1 - Math.exp(-12 * delta);
    this._smoothDir.lerp(this._mouseDir, follow);

    const origin = new THREE.Vector3(0, 0.78, 0);
    const end = origin.clone().add(this._smoothDir.clone().multiplyScalar(0.55));
    const pos = this.beam.geometry.attributes.position;
    pos.setXYZ(0, origin.x, origin.y, origin.z);
    pos.setXYZ(1, end.x, end.y, end.z);
    pos.needsUpdate = true;

    this.beamTip.position.copy(end);
    this.beamTip.lookAt(end.clone().add(this._smoothDir));

    const beamOp = 0.25 + this._typingGlow * 0.35 + this._keyGlow * 0.25;
    this.beam.material.opacity = beamOp;
    this.beamTip.material.opacity = beamOp * 0.7;

    this._ripples = this._ripples.filter((r) => {
      r.age += delta;
      const tNorm = r.age / r.life;
      if (tNorm >= 1) {
        this.group.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        return false;
      }
      r.mesh.scale.setScalar(1 + tNorm * 1.8);
      r.mesh.material.opacity = 0.55 * (1 - tNorm);
      return true;
    });

    const platOp = 0.22 + this._typingGlow * 0.25;
    this.platform.material.opacity = platOp;
    this.platformOuter.material.opacity = platOp * 0.65;
  }

  dispose() {
    this.group.parent?.remove(this.group);
    this.platform.geometry.dispose();
    this.platform.material.dispose();
    this.platformOuter.geometry.dispose();
    this.platformOuter.material.dispose();
    this.beam.geometry.dispose();
    this.beam.material.dispose();
    this.beamTip.geometry.dispose();
    this.beamTip.material.dispose();
    this._ripples.forEach((r) => {
      r.mesh.geometry.dispose();
      r.mesh.material.dispose();
    });
  }
}
