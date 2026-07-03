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
    this._handLook = { x: 0, y: 0 };
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
    this._pendingBodyGesture = null;
    this._breathTween = null;
    this._swayTween = null;
    this._typingLean = 0;
    this._typingEnergy = 0;
    this._usesSkeleton = skeletalRig?.isActive ?? false;
    this._idleDriftPhase = Math.random() * Math.PI * 2;
    this._lastStrikeSide = 'center';
    this._idleBreathOffset = 0;
    this._idleSwayZ = 0;
    /** 非绑骨动作偏移，由 updateLook 合成到 group，避免被眼神覆盖 */
    this._actionPose = { x: 0, y: 0, z: 0, posY: 0 };
    this.group.rotation.set(0, 0, 0);
    this.lookGroup.rotation.set(0, 0, 0);
  }

  _isUnifiedStatic() {
    return !this._usesSkeleton && this.headBodyRig?.mode === 'unified';
  }

  _staticLifeCfg() {
    return this.modelLoader?._profile?.staticLife ?? {};
  }

  /** 静态模型专用眼神倍率；绑骨模型恒为 1 */
  _staticLookMul(key) {
    if (this._usesSkeleton) return 1;
    return this.modelLoader?._profile?.staticLook?.[key] ?? 1;
  }

  /** 非绑骨：GSAP 驱动 _actionPose；绑骨：直接驱动 group */
  _animRot() {
    return this._usesSkeleton ? this.group.rotation : this._actionPose;
  }

  _animPosTarget() {
    return this._usesSkeleton ? this.group.position : this._actionPose;
  }

  _animPosKey() {
    return this._usesSkeleton ? 'y' : 'posY';
  }

  _animPosBase() {
    return this._usesSkeleton ? this._baseY : 0;
  }

  _resetActionPose() {
    this._actionPose.x = 0;
    this._actionPose.y = 0;
    this._actionPose.z = 0;
    this._actionPose.posY = 0;
  }

  _applyNonSkeletonGroupPose() {
    if (this._usesSkeleton) return;
    this.group.position.y = this._baseY + this._idleBreathOffset + this._actionPose.posY;
    let lookX = 0;
    let lookY = 0;
    if (this.headBodyRig?.mode === 'unified') {
      lookX = -this._headLook.x * 0.04 * this._staticLookMul('groupRotMul');
      lookY = -this._headLook.y * 0.035 * this._staticLookMul('groupRotMul');
    }
    this.group.rotation.x = lookX + this._actionPose.x;
    this.group.rotation.y = lookY + this._actionPose.y;
    this.group.rotation.z = this._actionPose.z;
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
      const inputT = 1 - Math.exp(-16 * delta);
      this._smoothNx += (nx - this._smoothNx) * inputT;
      this._smoothNy += (ny - this._smoothNy) * inputT;
      destX = THREE_CLAMP(this._smoothNy * 0.62 * s * this._staticLookMul('inputMul'), -0.72 * s, 0.72 * s);
      destY = THREE_CLAMP(this._smoothNx * 1.12 * s * this._staticLookMul('inputMul'), -1.28 * s, 1.28 * s);
    } else {
      const inputT = 1 - Math.exp(-14 * delta);
      this._smoothNx += (0 - this._smoothNx) * inputT;
      this._smoothNy += (0 - this._smoothNy) * inputT;
    }

    this._lookTarget.x = destX;
    this._lookTarget.y = destY;

    const followSpeed = (this._pointerActive ? 22 : 16) * Math.sqrt(s) * this._staticLookMul('followMul');
    const followT = 1 - Math.exp(-followSpeed * delta);
    this._look.x += (this._lookTarget.x - this._look.x) * followT;
    this._look.y += (this._lookTarget.y - this._look.y) * followT;

    if (!this._pointerActive) {
      if (this._usesSkeleton) {
        this._idleDriftPhase += delta * (this._typingEnergy > 0.05 ? 0.16 : 0.24);
      } else if (this._isUnifiedStatic() && this._typingEnergy <= 0.05) {
        this._idleDriftPhase += delta * 0.24;
      }
    }

    const HEAD_SHARE = this._usesSkeleton ? 0.88 : 1.35;
    const HEAD_PITCH_BOOST = this._usesSkeleton ? 1.05 : 1.28;
    const bodyMul = this._staticLookMul('bodyMul');
    const bodyX = this._look.x * 0.12 * bodyMul + (this._usesSkeleton ? 0 : this._bodyBump.x);
    const bodyY = this._look.y * 0.12 * bodyMul + (this._usesSkeleton ? 0 : this._bodyBump.y);

    let idleHeadX = 0;
    let idleHeadY = 0;
    if (this._usesSkeleton && !this._pointerActive) {
      const p = this._idleDriftPhase;
      const driftMul = this._typingEnergy > 0.05 ? 0.55 : 1;
      idleHeadY = (Math.sin(p * 0.36 + 0.4) * 0.05 + Math.sin(p * 0.18 + 1.6) * 0.02) * this._lookHeadSens * driftMul;
      idleHeadX = Math.sin(p * 0.28 + 1.0) * 0.03 * this._lookHeadSens * driftMul;
    } else if (this._isUnifiedStatic() && !this._pointerActive && this._typingEnergy <= 0.05) {
      const life = this._staticLifeCfg();
      const amp = life.idleHeadAmp ?? 0.034;
      const p = this._idleDriftPhase;
      idleHeadY = (Math.sin(p * 0.34 + 0.5) * amp + Math.sin(p * 0.17 + 1.4) * amp * 0.35) * this._lookHeadSens;
      idleHeadX = Math.sin(p * 0.26 + 0.9) * amp * 0.65 * this._lookHeadSens;
    }

    let totalHeadX = this._look.x * HEAD_SHARE * HEAD_PITCH_BOOST * this._lookHeadSens + this._headBump.x + idleHeadX;
    let totalHeadY = this._look.y * HEAD_SHARE * this._lookHeadSens + this._headBump.y + idleHeadY;
    if (!this._usesSkeleton) {
      const hm = this._staticLookMul('headMul');
      totalHeadX *= hm;
      totalHeadY *= hm;
    }

    const headFollowMul = this._staticLookMul('followMul');
    const headT = 1 - Math.exp(-(this._pointerActive ? 28 : 18) * Math.sqrt(s) * headFollowMul * delta);
    this._headLook.x += (totalHeadX - this._headLook.x) * headT;
    this._headLook.y += (totalHeadY - this._headLook.y) * headT;

    if (this._usesSkeleton) {
      const usePoseBody = this.skeletalRig?.hasLookBodyPose?.();
      let bodyTargetX;
      let bodyTargetY;
      let handTargetX;
      let handTargetY;

      if (!this._pointerActive && this._typingEnergy <= 0.05) {
        const p = this._idleDriftPhase;
        bodyTargetY = (Math.sin(p * 0.4) * 0.13 + Math.sin(p * 0.19 + 1.3) * 0.06) * this._lookBodySens;
        bodyTargetX = Math.sin(p * 0.31 + 0.7) * 0.045 * this._lookBodySens;
        handTargetY = (Math.sin(p * 0.46 + 0.85) * 0.15 + Math.sin(p * 0.22 + 2.1) * 0.05) * this._lookHandSens;
        handTargetX = Math.sin(p * 0.35 + 1.4) * 0.04 * this._lookHandSens;
      } else if (this._typingEnergy > 0.05 && !this._pointerActive) {
        const tScale = 0.52;
        const bodyFollow = usePoseBody ? 0.55 : 0.34;
        bodyTargetX = totalHeadX * bodyFollow * this._lookBodySens * tScale;
        bodyTargetY = totalHeadY * bodyFollow * this._lookBodySens * tScale;
        handTargetX = bodyTargetX;
        handTargetY = bodyTargetY;
        const p = this._idleDriftPhase;
        bodyTargetY += (Math.sin(p * 0.38) * 0.06 + Math.sin(p * 0.2 + 1.1) * 0.03) * this._lookBodySens;
        handTargetY += (Math.sin(p * 0.44 + 0.6) * 0.08) * this._lookHandSens;
      } else {
        const bodyFollow = usePoseBody ? 0.62 : 0.38;
        bodyTargetX = totalHeadX * bodyFollow * this._lookBodySens;
        bodyTargetY = totalHeadY * bodyFollow * this._lookBodySens;
        handTargetX = bodyTargetX;
        handTargetY = bodyTargetY;
      }

      const bodySpeed = (this._pointerActive ? 4.2 : (this._typingEnergy > 0.05 ? 1.45 : 1.15)) * Math.sqrt(s);
      const bodyT = 1 - Math.exp(-bodySpeed * delta);
      this._bodyLook.x += (bodyTargetX - this._bodyLook.x) * bodyT;
      this._bodyLook.y += (bodyTargetY - this._bodyLook.y) * bodyT;

      const handSpeed = (this._pointerActive ? 2.0 : (this._typingEnergy > 0.05 ? 1.35 : 0.95)) * Math.sqrt(s);
      const handT = 1 - Math.exp(-handSpeed * delta);
      this._handLook.x += (handTargetX - this._handLook.x) * handT;
      this._handLook.y += (handTargetY - this._handLook.y) * handT;

      if (usePoseBody) {
        const groupRot = this.skeletalRig.getLookGroupBodyRotation(this._bodyLook.x, this._bodyLook.y);
        this.lookGroup.rotation.x = groupRot.x;
        this.lookGroup.rotation.y = groupRot.y;
      } else {
        this.lookGroup.rotation.x = this._bodyLook.x;
        this.lookGroup.rotation.y = this._bodyLook.y;
      }
      this.lookGroup.rotation.z = 0;
    } else {
      this.lookGroup.rotation.x = bodyX;
      this.lookGroup.rotation.y = bodyY;
    }

    if (this.headBodyRig?.mode === 'parts' && this.headTarget) {
      this.headTarget.rotation.x = this._headLook.x;
      this.headTarget.rotation.y = this._headLook.y;
    } else if (this.headBodyRig?.mode === 'unified') {
      const look = this.modelLoader?._profile?.look ?? {};
      const rx = look.groupBodyX ?? 0.2;
      const ry = look.groupBodyY ?? 0.48;
      const gm = this._staticLookMul('groupRotMul');
      this.lookGroup.rotation.x = this._headLook.x * (rx / 1.28) * gm + this._bodyBump.x + this._headBump.x;
      this.lookGroup.rotation.y = this._headLook.y * (ry / 1.35) * gm + this._bodyBump.y + this._headBump.y;
    }

    if (!this._usesSkeleton) {
      if (this._pointerActive) {
        const decay = 1 - Math.min(1, 10 * delta);
        this._bodyBump.z *= decay;
        this.lookGroup.rotation.z = this._bodyBump.z + this._idleSwayZ;
      } else {
        this.lookGroup.rotation.z = this._bodyBump.z + this._idleSwayZ;
      }
      this._applyNonSkeletonGroupPose();
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
        handX: this._handLook.x,
        handY: this._handLook.y,
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
    const BODY = 0.16 * this._staticLookMul('bodyMul');
    const visualX = this._look.x * BODY + this._headLook.x + this._headBump.x;
    const visualY = this._look.y * BODY + this._headLook.y + this._headBump.y;
    return {
      x: visualX,
      y: visualY,
      sensitivity: this._lookSensitivity,
    };
  }

  resetLook() {
    this._killAction();
    this.clearPointer();
    this._lookTarget.x = 0;
    this._lookTarget.y = 0;
    this._look.x = 0;
    this._look.y = 0;
    this._headLook.x = 0;
    this._headLook.y = 0;
    this._bodyLook.x = 0;
    this._bodyLook.y = 0;
    this._headBump.x = 0;
    this._headBump.y = 0;
    this._bodyBump.x = 0;
    this._bodyBump.y = 0;
    this._bodyBump.z = 0;
    this._smoothNx = 0;
    this._smoothNy = 0;
    this._bodySwayPhase = 0;
    this._handLook = { x: 0, y: 0 };
    this._typingEnergy = 0;
    this._idleBreathOffset = 0;
    this._idleSwayZ = 0;
    this._resetActionPose();
    this.lookGroup.rotation.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.group.position.y = this._baseY;
    this.skeletalRig?.resetPose?.();
    this.skeletalRig?.clearGestureHeadSnapshot?.();
    this.headBodyRig?.resetHeadPose?.();
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
    if (!this._usesSkeleton) {
      this._resetActionPose();
    }
  }

  isBodyGesturePlaying() {
    return !!(this._actionTl?.isActive?.());
  }

  queueBodyGesture(_name, factory) {
    this._pendingBodyGesture = factory;
    return true;
  }

  _flushBodyGestureQueue() {
    if (!this._pendingBodyGesture) return;
    const factory = this._pendingBodyGesture;
    this._pendingBodyGesture = null;
    if (this.isBodyGesturePlaying()) return;
    factory?.();
  }

  _runBodyGesture(factory) {
    if (this.isBodyGesturePlaying()) {
      this._pendingBodyGesture = factory;
      return null;
    }
    this._killAction();
    const tl = factory();
    if (tl?.eventCallback) {
      tl.eventCallback('onComplete', () => this._flushBodyGestureQueue());
    }
    this._actionTl = tl;
    return tl;
  }

  startIdleBreath() {
    this._breathTween?.kill();
    this._swayTween?.kill();
    this._breathTween = null;
    this._swayTween = null;
    if (this._usesSkeleton || !this._isUnifiedStatic()) return;

    const life = this._staticLifeCfg();
    const breathAmp = life.breathAmp ?? 0.011;
    const breathPeriod = life.breathPeriod ?? 2.9;
    const swayAmp = life.swayAmp ?? 0.007;
    const swayPeriod = life.swayPeriod ?? 3.8;

    this._idleBreathOffset = 0;
    this._idleSwayZ = 0;
    this._breathTween = gsap.to(this, {
      _idleBreathOffset: breathAmp,
      duration: breathPeriod,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    this._swayTween = gsap.to(this, {
      _idleSwayZ: swayAmp,
      duration: swayPeriod,
      repeat: -1,
      yoyo: true,
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
    gsap.to(this._actionPose, {
      posY: 0,
      duration: 0.3,
      overwrite: 'auto',
    });
    gsap.to(this._actionPose, {
      z: 0,
      duration: 0.3,
      overwrite: 'auto',
    });
  }

  getLookNorm() {
    return { nx: this._smoothNx, ny: this._smoothNy };
  }

  setTypingEnergy(level) {
    this._typingEnergy = Math.max(0, Math.min(1, level));
  }

  /** 打字时不叠加任何头部/身体敲击动画；绑骨模式完全关闭 */
  playKeyStrike(side = 'center', intensity = 0.6) {
    if (this._typingEnergy > 0.05 || this._usesSkeleton) return;
    if (
      this.modelLoader?.isHeadGestureActive?.()
      || this.modelLoader?.isGestureBlocking?.()
      || this.isBodyGesturePlaying?.()
    ) {
      return;
    }
    this._lastStrikeSide = side;
    const i = Math.min(1, intensity) * 0.4;
    const nod = 0.008 + i * 0.018;
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

    const posTarget = this._animPosTarget();
    const posKey = this._animPosKey();
    gsap.to(posTarget, {
      [posKey]: this._animPosBase() - 0.0025 * i,
      duration: 0.05,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
    });
  }

  playTyping(_intensity = 1) {
    /* 打字动画已关闭 */
  }

  playGeneric(_intensity = 0.5) {
    /* 打字动画已关闭 */
  }

  playFunction(intensity = 1) {
    if (this._usesSkeleton) return;
    const posTarget = this._animPosTarget();
    const posKey = this._animPosKey();
    const rot = this._animRot();
    gsap.to(posTarget, {
      [posKey]: this._animPosBase() + 0.05 * intensity,
      duration: 0.1,
      yoyo: true,
      repeat: 1,
      ease: 'power2.out',
      overwrite: 'auto',
    });
    gsap.to(rot, {
      y: 0.07 * intensity,
      duration: 0.12,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(rot, { y: 0, duration: 0.15, ease: 'sine.inOut' });
      },
    });
  }

  playNumpad() {
    if (this._typingEnergy > 0.05) return;
    if (this._usesSkeleton) return;
    gsap.to(this._animRot(), {
      z: 0.05,
      duration: 0.06,
      yoyo: true,
      repeat: 1,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this._animRot(), { z: 0, duration: 0.12 });
      },
    });
  }

  playSpaceSway(intensity = 0.7) {
    if (this._usesSkeleton) return null;
    const i = Math.min(1, intensity);
    return this._runBodyGesture(() => {
      const tl = gsap.timeline();
      tl
        .to(this._bodyBump, { z: 0.028 * i, duration: 0.07, ease: 'sine.out' })
        .to(this._bodyBump, { z: -0.028 * i, duration: 0.1, ease: 'sine.inOut' })
        .to(this._bodyBump, { z: 0.014 * i, duration: 0.08, ease: 'sine.inOut' })
        .to(this._bodyBump, { z: 0, duration: 0.1, ease: 'sine.in' });
      return tl;
    });
  }

  playJump() {
    this._killAction();
    if (!this._usesSkeleton) this.stopIdleBreath();
    const posTarget = this._animPosTarget();
    const posKey = this._animPosKey();
    const base = this._animPosBase();
    this._actionTl = gsap.timeline({
      onComplete: () => {
        if (!this._usesSkeleton) {
          this._actionPose.posY = 0;
          this.startIdleBreath();
        }
      },
    });
    this._actionTl
      .to(posTarget, { [posKey]: base + 0.14, duration: 0.16, ease: 'power2.out' })
      .to(posTarget, { [posKey]: base, duration: 0.3, ease: 'bounce.out' });
    return this._actionTl;
  }

  playLean(dir) {
    if (this._usesSkeleton) return;
    gsap.to(this._animRot(), {
      x: dir.y * 0.32,
      y: dir.x * 0.22,
      duration: 0.18,
      ease: 'sine.out',
      overwrite: 'auto',
    });
  }

  resetLean(duration = 0.35) {
    if (this._usesSkeleton) return;
    gsap.to(this._animRot(), {
      x: 0,
      y: 0,
      duration,
      ease: 'sine.inOut',
      overwrite: 'auto',
    });
  }

  playNod() {
    return this._runBodyGesture(() => {
      if (this.headTarget || this._usesSkeleton) {
        const tl = gsap.timeline();
        tl
          .to(this._headBump, { x: 0.08, duration: 0.11, ease: 'sine.out' })
          .to(this._headBump, { x: 0, duration: 0.2, ease: 'sine.in' });
        return tl;
      }
      const tl = gsap.timeline();
      tl
        .to(this._animRot(), { x: 0.08, duration: 0.1, ease: 'sine.out' })
        .to(this._animRot(), { x: 0, duration: 0.18, ease: 'sine.in' });
      return tl;
    });
  }

  playSurprised() {
    if (this._usesSkeleton) return;
    gsap.fromTo(
      this.group.scale,
      { z: 1.02 },
      { z: 1, duration: 0.12, ease: 'sine.out', overwrite: 'auto' }
    );
    gsap.to(this._animRot(), {
      z: 0.06,
      duration: 0.07,
      yoyo: true,
      repeat: 3,
      ease: 'sine.inOut',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this._animRot(), { z: 0, duration: 0.15 });
      },
    });
  }

  playFocus() {
    if (this._usesSkeleton) return;
    gsap.to(this._animRot(), {
      x: 0.05,
      duration: 0.22,
      ease: 'sine.out',
      overwrite: 'auto',
      onComplete: () => {
        gsap.to(this._animRot(), { x: 0, duration: 0.35, ease: 'sine.inOut' });
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

  playHeadTurnLeft() {
    return this._runBodyGesture(() => {
      const tl = gsap.timeline();
      if (this._isUnifiedStatic()) {
        tl.to(this._headBump, { y: 0.28, duration: 0.22, ease: 'sine.out' })
          .to(this._headBump, { y: 0, duration: 0.38, ease: 'sine.inOut' });
      } else {
        tl.to(this._headBump, { y: 0.24, duration: 0.22, ease: 'sine.out' })
          .to(this._headBump, { y: 0, duration: 0.38, ease: 'sine.inOut' });
      }
      return tl;
    });
  }

  playHeadTurnRight() {
    return this._runBodyGesture(() => {
      const tl = gsap.timeline();
      if (this._isUnifiedStatic()) {
        tl.to(this._headBump, { y: -0.28, duration: 0.22, ease: 'sine.out' })
          .to(this._headBump, { y: 0, duration: 0.38, ease: 'sine.inOut' });
      } else {
        tl.to(this._headBump, { y: -0.24, duration: 0.22, ease: 'sine.out' })
          .to(this._headBump, { y: 0, duration: 0.38, ease: 'sine.inOut' });
      }
      return tl;
    });
  }

  playWave() {
    return this._runBodyGesture(() => {
      const rot = this._animRot();
      const tl = gsap.timeline();
      tl
        .to(rot, { z: 0.12, duration: 0.18, ease: 'sine.out' })
        .to(rot, { z: -0.06, duration: 0.22, ease: 'sine.inOut' })
        .to(rot, { z: 0, duration: 0.2, ease: 'sine.in' });
      return tl;
    });
  }

  playShake() {
    this._killAction();
    if (!this._usesSkeleton) this.stopIdleBreath();
    const rot = this._animRot();
    this._actionTl = gsap.timeline({
      onComplete: () => {
        if (!this._usesSkeleton) this._actionPose.z = 0;
        else this.group.rotation.z = 0;
        if (!this._usesSkeleton) this.startIdleBreath();
      },
    });
    this._actionTl
      .to(rot, { z: 0.13, duration: 0.07, ease: 'sine.out' })
      .to(rot, { z: -0.13, duration: 0.09, ease: 'sine.inOut', repeat: 3, yoyo: true })
      .to(rot, { z: 0, duration: 0.1, ease: 'sine.in' });
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
    this._killAction();
    const duration = this._usesSkeleton ? 1.5 : 0.85;
    if (!this._usesSkeleton) {
      this.stopIdleBreath();
    }
    const rot = this._animRot();
    const startY = this._usesSkeleton ? this.group.rotation.y : this._actionPose.y;
    this._actionTl = gsap.to(rot, {
      y: startY + Math.PI * 2,
      duration,
      ease: 'power2.inOut',
      overwrite: 'auto',
      onComplete: () => {
        if (this._usesSkeleton) {
          this.group.rotation.y = 0;
        } else {
          this._actionPose.y = 0;
          this.startIdleBreath();
        }
      },
    });
    return this._actionTl;
  }

  lookAt(screenX, screenY, width, height) {
    this.setPointer(screenX, screenY, width, height);
  }

  lookAtNorm(nx, ny) {
    this.setLookDirection(nx, ny);
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
