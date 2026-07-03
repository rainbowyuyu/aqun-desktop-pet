import gsap from 'gsap';
import { pickBubbleLine } from './bubbleCopy.js';

export class BubbleUI {
  constructor(el) {
    this.el = el;
    this._tween = null;
    this._chatterFeed = null;
    this._onClose = null;
    this._ensureStructure();
  }

  _ensureStructure() {
    if (this.el.querySelector('.bubble-text')) return;
    this.el.innerHTML = `
      <span class="bubble-text"></span>
      <button type="button" class="bubble-close" hidden aria-label="关闭">×</button>
    `;
    this._textEl = this.el.querySelector('.bubble-text');
    this._closeBtn = this.el.querySelector('.bubble-close');
    this._closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.dismiss();
    });
  }

  setChatterFeed(feed) {
    this._chatterFeed = feed;
  }

  setBubbleContext(getContext) {
    this._getBubbleContext = getContext;
  }

  show(category) {
    const ctx = this._getBubbleContext?.() || {};
    const hot = this._chatterFeed?.pickLine?.(category, ctx);
    const raw = hot || pickBubbleLine(category, ctx, this._chatterFeed?.getExtras?.() || []);
    const text = String(raw ?? '').trim();
    if (!text) return;
    this.showText(text);
  }

  showText(text, { duration } = {}) {
    const t = String(text ?? '').trim();
    if (!t) {
      this.dismiss();
      return;
    }
    this._showInternal(t, { dismissible: false, duration: duration ?? undefined });
  }

  /** 提醒类气泡：带关闭按钮，停留更久 */
  showReminder(text, { duration = 8 } = {}) {
    if (!text) return;
    this._showInternal(text, { dismissible: true, duration });
  }

  _showInternal(text, { dismissible, duration }) {
    this._ensureStructure();
    this._tween?.kill();
    this.el.hidden = false;
    this.el.classList.toggle('bubble--dismissible', dismissible);
    this._closeBtn.hidden = !dismissible;
    this._textEl.textContent = text;

    const showDuration = duration ?? this._durationForText(text, dismissible ? 8 : 2.2);

    gsap.fromTo(
      this.el,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.25, ease: 'sine.out' },
    );

    if (dismissible) {
      this._tween = gsap.to(this.el, {
        opacity: 0,
        y: -4,
        duration: 0.4,
        delay: showDuration,
        ease: 'sine.in',
        onComplete: () => {
          this.el.hidden = true;
        },
      });
      return;
    }

    this._tween = gsap.to(this.el, {
      opacity: 0,
      y: -4,
      duration: 0.4,
      delay: showDuration,
      ease: 'sine.in',
      onComplete: () => {
        this.el.hidden = true;
      },
    });
  }

  /** 长文案多停留一会 */
  _durationForText(text, base = 2.2) {
    const len = String(text).length;
    return Math.min(9, Math.max(base, base + len * 0.055));
  }

  hideImmediate() {
    this._tween?.kill();
    gsap.killTweensOf(this.el);
    if (this._textEl) this._textEl.textContent = '';
    this.el.classList.remove('bubble--dismissible');
    gsap.set(this.el, { opacity: 0, y: 0 });
    this.el.hidden = true;
  }

  dismiss() {
    if (this.el.hidden && !String(this._textEl?.textContent ?? '').trim()) return;
    this._tween?.kill();
    gsap.killTweensOf(this.el);
    this._textEl.textContent = '';
    gsap.to(this.el, {
      opacity: 0,
      y: -4,
      duration: 0.25,
      ease: 'sine.in',
      onComplete: () => {
        this.el.hidden = true;
        this._onClose?.();
      },
    });
  }

  setOnClose(fn) {
    this._onClose = fn;
  }
}
