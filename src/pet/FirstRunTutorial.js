import gsap from 'gsap';

const STEPS = [
  {
    icon: 'drag',
    title: '左键拖动',
    desc: '按住模型，把她拖到桌面任意位置。',
  },
  {
    icon: 'resize',
    title: '右键缩放',
    desc: '按住右键左右滑动，调整窗口大小。',
  },
  {
    icon: 'tap',
    title: '点击互动',
    desc: '单击戳一下 · 双击挥手 · 三击转圈。',
  },
  {
    icon: 'menu',
    title: '右键菜单',
    desc: '右键轻点（不要拖动）打开快捷菜单。',
  },
  {
    icon: 'panel',
    title: '控制中心',
    desc: '任务栏托盘找到模型图标，点「✦ 控制中心」。',
  },
];

/** 首次使用 · 隐蔽入口 + 动画教程 */
export class FirstRunTutorial {
  constructor({ root, onComplete, onOpenChange }) {
    this.root = root;
    this.onComplete = onComplete;
    this.onOpenChange = onOpenChange;
    this._step = 0;
    this._open = false;
    this._mount();
  }

  _mount() {
    const el = document.createElement('div');
    el.id = 'first-tutorial';
    el.className = 'first-tutorial';
    el.setAttribute('data-ui-overlay', '');
    el.innerHTML = `
      <div class="ft-backdrop" data-tutorial-backdrop hidden aria-hidden="true"></div>
      <button type="button" class="first-tutorial-seed" data-tutorial-seed aria-label="使用提示">
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

    this.seed?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._openPanel();
    });
    this.nextBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._next();
    });
    this.skipBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._finish();
    });

    gsap.to(this.seed?.querySelector('.first-tutorial-seed-ring'), {
      scale: 1.8,
      opacity: 0,
      duration: 2.4,
      repeat: -1,
      ease: 'sine.out',
    });
  }

  start() {
    this.el.hidden = false;
    gsap.fromTo(this.seed, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 2.5, ease: 'power2.out' });
  }

  /** 测试/预览：直接打开完整教程面板 */
  preview() {
    this.el.hidden = false;
    gsap.set(this.seed, { opacity: 0, pointerEvents: 'none' });
    this._open = false;
    this._openPanel();
    gsap.fromTo(this.el, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power2.out' });
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
    if (icon === 'resize') {
      return `<div class="ft-anim ft-anim--resize"><span class="ft-frame"></span><span class="ft-hand ft-hand--right"></span><span class="ft-arrow ft-arrow--l"></span><span class="ft-arrow ft-arrow--r"></span></div>`;
    }
    if (icon === 'tap') {
      return `<div class="ft-anim ft-anim--tap"><span class="ft-tap ft-tap--1">1</span><span class="ft-tap ft-tap--2">2</span><span class="ft-tap ft-tap--3">3</span></div>`;
    }
    if (icon === 'menu') {
      return `<div class="ft-anim ft-anim--menu"><span class="ft-hand ft-hand--right"></span><span class="ft-menu-card"></span></div>`;
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
    } else if (icon === 'resize') {
      const frame = this.stage.querySelector('.ft-frame');
      const hand = this.stage.querySelector('.ft-hand--right');
      gsap.timeline({ repeat: -1 })
        .to(hand, { x: 22, duration: 0.7, ease: 'power1.inOut' })
        .to(frame, { scaleX: 1.18, duration: 0.7, ease: 'power1.inOut' }, 0)
        .to(hand, { x: -22, duration: 0.7, ease: 'power1.inOut' })
        .to(frame, { scaleX: 0.88, duration: 0.7, ease: 'power1.inOut' }, '-=0.7');
    } else if (icon === 'tap') {
      ['.ft-tap--1', '.ft-tap--2', '.ft-tap--3'].forEach((sel, i) => {
        gsap.to(this.stage.querySelector(sel), {
          scale: 1.15,
          opacity: 1,
          duration: 0.25,
          repeat: -1,
          yoyo: true,
          delay: i * 0.35,
          ease: 'power1.inOut',
        });
      });
    } else if (icon === 'menu') {
      gsap.timeline({ repeat: -1 })
        .fromTo(this.stage.querySelector('.ft-menu-card'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' })
        .to(this.stage.querySelector('.ft-menu-card'), { opacity: 0, y: 6, duration: 0.35, delay: 0.8, ease: 'power2.in' });
    } else {
      gsap.fromTo(this.stage.querySelector('.ft-tray-menu'), { opacity: 0.4, y: 4 }, { opacity: 1, y: 0, duration: 0.6, repeat: -1, yoyo: true, ease: 'sine.inOut' });
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
    this._setOpenState(false);
    this.panel?.removeEventListener('pointerdown', this._stopPanelBubble);
    this.panel?.removeEventListener('mousedown', this._stopPanelBubble);
    gsap.killTweensOf(this.el?.querySelectorAll('*') ?? []);
    this.el?.remove();
  }
}
