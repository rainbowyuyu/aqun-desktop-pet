import * as THREE from 'three';
import gsap from 'gsap';
import { Theme, SUN_DIR, sunPosition } from './theme.js';

const LOOK_TARGET = new THREE.Vector3(0, 0.88, 0);

/** 模型光照 — 轻量环境反射 + 三点光，加载后渐亮 */
export class PetLighting {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.lights = {};
    this._fadeTween = null;
    this._envReady = false;

    this._targets = {
      key: 1.85,
      fill: 0.48,
      rim: 0.42,
      front: 0.28,
      ambient: 0.32,
      hemi: 0.4,
      env: 0.45,
    };

    this._setupLights();
    this.setBootstrapMode();
    requestAnimationFrame(() => this._setupEnvironment());
  }

  _setupLights() {
    const ambient = new THREE.AmbientLight(0xfff8f0, 0.06);
    this.scene.add(ambient);
    this.lights.ambient = ambient;

    const hemi = new THREE.HemisphereLight(0xd8ecff, 0xa8c898, 0.08);
    this.scene.add(hemi);
    this.lights.hemi = hemi;

    const sp = sunPosition(1);
    const key = new THREE.DirectionalLight(0xfffff2, 0);
    key.position.set(sp.x * 22, sp.y * 22, sp.z * 22);
    key.target.position.copy(LOOK_TARGET);
    this.scene.add(key);
    this.scene.add(key.target);
    this.lights.key = key;

    const fill = new THREE.DirectionalLight(0xe8f0ff, 0);
    fill.position.set(-4.5, 2.2, 5);
    fill.target.position.copy(LOOK_TARGET);
    this.scene.add(fill);
    this.scene.add(fill.target);
    this.lights.fill = fill;

    const rim = new THREE.DirectionalLight(0xfff0e8, 0);
    rim.position.set(3.5, 4.5, -2.5);
    rim.target.position.copy(LOOK_TARGET);
    this.scene.add(rim);
    this.scene.add(rim.target);
    this.lights.rim = rim;

    const front = new THREE.PointLight(0xfff8f0, 0, 6);
    front.position.set(0, 1.05, 1.8);
    this.scene.add(front);
    this.lights.front = front;
  }

  _setupEnvironment() {
    if (!this.renderer || this._envReady) return;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(8, 24, 24);
    const sunDir = new THREE.Vector3(SUN_DIR.x, SUN_DIR.y, SUN_DIR.z).normalize();

    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(Theme.sky.zenith) },
        midColor: { value: new THREE.Color(Theme.sky.mid) },
        botColor: { value: new THREE.Color(Theme.sky.horizon) },
        sunDir: { value: sunDir },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        uniform vec3 sunDir;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          vec3 col = h > 0.5
            ? mix(midColor, topColor, (h - 0.5) * 2.0)
            : mix(botColor, midColor, h * 2.0);
          float sun = pow(max(dot(normalize(vWorldPosition), sunDir), 0.0), 10.0);
          col += vec3(1.0, 0.97, 0.9) * sun * 0.05;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    envScene.add(new THREE.Mesh(envGeo, envMat));
    const envMap = pmrem.fromScene(envScene, 0.04).texture;
    this.scene.environment = envMap;
    this.scene.environmentIntensity = 0;
    this._envReady = true;

    pmrem.dispose();
    envGeo.dispose();
    envMat.dispose();
  }

  enhanceMaterials(meshes) {
    meshes.forEach((mesh) => {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((mat) => {
        if (!mat?.isMeshStandardMaterial && !mat?.isMeshPhysicalMaterial) return;
        mat.envMapIntensity = 0.55;
        if (mat.roughness != null) mat.roughness = Math.min(mat.roughness, 0.72);
        if (mat.metalness != null) mat.metalness = Math.max(0, mat.metalness * 0.85);
        mat.needsUpdate = true;
      });
    });
  }

  setBootstrapMode() {
    this._fadeTween?.kill();
    this.lights.key.intensity = 0;
    this.lights.fill.intensity = 0;
    this.lights.rim.intensity = 0;
    this.lights.front.intensity = 0;
    this.lights.ambient.intensity = 0.06;
    this.lights.hemi.intensity = 0.08;
    if (this.scene.environment) this.scene.environmentIntensity = 0;
  }

  fadeInDaylight(duration = 1.6) {
    this._setupEnvironment();
    this._fadeTween?.kill();

    const proxy = {
      key: this.lights.key.intensity,
      fill: this.lights.fill.intensity,
      rim: this.lights.rim.intensity,
      front: this.lights.front.intensity,
      ambient: this.lights.ambient.intensity,
      hemi: this.lights.hemi.intensity,
      env: this.scene.environmentIntensity || 0,
    };

    this._fadeTween = gsap.to(proxy, {
      key: this._targets.key,
      fill: this._targets.fill,
      rim: this._targets.rim,
      front: this._targets.front,
      ambient: this._targets.ambient,
      hemi: this._targets.hemi,
      env: this._targets.env,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        this.lights.key.intensity = proxy.key;
        this.lights.fill.intensity = proxy.fill;
        this.lights.rim.intensity = proxy.rim;
        this.lights.front.intensity = proxy.front;
        this.lights.ambient.intensity = proxy.ambient;
        this.lights.hemi.intensity = proxy.hemi;
        if (this.scene.environment) this.scene.environmentIntensity = proxy.env;
      },
    });

    return this._fadeTween;
  }

  /** 防止光照渐亮失败导致模型不可见 */
  ensureMinimumLight(delayMs = 2000) {
    setTimeout(() => {
      if (this.lights.key.intensity > 0.4) return;
      this._fadeTween?.kill();
      this.lights.key.intensity = this._targets.key;
      this.lights.fill.intensity = this._targets.fill;
      this.lights.rim.intensity = this._targets.rim;
      this.lights.front.intensity = this._targets.front;
      this.lights.ambient.intensity = this._targets.ambient;
      this.lights.hemi.intensity = this._targets.hemi;
      if (this.scene.environment) this.scene.environmentIntensity = this._targets.env;
    }, delayMs);
  }

  setMood(mode) {
    const presets = {
      idle: { key: 1, fill: 1, rim: 1, front: 1, env: 1 },
      typing: { key: 1.06, fill: 1.04, rim: 0.95, front: 1.08, env: 1.02 },
      hologram: { key: 0.72, fill: 0.68, rim: 1.1, front: 0.6, env: 0.65 },
    };
    const p = presets[mode] || presets.idle;
    this._fadeTween?.kill();

    const proxy = {
      key: this.lights.key.intensity,
      fill: this.lights.fill.intensity,
      rim: this.lights.rim.intensity,
      front: this.lights.front.intensity,
      env: this.scene.environmentIntensity || this._targets.env,
    };

    this._fadeTween = gsap.to(proxy, {
      key: this._targets.key * p.key,
      fill: this._targets.fill * p.fill,
      rim: this._targets.rim * p.rim,
      front: this._targets.front * p.front,
      env: this._targets.env * p.env,
      duration: 0.6,
      ease: 'sine.inOut',
      onUpdate: () => {
        this.lights.key.intensity = proxy.key;
        this.lights.fill.intensity = proxy.fill;
        this.lights.rim.intensity = proxy.rim;
        this.lights.front.intensity = proxy.front;
        if (this.scene.environment) this.scene.environmentIntensity = proxy.env;
      },
    });
  }

  setHologramTint(enabled) {
    this.setMood(enabled ? 'hologram' : 'idle');
    this.lights.ambient.color.setHex(enabled ? 0xd8f8ff : 0xfff8f0);
  }
}
