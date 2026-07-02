import gsap from 'gsap';

/** 模型前方的提醒面板 — 与日历/定时提醒联动 */
export class ModelReminderHud {
  constructor(container) {
    this.container = container;
    this._queue = [];
    this._visible = true;
    this._mount();
  }

  _mount() {
    this.container.innerHTML = `
      <div class="mrh-stack" data-mrh-stack hidden></div>
      <div class="mrh-toast" data-mrh-toast hidden>
        <div class="mrh-toast-inner">
          <span class="mrh-toast-time" data-mrh-toast-time></span>
          <p class="mrh-toast-title" data-mrh-toast-title></p>
          <p class="mrh-toast-note" data-mrh-toast-note hidden></p>
        </div>
      </div>
    `;
    this.stack = this.container.querySelector('[data-mrh-stack]');
    this.toast = this.container.querySelector('[data-mrh-toast]');
    this._toastTime = this.container.querySelector('[data-mrh-toast-time]');
    this._toastTitle = this.container.querySelector('[data-mrh-toast-title]');
    this._toastNote = this.container.querySelector('[data-mrh-toast-note]');
  }

  setVisible(v) {
    this._visible = v;
    this.container.hidden = !v;
  }

  /** 展示今日/选中日期的提醒摘要 */
  showDayReminders(items, { label = '今日提醒' } = {}) {
    if (!this._visible || !this.stack) return;
    if (!items?.length) {
      this.stack.hidden = true;
      return;
    }

    this.stack.hidden = false;
    this.stack.innerHTML = `
      <div class="mrh-card mrh-card--stack">
        <p class="mrh-card-label">${label}</p>
        <ul class="mrh-list">
          ${items
            .slice(0, 4)
            .map(
              (r) => `
            <li class="mrh-item">
              <span class="mrh-item-time">${r.time}</span>
              <span class="mrh-item-title">${this._esc(r.title)}</span>
            </li>`
            )
            .join('')}
        </ul>
        ${items.length > 4 ? `<p class="mrh-more">还有 ${items.length - 4} 条…</p>` : ''}
      </div>
    `;
    gsap.fromTo(this.stack, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
  }

  hideStack() {
    if (this.stack) this.stack.hidden = true;
  }

  /** 到点提醒 — 丝滑弹入 */
  pulseReminder(reminder) {
    if (!this._visible || !this.toast) return;

    this.toast.hidden = false;
    this._toastTime.textContent = reminder.time || '';
    this._toastTitle.textContent = reminder.title || '提醒';
    if (reminder.note) {
      this._toastNote.hidden = false;
      this._toastNote.textContent = reminder.note;
    } else {
      this._toastNote.hidden = true;
    }

    gsap.killTweensOf(this.toast);
    gsap.fromTo(
      this.toast,
      { opacity: 0, y: 16, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.4)' }
    );

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this._hideToast(), 6000);
  }

  _hideToast() {
    if (!this.toast) return;
    gsap.to(this.toast, {
      opacity: 0,
      y: -8,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        this.toast.hidden = true;
      },
    });
  }

  setTilt(rx, ry) {
    const degY = (ry * 180) / Math.PI;
    const degX = (-rx * 180) / Math.PI;
    this.container.style.transform = `perspective(680px) rotateY(${degY * 0.55}deg) rotateX(${degX * 0.35}deg)`;
  }

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  dispose() {
    clearTimeout(this._toastTimer);
    gsap.killTweensOf(this.toast);
    gsap.killTweensOf(this.stack);
  }
}
