import gsap from 'gsap';
import { BIRTHDAY } from './birthdayConfig.js';

/**
 * 生日当天首次启动 · 祝福动画 + 礼盒开箱 + 模型登场
 */
export class BirthdayIntro {
  constructor({ root, canvas, fx }) {
    this.root = root;
    this.canvas = canvas;
    this.fx = fx;
    this.el = null;
    this._tl = null;
    this._resolve = null;
    this._done = false;
  }

  mount() {
    const wishLines = BIRTHDAY.wishes
      .map((line) => `<p class="bi-wish-line">${line}</p>`)
      .join('');

    const el = document.createElement('div');
    el.id = 'birthday-intro';
    el.className = 'birthday-intro';
    el.setAttribute('data-ui-overlay', '');
    el.innerHTML = `
      <div class="bi-aurora" aria-hidden="true"></div>
      <div class="bi-hearts" aria-hidden="true"></div>
      <div class="bi-sparkles" aria-hidden="true"></div>
      <div class="bi-copy">
        <div class="bi-letter">
          <div class="bi-letter-edge" aria-hidden="true"></div>
          <p class="bi-eyebrow">${BIRTHDAY.month} 月 ${BIRTHDAY.day} 日 · 特别的一天</p>
          <p class="bi-dear">Dear <span class="bi-name">${BIRTHDAY.recipient}</span></p>
          <h1 class="bi-title">生日快乐</h1>
          <div class="bi-wish">${wishLines}</div>
          <div class="bi-sign">
            <span class="bi-seal" aria-hidden="true">✦</span>
            <p class="bi-from">— ${BIRTHDAY.creator}</p>
          </div>
        </div>
      </div>
      <div class="bi-stage">
        <div class="bi-gift-wrap" data-bi-gift-wrap>
          <div class="bi-gift-glow"></div>
          <button type="button" class="bi-open-gift" data-bi-open hidden>
            <span class="bi-open-gift-ring" aria-hidden="true"></span>
            <span class="bi-open-gift-icon">🎁</span>
            <span class="bi-open-gift-text">轻触打开礼物</span>
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
          </div>
        </div>
      </div>
      <button type="button" class="bi-skip" data-bi-skip hidden>轻触跳过</button>
    `;
    this.root.appendChild(el);
    this.el = el;
    this._sparklesEl = el.querySelector('.bi-sparkles');
    this._heartsEl = el.querySelector('.bi-hearts');
    this._spawnSparkles(28);
    this._spawnHearts(8);

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
      this._heartsEl.appendChild(h);
    }
  }

  _enterGiftWaitGate() {
    if (this._giftGateDone || this._done) return;
    this._tl?.pause();
    if (this._openBtn) {
      this._openBtn.hidden = false;
      gsap.fromTo(this._openBtn, { opacity: 0, scale: 0.88, y: 8 }, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: 'back.out(1.5)' });
    }
    this._giftWrap?.classList.add('is-waiting');
    gsap.to(this._giftWrap?.querySelector('.bi-gift-glow'), {
      opacity: 0.95,
      scale: 1.22,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  _resumeGiftOpen() {
    if (this._giftGateDone || this._done) return;
    this._giftGateDone = true;
    gsap.killTweensOf(this._giftWrap?.querySelector('.bi-gift-glow'));
    if (this._openBtn) {
      gsap.to(this._openBtn, {
        opacity: 0,
        scale: 0.92,
        duration: 0.28,
        onComplete: () => {
          this._openBtn.hidden = true;
        },
      });
    }
    this._giftWrap?.classList.remove('is-waiting');
    this.fx?.burstConfetti?.({ count: 24, duration: 1.6 });
    this._tl?.play();
  }

  play() {
    return new Promise((resolve) => {
      this._resolve = resolve;
      this._done = false;
      this._giftGateDone = false;
      const copy = this.el.querySelector('.bi-copy');
      const letter = this.el.querySelector('.bi-letter');
      const stage = this.el.querySelector('.bi-stage');
      const gift = this.el.querySelector('.bi-gift');
      const lid = this.el.querySelector('.bi-gift-lid');
      const glow = this.el.querySelector('.bi-gift-glow');
      const burst = this.el.querySelector('.bi-gift-burst');
      const skip = this.el.querySelector('[data-bi-skip]');
      const wishLines = this.el.querySelectorAll('.bi-wish-line');

      gsap.set(this.el, { opacity: 0 });
      gsap.set([copy, stage], { opacity: 0 });
      gsap.set(letter, { y: 24, scale: 0.96, rotateX: 8 });
      gsap.set(gift, { y: 40, scale: 0.82 });
      gsap.set(this.canvas, {
        opacity: 0,
        scale: 0.08,
        y: 48,
        transformOrigin: '50% 88%',
        filter: 'brightness(1.35) saturate(1.1)',
      });

      this._tl = gsap.timeline({
        onComplete: () => this._finish(false),
      });

      this._tl
        .to(this.el, { opacity: 1, duration: 0.9, ease: 'power2.out' })
        .to(copy, { opacity: 1, duration: 0.65, ease: 'power2.out' }, 0.15)
        .to(letter, { y: 0, scale: 1, rotateX: 0, duration: 0.85, ease: 'back.out(1.4)' }, 0.25)
        .fromTo(
          this.el.querySelector('.bi-eyebrow'),
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, ease: 'power2.out' },
          0.45,
        )
        .fromTo(
          this.el.querySelector('.bi-dear'),
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' },
          0.65,
        )
        .fromTo(
          this.el.querySelector('.bi-title'),
          { y: 32, opacity: 0, scale: 0.86 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: 'back.out(1.65)' },
          0.85,
        )
        .fromTo(
          wishLines,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, stagger: 0.18, ease: 'power2.out' },
          1.25,
        )
        .fromTo(
          this.el.querySelector('.bi-sign'),
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' },
          1.95,
        )
        .call(() => this.fx?.burstConfetti?.({ count: 56, duration: 3.4 }), null, 2.05)
        .to(stage, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 2.45)
        .to(gift, { y: 0, scale: 1, duration: 1.15, ease: 'back.out(1.35)' }, 2.5)
        .to(glow, { opacity: 0.9, scale: 1.18, duration: 0.85, ease: 'sine.inOut' }, 2.75)
        .call(() => this._enterGiftWaitGate(), null, 3.55)
        .to(lid, { rotateX: -118, y: -6, duration: 0.9, ease: 'power3.inOut' }, 3.65)
        .to(burst, { opacity: 1, scale: 1.65, duration: 0.38, ease: 'power2.out' }, 3.85)
        .to(burst, { opacity: 0, scale: 2.3, duration: 0.55, ease: 'power2.in' }, 4.25)
        .call(() => this.fx?.burstConfetti?.({ count: 80, duration: 3.8 }), null, 3.9)
        .to(
          this.canvas,
          {
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1.4,
            ease: 'power3.out',
          },
          3.95,
        )
        .to(
          this.canvas,
          { filter: 'brightness(1) saturate(1)', duration: 1.2, ease: 'power2.out' },
          3.95,
        )
        .to(copy, { opacity: 0, y: -20, duration: 0.7, ease: 'power2.in' }, 4.85)
        .to(gift, { opacity: 0, y: 30, scale: 0.92, duration: 0.75, ease: 'power2.in' }, 4.9)
        .to(glow, { opacity: 0, duration: 0.5 }, 4.9)
        .to(this.el, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 5.55);

      window.setTimeout(() => {
        if (skip) skip.hidden = false;
        gsap.fromTo(skip, { opacity: 0 }, { opacity: 0.6, duration: 0.45 });
      }, 2800);
    });
  }

  _finish(skipped) {
    if (this._done) return;
    this._done = true;
    this._tl?.kill();
    gsap.killTweensOf([this.el, this.canvas]);
    gsap.set(this.canvas, {
      opacity: 1,
      scale: 1,
      y: 0,
      filter: 'none',
      clearProps: 'transform,filter',
    });
    if (this.el) {
      gsap.set(this.el, { opacity: 0, pointerEvents: 'none' });
    }
    if (skipped) this.fx?.burstConfetti?.({ count: 40, duration: 2.2 });
    this._resolve?.();
  }

  dispose() {
    this._tl?.kill();
    this._openBtn?.removeEventListener('click', this._onOpenGift);
    gsap.killTweensOf(this.el?.querySelectorAll('*') ?? []);
    this.el?.remove();
    this.el = null;
  }
}
