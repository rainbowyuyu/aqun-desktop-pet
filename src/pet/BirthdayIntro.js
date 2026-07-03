import gsap from 'gsap';
import { BIRTHDAY } from './birthdayConfig.js';

/**
 * 生日当天首次启动 · 信封祝福 + 礼盒开箱 + 模型登场
 */
const MODEL_REVEAL_DURATION = 4.2;
/** 登场旋转：正面 → 后背 → 正面（绕 Y 轴一整圈） */
const MODEL_SPIN_Y = Math.PI * 2;

export class BirthdayIntro {
  constructor({ root, canvas, fx, modelGroup = null }) {
    this.root = root;
    this.canvas = canvas;
    this.fx = fx;
    this.modelGroup = modelGroup;
    this.el = null;
    this._tl = null;
    this._resolve = null;
    this._done = false;
    this._modelRevealStarted = false;
    this._revealTl = null;
  }

  _prepareModelRevealStart() {
    if (!this.modelGroup) return;
    gsap.killTweensOf(this.modelGroup);
    gsap.killTweensOf(this.modelGroup.rotation);
    gsap.killTweensOf(this.modelGroup.scale);
    gsap.killTweensOf(this.modelGroup.position);
    this.modelGroup.rotation.set(0, 0, 0);
    this.modelGroup.scale.set(0.04, 0.04, 0.04);
    this.modelGroup.position.y = -0.35;
  }

  _hideBirthdayOverlay() {
    if (!this.el) return;
    const hide = (sel) => {
      const node = this.el.querySelector(sel);
      if (!node) return;
      gsap.killTweensOf(node);
      gsap.set(node, { opacity: 0, pointerEvents: 'none', display: 'none' });
    };
    hide('.bi-copy');
    hide('.bi-stage');
    hide('.bi-aurora');
    hide('.bi-bokeh');
    hide('.bi-petals');
    hide('.bi-hearts');
    hide('.bi-sparkles');
    hide('.bi-light-beam');
    hide('[data-bi-skip]');
    if (this._openBtn) {
      this._openBtn.hidden = true;
    }
    this._giftWrap?.classList.remove('is-waiting');
    gsap.killTweensOf(this.el);
    this.el.classList.add('is-dismissed');
    gsap.set(this.el, {
      opacity: 0,
      pointerEvents: 'none',
      visibility: 'hidden',
    });
  }

  _playModelReveal() {
    if (this._modelRevealStarted || this._done) return;
    this._modelRevealStarted = true;
    this._prepareModelRevealStart();

    const duration = MODEL_REVEAL_DURATION;
    this._revealTl?.kill();
    this._revealTl = gsap.timeline({
      onComplete: () => this._finish(false),
    });

    if (this.modelGroup) {
      this._revealTl
        .to(
          this.canvas,
          {
            opacity: 1,
            filter: 'brightness(1) saturate(1)',
            duration: duration * 0.35,
            ease: 'power2.out',
          },
          0,
        )
        .to(
          this.modelGroup.scale,
          { x: 1, y: 1, z: 1, duration, ease: 'power3.out' },
          0,
        )
        .to(
          this.modelGroup.position,
          { y: 0, duration, ease: 'power3.out' },
          0,
        )
        .to(
          this.modelGroup.rotation,
          { y: MODEL_SPIN_Y, duration, ease: 'power2.inOut' },
          0,
        );
    } else {
      this._revealTl.to(
        this.canvas,
        { opacity: 1, scale: 1, y: 0, duration, ease: 'power3.out' },
        0,
      );
    }
  }

  /** @deprecated 保留旧名，供 skip 等路径复用 */
  _prepareModelHidden() {
    this._prepareModelRevealStart();
  }

  _resetModelTransform() {
    if (!this.modelGroup) return;
    gsap.killTweensOf(this.modelGroup);
    gsap.killTweensOf(this.modelGroup.rotation);
    gsap.killTweensOf(this.modelGroup.scale);
    gsap.killTweensOf(this.modelGroup.position);
    this.modelGroup.rotation.set(0, 0, 0);
    this.modelGroup.scale.set(1, 1, 1);
    this.modelGroup.position.y = 0;
  }

