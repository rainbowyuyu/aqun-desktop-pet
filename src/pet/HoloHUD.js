import { labelForKey, keyCategory } from './keyDisplay.js';

const MAX_KEYS = 8;
const KEY_FADE_MS = 2200;

/** 全息 HUD — 鼠标雷达 + 按键面板 + 鼠标按键 */
export class HoloHUD {
  constructor(container) {
    this.container = container;
    this._held = new Map();
    this._mouse = { nx: 0, ny: 0, buttons: { left: false, right: false, middle: false } };
    this._typingLevel = 0;
    this._visible = true;
    this._mount();
  }

  _mount() {
    this.container.innerHTML = `
      <div class="holo-hud" data-holo-root>
        <div class="holo-scanlines" aria-hidden="true"></div>
        <div class="holo-panel holo-panel--radar">
          <span class="holo-label">POINTER</span>
          <div class="holo-radar">
            <div class="holo-radar-grid"></div>
            <div class="holo-radar-cross"></div>
            <div class="holo-radar-anchor"></div>
            <div class="holo-radar-dot" data-radar-dot></div>
            <div class="holo-radar-trail" data-radar-trail></div>
          </div>
          <div class="holo-mouse-btns">
            <span class="holo-mbtn" data-mbtn="left">L</span>
            <span class="holo-mbtn" data-mbtn="middle">M</span>
            <span class="holo-mbtn" data-mbtn="right">R</span>
          </div>
        </div>
        <div class="holo-panel holo-panel--keys">
          <span class="holo-label">INPUT</span>
          <div class="holo-keyboard" data-keyboard></div>
          <div class="holo-typing-bar"><span data-typing-fill></span></div>
        </div>
        <div class="holo-beam-line" aria-hidden="true"></div>
      </div>
    `;
    this.root = this.container.querySelector('[data-holo-root]');
    this.radarDot = this.container.querySelector('[data-radar-dot]');
    this.radarTrail = this.container.querySelector('[data-radar-trail]');
    this.keyboardEl = this.container.querySelector('[data-keyboard]');
    this.typingFill = this.container.querySelector('[data-typing-fill]');
    this.mbtns = this.container.querySelectorAll('[data-mbtn]');
  }

  setVisible(v) {
    this._visible = v;
    if (this.root) {
      this.root.hidden = !v;
      if (v) this.root.removeAttribute('hidden');
    }
  }

  updateMouse({ nx, ny, buttons }) {
    if (Number.isFinite(nx)) this._mouse.nx = nx;
    if (Number.isFinite(ny)) this._mouse.ny = ny;
    if (buttons) this._mouse.buttons = { ...this._mouse.buttons, ...buttons };

    const x = 50 + this._mouse.nx * 38;
    const y = 50 + this._mouse.ny * 38;
    if (this.radarDot) {
      this.radarDot.style.left = `${x}%`;
      this.radarDot.style.top = `${y}%`;
    }
    if (this.radarTrail) {
      this.radarTrail.style.left = `${x}%`;
      this.radarTrail.style.top = `${y}%`;
      this.radarTrail.classList.add('is-active');
      clearTimeout(this._trailTimer);
      this._trailTimer = setTimeout(() => {
        this.radarTrail?.classList.remove('is-active');
      }, 120);
    }

    this.mbtns?.forEach((el) => {
      const key = el.dataset.mbtn;
      el.classList.toggle('is-down', Boolean(this._mouse.buttons[key]));
    });
  }

  keyDown(name) {
    const label = labelForKey(name);
    if (!label) return;
    const cat = keyCategory(name);
    this._held.set(name, { label, cat, at: Date.now() });
    this._trimHeld();
    this._renderKeys();
    this._typingLevel = Math.min(1, this._typingLevel + 0.18);
  }

  keyUp(name) {
    this._held.delete(name);
    this._renderKeys();
  }

  setTypingLevel(level) {
    this._typingLevel = Math.max(0, Math.min(1, level));
    if (this.typingFill) {
      this.typingFill.style.width = `${this._typingLevel * 100}%`;
    }
  }

  tick(delta) {
    this._typingLevel = Math.max(0, this._typingLevel - delta * 0.35);
    if (this.typingFill) {
      this.typingFill.style.width = `${this._typingLevel * 100}%`;
    }

    const now = Date.now();
    for (const [k, v] of this._held) {
      if (now - v.at > KEY_FADE_MS) this._held.delete(k);
    }
    this._renderKeys();
  }

  _trimHeld() {
    if (this._held.size <= MAX_KEYS) return;
    const sorted = [...this._held.entries()].sort((a, b) => a[1].at - b[1].at);
    while (this._held.size > MAX_KEYS) {
      this._held.delete(sorted.shift()[0]);
    }
  }

  _renderKeys() {
    if (!this.keyboardEl) return;
    if (!this._held.size) {
      this.keyboardEl.innerHTML = '<span class="holo-key-empty">等待输入…</span>';
      return;
    }
    const items = [...this._held.values()].sort((a, b) => b.at - a.at);
    this.keyboardEl.innerHTML = items
      .map(
        (k) =>
          `<span class="holo-key holo-key--${k.cat}"><i class="holo-key-glow"></i>${k.label}</span>`
      )
      .join('');
  }
}
