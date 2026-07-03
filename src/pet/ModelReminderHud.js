import gsap from 'gsap';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 今日日程卡片自动收起（毫秒） */
const STACK_AUTO_DISMISS_MS = 18000;
/** 到点弹窗自动关闭（毫秒） */
const TOAST_AUTO_DISMISS_MS = 10000;

/** 模型前方的提醒面板 — 课表 / 日期 / 定时提醒 */
export class ModelReminderHud {
  constructor(container) {
    this.container = container;
    this._visible = true;
    this._stackDismissedKey = null;
    this._currentDayKey = null;
    this._stackTimer = null;
    this._toastTimer = null;
    this._mount();
  }

  _mount() {
    this.container.innerHTML = `
      <div class="mrh-stack" data-mrh-stack hidden></div>
      <div class="mrh-toast" data-mrh-toast hidden>
        <div class="mrh-toast-inner">
          <button type="button" class="mrh-close" data-mrh-toast-close aria-label="关闭">×</button>
          <span class="mrh-toast-badge" data-mrh-toast-badge hidden></span>
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
    this._toastBadge = this.container.querySelector('[data-mrh-toast-badge]');

    this.container.querySelector('[data-mrh-toast-close]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._hideToast(true);
    });

    this.container.addEventListener('click', (e) => {
      if (e.target.closest('[data-mrh-stack-close]')) {
        e.stopPropagation();
        e.preventDefault();
        this.dismissStack();
        return;
      }
      if (e.target.closest('[data-mrh-toast-close]')) {
        e.stopPropagation();
        e.preventDefault();
        this._hideToast(true);
      }
    });
  }

  setVisible(v) {
    this._visible = v;
    this.container.hidden = !v;
  }

  /** 展示今日提醒：课表、日程、日期标记 */
  showDayReminders(items, { dayKey, dayInfo } = {}) {
    if (!this._visible || !this.stack) return;
    this._currentDayKey = dayKey ?? null;

    if (!items?.length) {
      this.stack.hidden = true;
      return;
    }
    if (dayKey && this._stackDismissedKey === dayKey) {
      this.stack.hidden = true;
      return;
    }

    const classes = items.filter((r) => r.category === 'class');
    const reminders = items.filter((r) => r.category !== 'class');
    const dateLine = this._formatDateLine(dayKey, dayInfo);
    const markLine = this._formatMarkLine(dayInfo);

    this.stack.hidden = false;
    this.stack.innerHTML = `
      <div class="mrh-card mrh-card--stack">
        <button type="button" class="mrh-close" data-mrh-stack-close aria-label="关闭">×</button>
        <p class="mrh-card-date">${this._esc(dateLine)}</p>
        ${markLine ? `<p class="mrh-card-marks">${this._esc(markLine)}</p>` : ''}
        ${this._sectionHtml('课表', classes, 'class', 3)}
        ${this._sectionHtml('提醒', reminders, 'reminder', 3)}
        ${items.length > 6 ? `<p class="mrh-more">还有 ${items.length - 6} 条，打开日历查看</p>` : ''}
      </div>
    `;

    gsap.fromTo(this.stack, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });

    clearTimeout(this._stackTimer);
    this._stackTimer = setTimeout(() => this.dismissStack(), STACK_AUTO_DISMISS_MS);
  }

  _sectionHtml(label, items, kind, max) {
    if (!items.length) return '';
    const slice = items.slice(0, max);
    return `
      <div class="mrh-section">
        <p class="mrh-card-label mrh-card-label--${kind}">${label}</p>
        <ul class="mrh-list">
          ${slice.map((r) => this._itemHtml(r, kind)).join('')}
        </ul>
        ${items.length > max ? `<p class="mrh-section-more">+${items.length - max} 节</p>` : ''}
      </div>
    `;
  }

  _itemHtml(r, kind) {
    const badge = kind === 'class' ? '课' : this._repeatLabel(r);
    return `
      <li class="mrh-item mrh-item--${kind}">
        <span class="mrh-item-time">${r.time || ''}</span>
        <span class="mrh-item-badge">${badge}</span>
        <span class="mrh-item-title">${this._esc(r.title)}</span>
      </li>
    `;
  }

  _repeatLabel(r) {
    const map = { daily: '每日', weekly: '每周', yearly: '每年', none: '一次' };
    return map[r.repeat] || '提醒';
  }

  _formatDateLine(dayKey, dayInfo) {
    if (!dayKey) return '今日安排';
    const [y, m, d] = dayKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const w = WEEKDAYS[date.getDay()];
    const today = new Date();
    const isToday = dayKey === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return `${isToday ? '今天 · ' : ''}${m}月${d}日 周${w}`;
  }

  _formatMarkLine(dayInfo) {
    if (!dayInfo?.lines?.length && !dayInfo?.dayType) return '';
    const parts = [];
    if (dayInfo.dayType === 'holiday') parts.push('节假日');
    else if (dayInfo.dayType === 'weekend') parts.push('周末');
    for (const line of dayInfo.lines ?? []) {
      if (line.text && !parts.includes(line.text)) parts.push(line.text);
    }
    return parts.slice(0, 3).join(' · ');
  }

  dismissStack() {
    if (this._currentDayKey) {
      this._stackDismissedKey = this._currentDayKey;
    }
    this.hideStack();
  }

  hideStack() {
    clearTimeout(this._stackTimer);
    this._stackTimer = null;
    if (this.stack) this.stack.hidden = true;
  }

  resetStackDismiss() {
    this._stackDismissedKey = null;
  }

  /** 到点提醒 — 可手动关闭 */
  pulseReminder(reminder) {
    if (!this._visible || !this.toast) return;

    this.toast.hidden = false;
    const isClass = reminder.category === 'class';
    this._toastBadge.hidden = false;
    this._toastBadge.textContent = isClass ? '课表' : '提醒';
    this._toastBadge.className = `mrh-toast-badge mrh-toast-badge--${isClass ? 'class' : 'reminder'}`;
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
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.4)' },
    );

    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this._hideToast(false), TOAST_AUTO_DISMISS_MS);
  }

  _hideToast(immediate = false) {
    if (!this.toast) return;
    clearTimeout(this._toastTimer);
    gsap.killTweensOf(this.toast);
    if (immediate) {
      this.toast.hidden = true;
      this.toast.style.opacity = '';
      return;
    }
    gsap.to(this.toast, {
      opacity: 0,
      y: -8,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        this.toast.hidden = true;
        this.toast.style.opacity = '';
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
    clearTimeout(this._stackTimer);
    gsap.killTweensOf(this.toast);
    gsap.killTweensOf(this.stack);
  }
}
