import gsap from 'gsap';

/** 姿态动画：modelGroup 负责动作，lookGroup 负责身体微动，headTarget 负责头部大角度 */
export class PetAnimations {
  constructor(modelGroup, lookGroup, bounds, {
    headTarget = null,
    headBodyRig = null,
    skeletalRig = null,
    modelLoader = null,
  } = {}) {
    this.group = modelGroup;
    this.lookGroup = lookGroup;
    this.headTarget = headTarget;
    this.headBodyRig = headBodyRig;
    this.skeletalRig = skeletalRig;
    this.modelLoader = modelLoader;
    this.bounds = bounds;
    this._baseY = modelGroup.position.y;
    this._look = { x: 0, y: 0 };
    this._headLook = { x: 0, y: 0 };
    this._bodyLook = { x: 0, y: 0 };
    this._lookTarget = { x: 0, y: 0 };
    this._bodySwayPhase = 0;
    this._headBump = { x: 0, y: 0 };
    this._bodyBump = { x: 0, y: 0, z: 0 };
    this._smoothNx = 0;
    this._smoothNy = 0;
    this._lookSensitivity = 1;
    this._lookHeadSens = 0.8;
    this._lookBodySens = 0.48;
    this._lookHandSens = 0.85;
    this._pointerActive = false;
    this._useGlobalNorm = false;
    this._globalNx = 0;
    this._globalNy = 0;
    this._pointer = { x: 0, y: 0, w: 1, h: 1 };
    this._actionTl = null;
    this._breathTween = null;
    this._swayTween = null;
    this._typingLean = 0;
    this._typingEnergy = 0;
    this._usesSkeleton = skeletalRig?.isActive ?? false;
    this._lastStrikeSide = 'center';
    this.group.rotation.set(0, 0, 0);
    this.lookGroup.rotation.set(0, 0, 0);
  }

  setLookSensitivity(value) {
    this.setLookSensitivities({ overall: value });
  }

  setLookSensitivities({ overall, head, body, hand } = {}) {
    if (overall != null) {
      this._lookSensitivity = Math.max(0.6, Math.min(2.2, overall));
    }
    if (head != null) {
      this._lookHeadSens = Math.max(0.6, Math.min(2.2, head));
    }
    if (body != null) {
      this._lookBodySens = Math.max(0.6, Math.min(2.2, body));
    }
    if (hand != null) {
      this._lookHandSens = Math.max(0.4, Math.min(1.8, hand));
    }
  }

  setRigRefs({ headTarget, headBodyRig, skeletalRig, modelLoader } = {}) {
    if (headTarget !== undefined) this.headTarget = headTarget;
    if (headBodyRig !== undefined) this.headBodyRig = headBodyRig;
    if (skeletalRig !== undefined) this.skeletalRig = skeletalRig;
    if (modelLoader !== undefined) this.modelLoader = modelLoader;
    this._usesSkeleton = this.skeletalRig?.isActive ?? false;
  }

  updateBounds(bounds) {
    this.bounds = bounds;
  }