  mount() {
    const wishLines = BIRTHDAY.wishes
      .map((line) => `<p class="bi-wish-line">${line}</p>`)
      .join('');
    const monthPad = String(BIRTHDAY.month).padStart(2, '0');
    const dayPad = String(BIRTHDAY.day).padStart(2, '0');

    const el = document.createElement('div');
    el.id = 'birthday-intro';
    el.className = 'birthday-intro';
    el.setAttribute('data-ui-overlay', '');
    el.innerHTML = `
      <div class="bi-aurora" aria-hidden="true"></div>
      <div class="bi-bokeh" aria-hidden="true"></div>
      <div class="bi-petals" aria-hidden="true"></div>
      <div class="bi-hearts" aria-hidden="true"></div>
      <div class="bi-sparkles" aria-hidden="true"></div>
      <div class="bi-light-beam" aria-hidden="true"></div>

      <div class="bi-copy">
        <div class="bi-envelope" data-bi-envelope>
          <div class="bi-envelope-shadow" aria-hidden="true"></div>
          <div class="bi-envelope-back"></div>
          <div class="bi-envelope-paper"></div>
          <div class="bi-envelope-flap">
            <div class="bi-envelope-flap-inner"></div>
          </div>
          <div class="bi-envelope-seal" aria-hidden="true">
            <span class="bi-envelope-seal-glow"></span>
            <span class="bi-envelope-seal-mark">✦</span>
          </div>
          <div class="bi-postmark" aria-hidden="true">
            <span class="bi-postmark-ring"></span>
            <span class="bi-postmark-date">${monthPad} · ${dayPad}</span>
            <span class="bi-postmark-label">BIRTHDAY</span>
          </div>
        </div>

        <div class="bi-letter" data-bi-letter hidden>
          <div class="bi-letter-glow" aria-hidden="true"></div>
          <div class="bi-letter-texture" aria-hidden="true"></div>
          <div class="bi-ribbon-corner bi-ribbon-corner--tl" aria-hidden="true"></div>
          <div class="bi-ribbon-corner bi-ribbon-corner--br" aria-hidden="true"></div>
          <div class="bi-wax-seal" aria-hidden="true">
            <span class="bi-wax-seal-mark">✦</span>
          </div>
          <div class="bi-letter-edge" aria-hidden="true"></div>
          <p class="bi-eyebrow">${BIRTHDAY.subtitle}</p>
          <p class="bi-dear">致 <span class="bi-name">${BIRTHDAY.recipient}</span></p>
          <h1 class="bi-title">生日快乐</h1>
          <p class="bi-title-en">${BIRTHDAY.titleEn}</p>
          <div class="bi-wish">${wishLines}</div>
          <p class="bi-closing">${BIRTHDAY.closing}</p>
          <div class="bi-sign">
            <div class="bi-sign-text">
              <p class="bi-from">— ${BIRTHDAY.creator}</p>
              <p class="bi-from-note">${BIRTHDAY.creatorNote}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="bi-stage">
        <div class="bi-gift-wrap" data-bi-gift-wrap>
          <div class="bi-gift-glow"></div>
          <div class="bi-gift-shimmer" aria-hidden="true"></div>
          <button type="button" class="bi-open-gift" data-bi-open hidden>
            <span class="bi-open-gift-ring" aria-hidden="true"></span>
            <span class="bi-open-gift-icon">🎁</span>
            <span class="bi-open-gift-text">${BIRTHDAY.openGiftLabel}</span>
          </button>
          <div class="bi-gift">
            <div class="bi-gift-lid">
              <div class="bi-gift-lid-top"></div>
              <div class="bi-gift-bow">
                <span class="bi-bow-loop bi-bow-loop--l"></span>
                <span class="bi-bow-loop bi-bow-loop--r"></span>
                <span class="bi-bow-knot"></span>
              </div>
            </div>
            <div class="bi-gift-body">
              <span class="bi-ribbon bi-ribbon--v"></span>
              <span class="bi-ribbon bi-ribbon--h"></span>
            </div>
            <div class="bi-gift-burst"></div>
            <div class="bi-gift-spark" aria-hidden="true"></div>
          </div>
        </div>
      </div>
      <button type="button" class="bi-skip" data-bi-skip hidden>${BIRTHDAY.skipLabel}</button>
    `;
    this.root.appendChild(el);
    this.el = el;
    this._sparklesEl = el.querySelector('.bi-sparkles');
    this._heartsEl = el.querySelector('.bi-hearts');
    this._petalsEl = el.querySelector('.bi-petals');
    this._bokehEl = el.querySelector('.bi-bokeh');
    this._spawnSparkles(32);
    this._spawnHearts(10);
    this._spawnPetals(14);
    this._spawnBokeh(6);

    const skip = el.querySelector('[data-bi-skip]');
    skip?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._finish(true);
    });
    this._openBtn = el.querySelector('[data-bi-open]');
    this._giftWrap = el.querySelector('[data-bi-gift-wrap]');
    this._onOpenGift = (e) => {
      e.stopPropagation();
      this._resumeGiftOpen();
    };
    this._openBtn?.addEventListener('click', this._onOpenGift);
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-bi-skip]')) return;
      e.stopPropagation();
    });
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('[data-bi-skip]')) return;
      e.stopPropagation();
    });
  }

  _spawnSparkles(count) {
    if (!this._sparklesEl) return;
    for (let i = 0; i < count; i += 1) {
      const s = document.createElement('span');
      s.className = 'bi-sparkle';
      s.style.left = `${8 + Math.random() * 84}%`;
      s.style.top = `${6 + Math.random() * 88}%`;
      s.style.animationDelay = `${Math.random() * 4}s`;
      s.style.animationDuration = `${2.2 + Math.random() * 2.5}s`;
      this._sparklesEl.appendChild(s);
    }
  }

  _spawnHearts(count) {
    if (!this._heartsEl) return;
    for (let i = 0; i < count; i += 1) {
      const h = document.createElement('span');
      h.className = 'bi-heart';
      h.textContent = '♥';
      h.style.left = `${6 + Math.random() * 88}%`;
      h.style.animationDelay = `${Math.random() * 5}s`;
      h.style.animationDuration = `${4.5 + Math.random() * 3}s`;
      h.style.fontSize = `${8 + Math.random() * 8}px`;
      h.style.setProperty('--drift', `${-20 + Math.random() * 40}px`);
      this._heartsEl.appendChild(h);
    }
  }

  _spawnPetals(count) {
    if (!this._petalsEl) return;
    for (let i = 0; i < count; i += 1) {
      const p = document.createElement('span');
      p.className = 'bi-petal';
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDelay = `${Math.random() * 6}s`;
      p.style.animationDuration = `${5 + Math.random() * 4}s`;
      p.style.setProperty('--drift', `${-30 + Math.random() * 60}px`);
      p.style.setProperty('--rot', `${Math.random() * 360}deg`);
      this._petalsEl.appendChild(p);
    }
  }

  _spawnBokeh(count) {
    if (!this._bokehEl) return;
    for (let i = 0; i < count; i += 1) {
      const b = document.createElement('span');
      b.className = 'bi-bokeh-dot';
      b.style.left = `${10 + Math.random() * 80}%`;
      b.style.top = `${8 + Math.random() * 75}%`;
      b.style.width = `${40 + Math.random() * 80}px`;
      b.style.height = b.style.width;
      b.style.animationDelay = `${Math.random() * 3}s`;
      this._bokehEl.appendChild(b);
    }
  }

  _enterGiftWaitGate() {
    if (this._giftGateDone || this._done) return;
    this._tl?.pause();
    if (this._openBtn) {
      this._openBtn.hidden = false;
      gsap.fromTo(
        this._openBtn,
        { opacity: 0, scale: 0.88, y: 10 },
        { opacity: 1, scale: 1, y: 0, duration: 0.6, ease: 'back.out(1.6)' },
      );
    }
    this._giftWrap?.classList.add('is-waiting');
    gsap.to(this._giftWrap?.querySelector('.bi-gift-glow'), {
      opacity: 0.95,
      scale: 1.28,
      duration: 1.4,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.to(this._giftWrap?.querySelector('.bi-gift-shimmer'), {
      opacity: 0.85,
      duration: 1.1,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  _resumeGiftOpen() {
    if (this._giftGateDone || this._done) return;
    this._giftGateDone = true;
    this._tl?.pause();
    gsap.killTweensOf([
      this._giftWrap?.querySelector('.bi-gift-glow'),
      this._giftWrap?.querySelector('.bi-gift-shimmer'),
      this._openBtn,
    ]);
    this._hideBirthdayOverlay();
    gsap.set(this.canvas, { opacity: 1, filter: 'brightness(1) saturate(1)' });
    this.fx?.burstConfetti?.({ count: 48, duration: 2.4 });
    this._playModelReveal();
  }

  play() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._done = false;
      this._giftGateDone = false;
      this._modelRevealStarted = false;

      const copy = this.el.querySelector('.bi-copy');
      const envelope = this.el.querySelector('[data-bi-envelope]');
      const letter = this.el.querySelector('[data-bi-letter]');
      const flap = this.el.querySelector('.bi-envelope-flap');
      const seal = this.el.querySelector('.bi-envelope-seal');
      const postmark = this.el.querySelector('.bi-postmark');
      const stage = this.el.querySelector('.bi-stage');
      const gift = this.el.querySelector('.bi-gift');
      const glow = this.el.querySelector('.bi-gift-glow');
      const lightBeam = this.el.querySelector('.bi-light-beam');
      const skip = this.el.querySelector('[data-bi-skip]');
      const wishLines = this.el.querySelectorAll('.bi-wish-line');
      const waxSeal = this.el.querySelector('.bi-wax-seal');

      gsap.set(this.el, { opacity: 0 });
      gsap.set([copy, stage], { opacity: 0 });
      gsap.set(envelope, { opacity: 0, scale: 0.86, y: 28 });
      gsap.set(letter, { opacity: 0, y: 18, scale: 0.92, rotateX: 12, xPercent: -50, left: '50%' });
      gsap.set(flap, { rotateX: 0 });
      gsap.set(seal, { scale: 1, opacity: 1 });
      gsap.set(postmark, { opacity: 0, scale: 0.8 });
      gsap.set(gift, { y: 48, scale: 0.78 });
      gsap.set(lightBeam, { opacity: 0, scaleY: 0.3 });
      gsap.set(this.canvas, {
        opacity: 0,
        scale: 1,
        y: 0,
        rotation: 0,
        filter: 'brightness(1.45) saturate(1.15)',
      });
      this._prepareModelRevealStart();

      this._tl = gsap.timeline();

      this._tl
        .to(this.el, { opacity: 1, duration: 1, ease: 'power2.out' })
        .to(copy, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 0.12)
        .to(envelope, { opacity: 1, scale: 1, y: 0, duration: 0.95, ease: 'back.out(1.5)' }, 0.25)
        .to(postmark, { opacity: 0.72, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }, 0.65)
        .to(seal, { scale: 1.1, duration: 0.55, repeat: 2, yoyo: true, ease: 'sine.inOut' }, 0.85)
        .to(seal, { opacity: 0, scale: 1.55, filter: 'blur(4px)', duration: 0.45, ease: 'power2.in' }, 2.05)
        .to(flap, { rotateX: -168, duration: 0.95, ease: 'power3.inOut' }, 2.1)
        .to(envelope, { y: 8, duration: 0.95, ease: 'power2.inOut' }, 2.1)
        .call(() => {
          letter.hidden = false;
        }, null, 2.55)
        .to(letter, { opacity: 1, y: -8, scale: 1, rotateX: 0, duration: 1, ease: 'power3.out' }, 2.55)
        .to(envelope, { opacity: 0, y: 36, scale: 0.92, duration: 0.55, ease: 'power2.in' }, 2.85)
        .call(() => {
          if (envelope) {
            envelope.style.visibility = 'hidden';
            envelope.style.pointerEvents = 'none';
          }
        }, null, 2.95)
        .fromTo(
          this.el.querySelector('.bi-eyebrow'),
          { y: 10, opacity: 0, letterSpacing: '0.32em' },
          { y: 0, opacity: 1, letterSpacing: '0.18em', duration: 0.6, ease: 'power2.out' },
          3.15,
        )
        .fromTo(
          this.el.querySelector('.bi-dear'),
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
          3.35,
        )
        .fromTo(
          waxSeal,
          { scale: 0.4, opacity: 0, rotate: -24 },
          { scale: 1, opacity: 1, rotate: 0, duration: 0.65, ease: 'back.out(2)' },
          3.45,
        )
        .fromTo(
          this.el.querySelector('.bi-title'),
          { y: 28, opacity: 0, scale: 0.88 },
          { y: 0, opacity: 1, scale: 1, duration: 0.85, ease: 'back.out(1.7)' },
          3.65,
        )
        .fromTo(
          this.el.querySelector('.bi-title-en'),
          { y: 8, opacity: 0 },
          { y: 0, opacity: 0.72, duration: 0.45, ease: 'power2.out' },
          3.95,
        )
        .fromTo(
          wishLines,
          { y: 14, opacity: 0, filter: 'blur(3px)' },
          { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.55, stagger: 0.22, ease: 'power2.out' },
          4.15,
        )
        .fromTo(
          this.el.querySelector('.bi-closing'),
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
          4.95,
        )
        .fromTo(
          this.el.querySelector('.bi-sign'),
          { opacity: 0, x: 12 },
          { opacity: 1, x: 0, duration: 0.55, ease: 'power2.out' },
          5.15,
        )
        .call(() => this.fx?.burstConfetti?.({ count: 48, duration: 3.2 }), null, 5.25)
        .to(stage, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 5.55)
        .to(gift, { y: 0, scale: 1, duration: 1.2, ease: 'back.out(1.4)' }, 5.6)
        .to(glow, { opacity: 0.88, scale: 1.2, duration: 0.9, ease: 'sine.inOut' }, 5.85)
        .to(lightBeam, { opacity: 0.55, scaleY: 1, duration: 0.85, ease: 'power2.out' }, 5.9)
        .call(() => this._enterGiftWaitGate(), null, 6.65);

      window.setTimeout(() => {
        if (skip) skip.hidden = false;
        gsap.fromTo(skip, { opacity: 0, y: 6 }, { opacity: 0.65, y: 0, duration: 0.5 });
      }, 3200);
    });
  }

  _finish(skipped) {
    if (this._done) return;
    this._done = true;
    this._tl?.kill();
    this._revealTl?.kill();
    gsap.killTweensOf([this.el, this.canvas]);
    this._resetModelTransform();
    gsap.set(this.canvas, {
      opacity: 1,
      scale: 1,
      y: 0,
      rotation: 0,
      filter: 'none',
      clearProps: 'transform,filter',
    });
    if (this.el) {
      gsap.killTweensOf(this.el.querySelectorAll('*'));
      this.el.remove();
      this.el = null;
    }
    if (skipped) this.fx?.burstConfetti?.({ count: 44, duration: 2.4 });
    this._resolve?.();
  }

  dispose() {
    this._tl?.kill();
    this._revealTl?.kill();
    this._openBtn?.removeEventListener('click', this._onOpenGift);
    if (this.el) {
      gsap.killTweensOf(this.el.querySelectorAll('*') ?? []);
      this.el.remove();
    }
    this.el = null;
  }
}
