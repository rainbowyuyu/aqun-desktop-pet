import gsap from 'gsap';

const STEPS = [
  {
    icon: 'drag',
    title: '左键拖动',
    desc: '按住模型，把她拖到桌面任意位置。',
  },
  {
    icon: 'panel',
    title: '右键打开控制面板',
    desc: '在模型上右键轻点（不要左右拖动），打开菜单后点「✦ 控制中心」。',
  },
  {
    icon: 'lock',
    title: '锁定窗口位置',
    desc: '在菜单或控制中心开启「锁定窗口位置」，模型就不会被误拖走。',
  },
  {
    icon: 'through',
    title: '鼠标穿透',
    desc: '开启「鼠标穿透」后，点击会穿过模型到达下方窗口；需要互动时再关掉即可。',
  },
  {
    icon: 'tray',
    title: '托盘小图标',
    desc: '穿透后点不到模型也没关系，任务栏右下角托盘区仍有模型小图标，右键可显示/隐藏、打开控制中心、切换穿透等。',
  },
];

/** 首次使用 · 动画教程（可自动弹出） */
export class FirstRunTutorial {
  constructor({ root, onComplete, onOpenChange }) {
    this.root = root;
    this.onComplete = onComplete;
    this.onOpenChange = onOpenChange;
    this._step = 0;
    this._open = false;
    this._autoOpenTimer = null;
    this._mount();
  }