  updateLook(delta) {
    const s = this._lookSensitivity;
    let destX = 0;
    let destY = 0;

    if (this._pointerActive) {
      let nx;
      let ny;
      if (this._useGlobalNorm) {
        nx = this._globalNx;
        ny = this._globalNy;
      } else {
        nx = (this._pointer.x / this._pointer.w) * 2 - 1;
        ny = (this._pointer.y / this._pointer.h) * 2 - 1;
      }
      const inputT = 1 - Math.exp(-22 * delta);
      this._smoothNx += (nx - this._smoothNx) * inputT;
      this._smoothNy += (ny - this._smoothNy) * inputT;
      destX = THREE_CLAMP(this._smoothNy * 0.62 * s, -0.72 * s, 0.72 * s);
      destY = THREE_CLAMP(this._smoothNx * 1.12 * s, -1.28 * s, 1.28 * s);
    } else {
      const inputT = 1 - Math.exp(-14 * delta);
      this._smoothNx += (0 - this._smoothNx) * inputT;
      this._smoothNy += (0 - this._smoothNy) * inputT;
    }

    this._lookTarget.x = destX;
    this._lookTarget.y = destY;

    const followSpeed = (this._pointerActive ? 26 : 16) * Math.sqrt(s);
    const followT = 1 - Math.exp(-followSpeed * delta);
    this._look.x += (this._lookTarget.x - this._look.x) * followT;
    this._look.y += (this._lookTarget.y - this._look.y) * followT;

    const HEAD_SHARE = this._usesSkeleton ? 0.88 : 1.35;
    const HEAD_PITCH_BOOST = this._usesSkeleton ? 1.05 : 1.28;
    const bodyX = this._look.x * 0.12 + (this._usesSkeleton ? 0 : this._bodyBump.x);
    const bodyY = this._look.y * 0.12 + (this._usesSkeleton ? 0 : this._bodyBump.y);

    if (this._usesSkeleton) {
      this.lookGroup.rotation.x = this._bodyLook.x;
      this.lookGroup.rotation.y = this._bodyLook.y;
      this.lookGroup.rotation.z = 0;
    } else {
      this.lookGroup.rotation.x = bodyX;
      this.lookGroup.rotation.y = bodyY;
    }

    const totalHeadX = this._look.x * HEAD_SHARE * HEAD_PITCH_BOOST * this._lookHeadSens + this._headBump.x;
    const totalHeadY = this._look.y * HEAD_SHARE * this._lookHeadSens + this._headBump.y;

    const headT = 1 - Math.exp(-(this._pointerActive ? 28 : 18) * Math.sqrt(s) * delta);
    this._headLook.x += (totalHeadX - this._headLook.x) * headT;
    this._headLook.y += (totalHeadY - this._headLook.y) * headT;

    if (this._usesSkeleton) {
      const BODY_FOLLOW = 0.38;
      const bodyTargetX = totalHeadX * BODY_FOLLOW * this._lookBodySens;
      const bodyTargetY = totalHeadY * BODY_FOLLOW * this._lookBodySens;
      const bodySpeed = (this._pointerActive ? 6 : 4) * Math.sqrt(s);
      const bodyT = 1 - Math.exp(-bodySpeed * delta);
      this._bodyLook.x += (bodyTargetX - this._bodyLook.x) * bodyT;
      this._bodyLook.y += (bodyTargetY - this._bodyLook.y) * bodyT;
    }

    if (this.headBodyRig?.mode === 'parts' && this.headTarget) {
      this.headTarget.rotation.x = this._headLook.x;
      this.headTarget.rotation.y = this._headLook.y;
    } else if (this.headBodyRig?.mode === 'unified') {
      this.lookGroup.rotation.x = this._look.x * 0.72 + this._bodyBump.x;
      this.lookGroup.rotation.y = this._look.y * 0.72 + this._bodyBump.y;
      this.group.rotation.x = -this._look.x * 0.06;
      this.group.rotation.y = -this._look.y * 0.05;
    }

    if (!this._usesSkeleton) {
      if (!this._pointerActive) {
        this._bodySwayPhase += delta * 0.65;
        const sway = Math.sin(this._bodySwayPhase) * 0.01;
        this.lookGroup.rotation.z = sway + this._bodyBump.z;
      } else {
        const decay = 1 - Math.min(1, 10 * delta);
        this._bodyBump.z *= decay;
        this.lookGroup.rotation.z = this._bodyBump.z;
      }
    }
  }

