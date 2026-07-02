import gsap from 'gsap';
import { labelForKey, randomEmoji, keyCategory } from './keyDisplay.js';

const MAX_FLOATING = 10;

/** 按键可视化 — 可爱漂浮标签 */
export class KeyVisualizer {
  constructor(container) {
    this.container = container;
    this._active = 0;
  }

  show(name) {
    if (this._active >= MAX_FLOATING) return;

    const label = labelForKey(name);
    if (!label) return;

    const cat = keyCategory(name);
    const el = document.createElement('div');
    el.className = `key-float key-float--${cat}`;
    el.innerHTML = `<span class="key-float-emoji">${randomEmoji(cat)}</span><span class="key-float-text">${label}</span>`;
    this.container.appendChild(el);
    this._active += 1;

    const w = this.container.clientWidth || 320;
    const h = this.container.clientHeight || 480;
    const x = w * 0.25 + Math.random() * w * 0.5;
    const baseY = h * 0.35 + Math.random() * h * 0.25;
    const drift = (Math.random() - 0.5) * 36;
    gsap.set(el, {
      x,
      y: baseY,
      opacity: 0,
      scale: 0.5,
      rotation: (Math.random() - 0.5) * 14,
    });

    gsap
      .timeline({
        onComplete: () => {
          el.remove();
          this._active -= 1;
        },
      })
      .to(el, { opacity: 1, scale: 1, duration: 0.18, ease: 'back.out(2.2)' })
      .to(el, { y: `-=${55 + Math.random() * 30}`, x: `+=${drift}`, duration: 1.05, ease: 'sine.out' }, 0)
      .to(el, { opacity: 0, duration: 0.4, ease: 'sine.in' }, 0.7);
  }
}