  _mount() {
    const el = document.createElement('div');
    el.id = 'first-tutorial';
    el.className = 'first-tutorial';
    el.setAttribute('data-ui-overlay', '');
    el.innerHTML = `
      <div class="ft-backdrop" data-tutorial-backdrop hidden aria-hidden="true"></div>
      <button type="button" class="first-tutorial-seed" data-tutorial-seed aria-label="使用提示" hidden>
        <span class="first-tutorial-seed-core"></span>
        <span class="first-tutorial-seed-ring"></span>
      </button>
      <div class="first-tutorial-panel" data-tutorial-panel hidden>
        <div class="ft-panel-shine" aria-hidden="true"></div>
        <div class="ft-panel-head">
          <span class="ft-step-badge" data-tutorial-step-num>01 / 05</span>
          <div class="ft-progress" data-tutorial-progress></div>
        </div>
        <div class="first-tutorial-stage" data-tutorial-stage></div>
        <p class="first-tutorial-title" data-tutorial-title></p>
        <p class="first-tutorial-desc" data-tutorial-desc></p>
        <div class="first-tutorial-actions">
          <button type="button" class="first-tutorial-skip" data-tutorial-skip>跳过</button>
          <button type="button" class="first-tutorial-next" data-tutorial-next>
            <span data-tutorial-next-label>下一步</span>
            <span class="ft-next-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    `;
    this.root.appendChild(el);

    this.el = el;
    this.backdrop = el.querySelector('[data-tutorial-backdrop]');
    this.seed = el.querySelector('[data-tutorial-seed]');
    this.panel = el.querySelector('[data-tutorial-panel]');
    this.stage = el.querySelector('[data-tutorial-stage]');
    this.titleEl = el.querySelector('[data-tutorial-title]');
    this.descEl = el.querySelector('[data-tutorial-desc]');
    this.stepNumEl = el.querySelector('[data-tutorial-step-num]');
    this.progressEl = el.querySelector('[data-tutorial-progress]');
    this.nextBtn = el.querySelector('[data-tutorial-next]');
    this.nextLabel = el.querySelector('[data-tutorial-next-label]');
    this.skipBtn = el.querySelector('[data-tutorial-skip]');

    this.progressEl.innerHTML = STEPS.map((_, i) =>
      `<span class="ft-progress-seg${i === 0 ? ' is-active' : ''}"></span>`,
    ).join('');

    gsap.set(this.panel, { xPercent: -50, transformOrigin: '50% 100%' });

    this._stopPanelBubble = (e) => e.stopPropagation();
    this.panel?.addEventListener('pointerdown', this._stopPanelBubble);
    this.panel?.addEventListener('mousedown', this._stopPanelBubble);

    this.nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._next();
    });
    this.skipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._finish();
    });
  }

  /**
   * @param {{ autoOpenDelayMs?: number }} [options]
   */
  start({ autoOpenDelayMs = 4000 } = {}) {
    this.el.hidden = false;
    gsap.set(this.seed, { opacity: 0, pointerEvents: 'none', visibility: 'hidden' });
    this._autoOpenTimer = setTimeout(() => {
      this._autoOpenTimer = null;
      this._openPanel();
    }, Math.max(0, autoOpenDelayMs));
  }

  /** 测试/预览：直接打开完整教程面板 */
  preview() {
    this._clearAutoOpenTimer();
    this.el.hidden = false;
    gsap.set(this.seed, { opacity: 0, pointerEvents: 'none' });
    this._open = false;
    this._openPanel();
    gsap.fromTo(this.el, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
  }

  _clearAutoOpenTimer() {
    if (this._autoOpenTimer) {
      clearTimeout(this._autoOpenTimer);
      this._autoOpenTimer = null;
    }
  }

  _setOpenState(open) {
    this.el.classList.toggle('is-open', open);
    this.onOpenChange?.(open);
  }

  _openPanel() {
    if (this._open) return;
    this._open = true;
    this._setOpenState(true);
    this.seed.hidden = true;
    this.backdrop.hidden = false;
    this.panel.hidden = false;
    this._step = 0;
    this._renderStep(false);
    gsap.fromTo(this.backdrop, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
    gsap.fromTo(
      this.panel,
      { opacity: 0, y: 16, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.52, ease: 'back.out(1.35)' },
    );
  }

  _renderStep(animate = true) {
    const step = STEPS[this._step];
    this.titleEl.textContent = step.title;
    this.descEl.textContent = step.desc;
    this.stepNumEl.textContent = `${String(this._step + 1).padStart(2, '0')} / ${String(STEPS.length).padStart(2, '0')}`;
    this.nextLabel.textContent = this._step >= STEPS.length - 1 ? '开始吧' : '下一步';
    this.progressEl.querySelectorAll('.ft-progress-seg').forEach((seg, i) => {
      seg.classList.toggle('is-active', i === this._step);
      seg.classList.toggle('is-done', i < this._step);
    });
    this.stage.innerHTML = this._stageHtml(step.icon);
    if (animate) {
      gsap.fromTo(this.stage, { opacity: 0, x: 14 }, { opacity: 1, x: 0, duration: 0.38, ease: 'power2.out' });
      gsap.fromTo(this.titleEl, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.32, ease: 'power2.out' });
      gsap.fromTo(this.descEl, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.32, delay: 0.05, ease: 'power2.out' });
    }
    this._playStageAnim(step.icon);
  }

  _stageHtml(icon) {
    if (icon === 'drag') {
      return `<div class="ft-anim ft-anim--drag"><span class="ft-hand ft-hand--left"></span><span class="ft-cursor-path"></span><span class="ft-pet-dot"></span></div>`;
    }
    if (icon === 'panel') {
      return `<div class="ft-anim ft-anim--menu"><span class="ft-hand ft-hand--right"></span><span class="ft-menu-card">✦ 控制中心</span></div>`;
    }
    if (icon === 'lock') {
      return `<div class="ft-anim ft-anim--lock"><span class="ft-lock-body"></span><span class="ft-lock-shackle"></span><span class="ft-lock-label">锁定</span></div>`;
    }
    if (icon === 'through') {
      return `<div class="ft-anim ft-anim--through"><span class="ft-pet-dot ft-pet-dot--ghost"></span><span class="ft-through-cursor"></span></div>`;
    }
    if (icon === 'tray') {
      return `<div class="ft-anim ft-anim--tray"><span class="ft-tray"></span><span class="ft-tray-icon"></span><span class="ft-tray-tip">右键控制</span></div>`;
    }
    return `<div class="ft-anim ft-anim--panel"><span class="ft-tray"></span><span class="ft-tray-menu">✦ 控制中心</span></div>`;
  }

  _playStageAnim(icon) {
    gsap.killTweensOf(this.stage.querySelectorAll('*'));
    if (icon === 'drag') {
      const hand = this.stage.querySelector('.ft-hand--left');
      const dot = this.stage.querySelector('.ft-pet-dot');
      gsap.timeline({ repeat: -1 })
        .to(hand, { x: 36, y: -10, duration: 1.1, ease: 'power1.inOut' })
        .to(dot, { x: 36, y: -10, duration: 1.1, ease: 'power1.inOut' }, 0)
        .to(hand, { x: 0, y: 0, duration: 1.1, ease: 'power1.inOut' })
        .to(dot, { x: 0, y: 0, duration: 1.1, ease: 'power1.inOut' }, '-=1.1');
    } else if (icon === 'panel') {
      gsap.timeline({ repeat: -1 })
        .fromTo(this.stage.querySelector('.ft-menu-card'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
        .to(this.stage.querySelector('.ft-menu-card'), { opacity: 0, y: 6, duration: 0.35, delay: 0.8, ease: 'power2.in' });
    } else if (icon === 'lock') {
      const shackle = this.stage.querySelector('.ft-lock-shackle');
      gsap.timeline({ repeat: -1 })
        .to(shackle, { y: -4, duration: 0.45, ease: 'back.out(2)' })
        .to(shackle, { y: 0, duration: 0.35, ease: 'power2.in' })
        .to({}, { duration: 0.9 });
    } else if (icon === 'through') {
      const cursor = this.stage.querySelector('.ft-through-cursor');
      const dot = this.stage.querySelector('.ft-pet-dot');
      gsap.timeline({ repeat: -1 })
        .set(cursor, { opacity: 1, x: -28, y: 8 })
        .to(cursor, { x: 28, y: -8, duration: 1.2, ease: 'power1.inOut' })
        .to(dot, { opacity: 0.35, duration: 0.25 }, 0.35)
        .to(dot, { opacity: 1, duration: 0.25 }, 0.85)
        .to(cursor, { opacity: 0.4, duration: 0.3 }, '-=0.2');
    } else if (icon === 'tray') {
      const iconEl = this.stage.querySelector('.ft-tray-icon');
      const tip = this.stage.querySelector('.ft-tray-tip');
      gsap.timeline({ repeat: -1 })
        .fromTo(iconEl, { scale: 0.85, opacity: 0.55 }, { scale: 1.08, opacity: 1, duration: 0.55, ease: 'sine.inOut' })
        .to(iconEl, { scale: 0.92, opacity: 0.75, duration: 0.55, ease: 'sine.inOut' })
        .fromTo(tip, { opacity: 0.35, y: 2 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' }, 0)
        .to(tip, { opacity: 0.4, duration: 0.35, delay: 0.5 }, '-=0.2');
    }
  }

  _next() {
    if (this._step >= STEPS.length - 1) {
      this._finish();
      return;
    }
    this._step += 1;
    this._renderStep(true);
  }

  _finish() {
    this._clearAutoOpenTimer();
    this._setOpenState(false);
    gsap.to([this.panel, this.backdrop], {
      opacity: 0,
      duration: 0.32,
      ease: 'power2.in',
      onComplete: () => {
        this.panel.hidden = true;
        this.backdrop.hidden = true;
      },
    });
    gsap.to(this.el, {
      opacity: 0,
      duration: 0.35,
      delay: 0.08,
      onComplete: () => {
        this.el.hidden = true;
        this._open = false;
        this.onComplete?.();
      },
    });
  }

  dispose() {
    this._clearAutoOpenTimer();
    this._setOpenState(false);
    this.panel?.removeEventListener('pointerdown', this._stopPanelBubble);
    this.panel?.removeEventListener('mousedown', this._stopPanelBubble);
    gsap.killTweensOf(this.el?.querySelectorAll('*') ?? []);
    this.el?.remove();
  }
}