  /** 供 mixer 之后叠加到骨骼 */
  getHeadApplyPose() {
    if (this._usesSkeleton) {
      const headPitch = this._headLook.x + this._headBump.x;
      const headYaw = this._headLook.y + this._headBump.y;
      return {
        bodyX: this._bodyLook.x,
        bodyY: this._bodyLook.y,
        headX: headPitch,
        headY: headYaw,
        handAmount: this._lookHandSens,
      };
    }
    if (this.headBodyRig?.mode === 'bone') {
      return { x: this._headLook.x, y: this._headLook.y };
    }
    return null;
  }

  hasSkeletonLook() {
    return this._usesSkeleton;
  }

  /** 供键盘 overlay 跟随 — 与头部可见转动一致 */
  getLookRotation() {
    if (this._usesSkeleton) {
      return {
        x: this._bodyLook.x * 0.55 + this._headLook.x * 0.55 + this._headBump.x,
        y: this._bodyLook.y * 0.55 + this._headLook.y * 0.55 + this._headBump.y,
        sensitivity: this._lookSensitivity,
      };
    }
    const BODY = 0.16;
    const visualX = this._look.x * BODY + this._headLook.x + this._headBump.x;
    const visualY = this._look.y * BODY + this._headLook.y + this._headBump.y;
    return {
      x: visualX,
      y: visualY,
      sensitivity: this._lookSensitivity,
    };
  }

  resetLook() {
    this._pointerActive = false;
    this._lookTarget.x = 0;
    this._lookTarget.y = 0;
    this._bodyLook.x = 0;
    this._bodyLook.y = 0;
  }

  setLookDirection(nx, ny) {
    this._useGlobalNorm = true;
    this._globalNx = nx;
    this._globalNy = ny;
    this._pointerActive = true;
  }

  setPointer(screenX, screenY, width, height) {
    this._useGlobalNorm = false;
    this._pointer.x = screenX;
    this._pointer.y = screenY;
    this._pointer.w = width;
    this._pointer.h = height;
    this._pointerActive = true;
  }

  clearPointer() {
    this._pointerActive = false;
  }

  _killAction() {
    this._actionTl?.kill();
    this._actionTl = null;
  }

