import gsap from 'gsap';
import { randomLine } from './bubbleCopy.js';

export class BubbleUI {
  constructor(el) {
    this.el = el;
    this._tween = null;
    this._chatterFeed = null;
  }

  setChatterFeed(feed) {
    this._chatterFeed = feed;
  }

  show(category) {
    const hot = this._chatterFeed?.pickLine?.(category);
    const text = hot || randomLine(category, this._chatterFeed?.getExtras?.() || []);
    this.showText(text);
  }

  showText(text) {
    if (!text) return;
    this._tween?.kill();
    this.el.hidden = false;
    this.el.textContent = text;
    gsap.fromTo(
      this.el,
      { opacity: 0, y: 6 },
      { opacity: 1, y: 0, duration: 0.25, ease: 'sine.out' }
    );
    this._tween = gsap.to(this.el, {
      opacity: 0,
      y: -4,
      duration: 0.4,
      delay: 2,
      ease: 'sine.in',
      onComplete: () => {
        this.el.hidden = true;
      },
    });
  }
}
