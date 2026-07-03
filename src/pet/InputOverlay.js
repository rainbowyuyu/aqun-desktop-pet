import { KB_ROWS, resolveKeyId, buildKeyDomMap } from './keyboardLayout.js';

/** 键盘跟随人物视线的幅度系数（<1 减弱弧线/倾角） */
const KEYBOARD_FOLLOW_GAIN = 0.52;
/** 设计宽度：含键盘 + 鼠标 + 间距 */
const IO_DESIGN_W = 336;
/** 左右留白，留给阴影与 3D 透视 */
const IO_PAD = 40;
/** 低于此宽度启用窄窗样式（缩小鼠标，不隐藏） */
const IO_NARROW_W = 380;

function shadeHex(hex, amount) {
  const raw = String(hex || '#e07898').replace('#', '');
  if (raw.length < 6) return hex;
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(parseInt(raw.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(raw.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(raw.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** 人物前方的 3D 键盘 + 鼠标输入反馈 */
export class InputOverlay {
  constructor(container) {
    this.container = container;
    this._held = new Set();
    this._refCount = new Map();
    this._keyEls = new Map();
    this._visible = true;
    this._opacity = 0.88;
    this._keyPressColor = '#e07898';
    this._mount();
  }

  _mount() {
    const rowsHtml = KB_ROWS.map(
      (row, rowIdx) =>
        `<div class="io-kb-row${rowIdx === 0 ? ' io-kb-row--fn' : ''}">${row
          .map((k) => {
            const w = k.w ? ` style="flex:${k.w}"` : '';
            const alt = k.alt ? ` data-key-alt="${k.alt}"` : '';
            return `<span class="io-key" data-key-id="${k.id}"${alt}${w}><span class="io-key-face">${k.label || '␣'}</span></span>`;
          })
          .join('')}</div>`
    ).join('');

    this.container.innerHTML = `
      <div class="io-stage" data-io-stage>
        <div class="io-tilt" data-io-tilt>
          <div class="io-orbit" data-io-orbit>
            <div class="io-panel" data-io-root>
              <div class="io-keyboard-shell">
                <span class="io-keyboard-accent" aria-hidden="true"></span>
                <div class="io-keyboard">${rowsHtml}</div>
              </div>
              <div class="io-mouse-shell">
                <div class="io-mouse-wrap" aria-label="鼠标状态">
                  <svg class="io-mouse-svg" viewBox="0 0 56 80" aria-hidden="true">
                    <defs>
                      <linearGradient id="io-mouse-gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--io-mouse-top, rgba(255,252,252,0.94))" />
                        <stop offset="100%" stop-color="var(--io-mouse-bottom, rgba(240,248,252,0.88))" />
                      </linearGradient>
                      <radialGradient id="io-cursor-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stop-color="var(--io-mouse-glow, #7eb8da)" stop-opacity="0.8" />
                        <stop offset="100%" stop-color="var(--io-mouse-glow, #7eb8da)" stop-opacity="0" />
                      </radialGradient>
                      <linearGradient id="io-beam-gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stop-color="var(--io-mouse-glow, #7eb8da)" stop-opacity="0.9" />
                        <stop offset="100%" stop-color="var(--io-accent-rose, #e898a8)" stop-opacity="0.2" />
                      </linearGradient>
                    </defs>
                    <rect class="io-mouse-pad" x="4" y="8" width="48" height="64" rx="12" />
                    <rect class="io-mouse-body" x="12" y="8" width="32" height="56" rx="16" />
                    <line class="io-mouse-split" x1="28" y1="8" x2="28" y2="32" />
                    <line class="io-mouse-cross-h" x1="8" y1="40" x2="48" y2="40" />
                    <line class="io-mouse-cross-v" x1="28" y1="16" x2="28" y2="64" />
                    <circle class="io-mouse-glow" data-cursor-glow cx="28" cy="44" r="12" />
                    <rect class="io-mouse-btn io-mouse-btn--left" data-mbtn="left" x="12" y="8" width="16" height="24" rx="8" />
                    <rect class="io-mouse-btn io-mouse-btn--right" data-mbtn="right" x="28" y="8" width="16" height="24" rx="8" />
                    <ellipse class="io-mouse-btn io-mouse-btn--middle" data-mbtn="middle" cx="28" cy="40" rx="4" ry="6" />
                    <circle class="io-mouse-ring" data-cursor-ring cx="28" cy="44" r="5" />
                    <circle class="io-mouse-cursor" data-cursor-dot cx="28" cy="44" r="2.8" />
                    <line class="io-mouse-beam" data-cursor-beam x1="28" y1="44" x2="28" y2="44" />
                  </svg>
                  <span class="io-mouse-hint" data-mouse-hint hidden>中心</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.stage = this.container.querySelector('[data-io-stage]');
    this.tilt = this.container.querySelector('[data-io-tilt]');
    this.orbit = this.container.querySelector('[data-io-orbit]');
    this.root = this.container.querySelector('[data-io-root]');
    this._keyEls = buildKeyDomMap(this.container);
    this._cursorDot = this.container.querySelector('[data-cursor-dot]');
    this._cursorRing = this.container.querySelector('[data-cursor-ring]');
    this._cursorGlow = this.container.querySelector('[data-cursor-glow]');
    this._cursorBeam = this.container.querySelector('[data-cursor-beam]');
    this._mouseHint = this.container.querySelector('[data-mouse-hint]');
    this._mbtnEls = this.container.querySelectorAll('[data-mbtn]');
    this.setOpacity(this._opacity);
    this.setKeyPressColor(this._keyPressColor);
    this._bindFitScale();
  }

  /** 按窗口宽度等比缩放，避免键盘左右被裁切 */
  refit() {
    this._fitLayout();
  }

  _bindFitScale() {
    this._fitLayout();
    if (typeof ResizeObserver !== 'undefined' && this.container) {
      this._fitObserver = new ResizeObserver(() => this._fitLayout());
      this._fitObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this._fitLayout);
      this._fitOnWindowResize = true;
    }
  }

  _fitLayout = () => {
    if (!this.container) return;
    const w = this.container.clientWidth || 320;
    this.container.classList.toggle('io-narrow', w < IO_NARROW_W);
    const scale = Math.min(1, Math.max(0.52, (w - IO_PAD) / IO_DESIGN_W));
    this.container.style.setProperty('--io-design-w', `${IO_DESIGN_W}px`);
    this.container.style.setProperty('--io-fit-scale', scale.toFixed(3));
    this._fitScale = scale;
  };

  dispose() {
    this._fitObserver?.disconnect();
    if (this._fitOnWindowResize) {
      window.removeEventListener('resize', this._fitLayout);
    }
  }

  setKeyPressColor(hex) {
    this._keyPressColor = hex || '#e07898';
    const light = shadeHex(this._keyPressColor, 36);
    const dark = shadeHex(this._keyPressColor, -28);
    const el = this.container;
    el.style.setProperty('--io-key-down', this._keyPressColor);
    el.style.setProperty('--io-key-down-light', light);
    el.style.setProperty('--io-key-down-dark', dark);
    el.style.setProperty('--io-key-glow', `${this._keyPressColor}73`);
  }

  setVisible(v) {
    this._visible = v;
    if (this.stage) {
      this.stage.hidden = !v;
      if (v) this.stage.removeAttribute('hidden');
    }
  }

  setOpacity(value) {
    this._opacity = Math.max(0.35, Math.min(1, value));
    if (this.stage) this.stage.style.opacity = String(this._opacity);
  }

  setLookTilt(rx, ry, sensitivity = 1) {
    if (!this.orbit || !this.tilt) return;

    const s = Math.max(0.6, Math.min(2.2, sensitivity));
    const gain = KEYBOARD_FOLLOW_GAIN * (0.88 + 0.12 * s);
    const pitch = rx * gain;
    const yaw = ry * gain;

    const arcR = 28 + 8 * s;
    const maxArc = Math.max(6, 20 * (this._fitScale ?? 1));
    const arcX = Math.max(-maxArc, Math.min(maxArc, Math.sin(yaw) * arcR));
    const arcLift = Math.sin(pitch) * (3 + 2.5 * s);
    const depth = (1 - Math.cos(yaw)) * (6 + 3 * s);
    const faceY = (yaw * 180) / Math.PI * 0.62;
    const faceX = 3 + (-pitch * 180) / Math.PI * 0.28;

    this.orbit.style.transform = `
      translateX(${arcX}px)
      translateY(${-arcLift}px)
      translateZ(${depth}px)
    `;

    this.tilt.style.transform = `
      perspective(920px)
      rotateY(${faceY}deg)
      rotateX(${faceX}deg)
    `;
  }

  updateMouse({ nx, ny, buttons }) {
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      const cx = 28 + nx * 15;
      const cy = 44 + ny * 13;
      const clampedX = Math.max(10, Math.min(46, cx));
      const clampedY = Math.max(18, Math.min(66, cy));
      const dist = Math.hypot(nx, ny);

      this._cursorDot?.setAttribute('cx', String(clampedX));
      this._cursorDot?.setAttribute('cy', String(clampedY));
      this._cursorRing?.setAttribute('cx', String(clampedX));
      this._cursorRing?.setAttribute('cy', String(clampedY));
      this._cursorGlow?.setAttribute('cx', String(clampedX));
      this._cursorGlow?.setAttribute('cy', String(clampedY));
      this._cursorGlow?.setAttribute('r', String(10 + dist * 6));
      this._cursorDot?.setAttribute('r', String(2.4 + dist * 0.8));
      const beamLen = 6 + dist * 10;
      const angle = Math.atan2(ny, nx);
      const bx = clampedX + Math.cos(angle) * beamLen;
      const by = clampedY + Math.sin(angle) * beamLen;
      this._cursorBeam?.setAttribute('x1', String(clampedX));
      this._cursorBeam?.setAttribute('y1', String(clampedY));
      this._cursorBeam?.setAttribute('x2', String(bx));
      this._cursorBeam?.setAttribute('y2', String(by));
      this._cursorBeam?.classList.toggle('is-active', dist > 0.12);

      if (this._mouseHint) {
        const active = dist > 0.35;
        this._mouseHint.hidden = !active;
        if (active) {
          const horiz = nx > 0.2 ? '右' : nx < -0.2 ? '左' : '';
          const vert = ny > 0.2 ? '下' : ny < -0.2 ? '上' : '';
          this._mouseHint.textContent = `${vert}${horiz}` || '偏';
        }
      }
    }

    if (buttons) {
      this._mbtnEls?.forEach((el) => {
        el.classList.toggle('is-down', Boolean(buttons[el.dataset.mbtn]));
      });
    }
  }

  keyDown(name) {
    const id = resolveKeyId(name);
    if (!id) return;
    this._press(id);
  }

  keyUp(name) {
    const id = resolveKeyId(name);
    if (!id) return;
    this._release(id);
  }

  _press(id) {
    const n = (this._refCount.get(id) || 0) + 1;
    this._refCount.set(id, n);
    const wasHeld = this._held.has(id);
    this._held.add(id);
    this._syncHighlights();
    if (!wasHeld) this._flashKey(id);
  }

  _flashKey(id) {
    const el = this._keyEls.get(id);
    if (!el) return;
    el.classList.remove('is-flash');
    void el.offsetWidth;
    el.classList.add('is-flash');
    clearTimeout(el._flashTimer);
    el._flashTimer = setTimeout(() => el.classList.remove('is-flash'), 400);
  }

  _release(id) {
    const n = (this._refCount.get(id) || 0) - 1;
    if (n <= 0) {
      this._refCount.delete(id);
      this._held.delete(id);
    } else {
      this._refCount.set(id, n);
    }
    this._syncHighlights();
  }

  _syncHighlights() {
    const seen = new Set();
    this._keyEls.forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      const primary = el.dataset.keyId;
      const alt = el.dataset.keyAlt;
      const down = this._held.has(primary) || (alt && this._held.has(alt));
      el.classList.toggle('is-down', Boolean(down));
    });
  }
}