  startIdleBreath() {
    this._breathTween?.kill();
    this._swayTween?.kill();
    this._breathTween = null;
    this._swayTween = null;
    if (this._usesSkeleton) return;

    this._breathTween = gsap.to(this.group.position, {
      y: this._baseY + 0.012,
      duration: 2.6,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });

    this._swayTween = gsap.to(this.group.rotation, {
      z: 0.018,
      duration: 3.8,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  setDragPaused(paused) {
    if (paused) {
      this._breathTween?.pause();
      this._swayTween?.pause();
    } else {
      this._breathTween?.resume();
      this._swayTween?.resume();
    }
  }

  stopIdleBreath() {
    this._breathTween?.kill();
    this._swayTween?.kill();
    this._breathTween = null;
    this._swayTween = null;
    if (this._usesSkeleton) return;
    gsap.to(this.group.position, { y: this._baseY, duration: 0.3 });
    gsap.to(this.group.rotation, { z: 0, duration: 0.3 });
  }

  getLookNorm() {
    return { nx: this._smoothNx, ny: this._smoothNy };
  }

  setTypingEnergy(level) {
    this._typingEnergy = Math.max(0, Math.min(1, level));
    if (this._usesSkeleton) return;
    const lean = this._typingEnergy * 0.022;
    gsap.to(this.group.rotation, {
      x: lean,
      duration: 0.45,
      ease: 'sine.out',
      overwrite: 'auto',
    });
  }

  /** 打字时头部轻点、身体微晃 */
  playKeyStrike(side = 'center', intensity = 0.6) {
    this._lastStrikeSide = side;
    const i = Math.min(1, intensity) * (this._usesSkeleton ? 0.35 : 0.4);
    const nod = 0.008 + i * (this._usesSkeleton ? 0.014 : 0.018);
    const swayZ = side === 'left' ? 0.006 * i : side === 'right' ? -0.006 * i : 0;
    const swayY = side === 'left' ? 0.004 * i : side === 'right' ? -0.004 * i : 0;

    gsap.to(this._headBump, {
      x: nod,
      duration: 0.05,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        this._headBump.x = 0;
      },
    });

    if (this._usesSkeleton) return;

    gsap.to(this._bodyBump, {
      z: swayZ,
      y: swayY,
      duration: 0.055,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        this._bodyBump.z = 0;
        this._bodyBump.y = 0;
      },
    });

    gsap.to(this.group.position, {
      y: this._baseY - 0.0025 * i,
      duration: 0.05,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
    });
  }

  playTyping(intensity = 1) {
    if (this._usesSkeleton) return;
    const amp = 0.002 + Math.min(1, intensity) * 0.004;
    gsap.to(this.group.position, {
      y: this._baseY + amp,
      duration: 0.06,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
    });
  }

  playGeneric(intensity = 0.5) {
    const i = intensity * 0.35;
    if (!this._usesSkeleton) {
      gsap.to(this._headBump, {
        x: 0.015 * i,
        duration: 0.06,
        yoyo: true,
        repeat: 1,
        ease: 'sine.out',
        overwrite: 'auto',
        onComplete: () => {
          this._headBump.x = 0;
        },
      });
    }
    this.playTyping(intensity * 0.4);
  }

  playFunction(intensity = 1) {
    if (this._usesSkeleton) return;
    gsap.to(this.group.position, {
      y: this._baseY + 0.05 * intensity,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    gsap.to(this.group.rotation, {
      y: 0.07 * intensity,
      duration: 0.12,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this.group.rotation, { y: 0, duration: 0.15, ease: 'sine.inOut' });
      },
    });
  }

  playNumpad() {
    if (this._usesSkeleton) return;
    gsap.to(this.group.rotation, {
      z: 0.05,
      duration: 0.06,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this.group.rotation, { z: 0, duration: 0.12 });
      },
    });
    this.playTyping(0.75);
  }

  playSpaceSway(intensity = 0.7) {
    if (this._usesSkeleton) return null;
    const i = Math.min(1, intensity);
    this._killAction();
    this._actionTl = gsap.timeline();
    this._actionTl
      .to(this._bodyBump, { z: 0.028 * i, duration: 0.07, ease: 'sine.out' })
      .to(this._bodyBump, { z: -0.028 * i, duration: 0.1, ease: 'sine.inOut' })
      .to(this._bodyBump, { z: 0.014 * i, duration: 0.08, ease: 'sine.inOut' })
      .to(this._bodyBump, { z: 0, duration: 0.1, ease: 'sine.in' });
    return this._actionTl;
  }

  playJump() {
    if (this._usesSkeleton) return null;
    this.stopIdleBreath();
    this._killAction();
    this._actionTl = gsap.timeline({ onComplete: () => this.startIdleBreath() });
    this._actionTl
      .to(this.group.position, { y: this._baseY + 0.14, duration: 0.16, ease: 'power2.out' })
      .to(this.group.position, { y: this._baseY, duration: 0.3, ease: 'bounce.out' });
    return this._actionTl;
  }

  playLean(dir) {
    if (this._usesSkeleton) return;
    gsap.to(this.group.rotation, {
      x: dir.y * 0.32,
      y: dir.x * 0.22,
      duration: 0.18,
      ease: 'sine.out',
      overwrite: 'auto',
    });
  }

  resetLean(duration = 0.35) {
    if (this._usesSkeleton) return;
    gsap.to(this.group.rotation, {
      x: 0,
      y: 0,
      duration,
      ease: 'sine.inOut',
      overwrite: 'auto',
    });
  }

  playNod() {
    this._killAction();
    if (this.headTarget || this._usesSkeleton) {
      // 绑骨模式优先 GLB nod；fallback 用 _headBump 叠在当前眼神方向上
      this._actionTl = gsap.timeline();
      this._actionTl
        .to(this._headBump, { x: 0.08, duration: 0.11, ease: 'sine.out' })
        .to(this._headBump, { x: 0, duration: 0.2, ease: 'sine.in' });
      return this._actionTl;
    }
    this._actionTl = gsap.timeline();
    this._actionTl
      .to(this.group.rotation, { x: 0.08, duration: 0.1, ease: 'sine.out' })
      .to(this.group.rotation, { x: 0, duration: 0.18, ease: 'sine.in' });
    return this._actionTl;
  }

  playSurprised() {
    if (this._usesSkeleton) return;
    gsap.fromTo(
      this.group.scale,
      { z: 1.02 },
      { z: 1, duration: 0.12, ease: 'sine.out', overwrite: 'auto' }
    );
    gsap.to(this.group.rotation, {
      z: 0.06,
      duration: 0.07,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this.group.rotation, { z: 0, duration: 0.15 });
      },
    });
  }

  playFocus() {
    if (this._usesSkeleton) return;
    gsap.to(this.group.rotation, {
      x: 0.05,
      duration: 0.22,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this.group.rotation, { x: 0, duration: 0.35, ease: 'sine.inOut' });
      },
    });
  }

  playPoke() {
    if (this._usesSkeleton) return;
    this._breathTween?.pause();
    gsap.fromTo(
      this.group.scale,
      { x: 0.93, y: 0.93, z: 0.93 },
      {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.4,
        ease: 'elastic.out(1, 0.55)',
        overwrite: 'auto',
        onComplete: () => {
          this.group.scale.set(1, 1, 1);
          this._breathTween?.resume();
        },
      }
    );
    const bump = this._look.x + 0.05;
    gsap.to(this._look, {
      x: bump,
      duration: 0.08,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      onUpdate: () => {
        this.lookGroup.rotation.x = this._look.x;
      },
    });
  }

  playWave() {
    if (this._usesSkeleton) return null;
    this._killAction();
    this._actionTl = gsap.timeline();
    this._actionTl
      .to(this.group.rotation, { z: 0.12, duration: 0.18, ease: 'sine.out' })
      .to(this.group.rotation, { z: -0.06, duration: 0.22, ease: 'sine.inOut' })
      .to(this.group.rotation, { z: 0, duration: 0.2, ease: 'sine.in' });
    return this._actionTl;
  }

  playStretch() {
    if (this._usesSkeleton) return null;
    this._killAction();
    this._actionTl = gsap.timeline();
    this._actionTl
      .to(this.group.scale, { y: 1.04, duration: 0.35, ease: 'sine.out' })
      .to(this.group.scale, { y: 1, duration: 0.45, ease: 'elastic.out(1, 0.6)' });
    return this._actionTl;
  }

  playSpin() {
    if (this._usesSkeleton) return null;
    this.stopIdleBreath();
    this._killAction();
    return gsap.to(this.group.rotation, {
      y: Math.PI * 2,
      duration: 0.85,
      ease: 'power2.inOut',
      overwrite: 'auto',
      onComplete: () => {
        this.group.rotation.y = 0;
        this.startIdleBreath();
      },
    });
  }

  lookAt(screenX, screenY, width, height) {
    this.setPointer(screenX, screenY, width, height);
  }

  lookAtNorm(nx, ny) {
    this.setLookDirection(nx, ny);
  }

  resetLook() {
    this.clearPointer();
  }

  playHologramFlash(onStart, onEnd) {
    onStart?.();
    this._killAction();
    this._actionTl = gsap.timeline({ onComplete: () => onEnd?.() });
    this._actionTl
      .to(this.group.scale, { x: 1.05, y: 1.05, z: 1.05, duration: 0.12 })
      .to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'elastic.out(1, 0.45)' });
    return this._actionTl;
  }

  dispose() {
    this._breathTween?.kill();
    this._swayTween?.kill();
    this._actionTl?.kill();
  }
}

function THREE_CLAMP(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
