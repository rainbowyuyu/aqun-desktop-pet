import { BIRTHDAY } from './birthdayConfig.js';
import { WEEKDAYS, MONTHS } from './toolsRegistry.js';
import {
  dateKeyFromParts,
  getDayType,
  getDayMarks,
  hasReminderDot,
  parseDateKey,
  remindersForDate,
} from './calendarUtils.js';

function dateKey(y, m, d) {
  return dateKeyFromParts(y, m, d);
}

function isBirthdayCell(y, m, d) {
  return m + 1 === BIRTHDAY.month && d === BIRTHDAY.day;
}

export class CalendarWidget {
  constructor({ root, onSelectDate, onContextDate }) {
    this.root = root;
    this.onSelectDate = onSelectDate;
    this.onContextDate = onContextDate;
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();
    this.selectedKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
    this.reminders = [];
    this._renderShell();
    this._bindNav();
    this._bindGridEvents();
    this.render();
  }

  _renderShell() {
    this.root.innerHTML = `
      <div class="cal-widget">
        <div class="cal-head">
          <button type="button" class="cal-nav" data-cal-prev aria-label="上个月">‹</button>
          <div class="cal-title" data-cal-title></div>
          <button type="button" class="cal-nav" data-cal-next aria-label="下个月">›</button>
        </div>
        <div class="cal-weekdays">${WEEKDAYS.map((d, i) => `<span class="${i === 0 || i === 6 ? 'cal-wd--off' : ''}">${d}</span>`).join('')}</div>
        <div class="cal-grid" data-cal-grid></div>
        <p class="cal-hint">左键选日期 · 右键快速添加提醒</p>
        <div class="cal-legend">
          <span class="cal-legend-item"><i class="dot dot--today"></i>今天</span>
          <span class="cal-legend-item"><i class="dot dot--work"></i>工作日</span>
          <span class="cal-legend-item"><i class="dot dot--weekend"></i>周末</span>
          <span class="cal-legend-item"><i class="dot dot--holiday"></i>节假日</span>
          <span class="cal-legend-item"><i class="dot dot--solar"></i>节气</span>
          <span class="cal-legend-item"><i class="dot dot--reminder"></i>有提醒</span>
        </div>
      </div>
    `;
    this._titleEl = this.root.querySelector('[data-cal-title]');
    this._gridEl = this.root.querySelector('[data-cal-grid]');
  }

  _bindNav() {
    this.root.querySelector('[data-cal-prev]')?.addEventListener('click', () => {
      this.viewMonth -= 1;
      if (this.viewMonth < 0) {
        this.viewMonth = 11;
        this.viewYear -= 1;
      }
      this.render();
    });
    this.root.querySelector('[data-cal-next]')?.addEventListener('click', () => {
      this.viewMonth += 1;
      if (this.viewMonth > 11) {
        this.viewMonth = 0;
        this.viewYear += 1;
      }
      this.render();
    });
  }

  _bindGridEvents() {
    this._gridEl?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      this._selectDate(btn.dataset.date, { fullRender: true });
    });

    this._gridEl?.addEventListener('contextmenu', (e) => {
      const btn = e.target.closest('[data-date]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      this._selectDate(btn.dataset.date, { fullRender: true });
      this.onContextDate?.(btn.dataset.date, e.clientX, e.clientY);
    });
  }

  _selectDate(key, { fullRender = true } = {}) {
    const parsed = parseDateKey(key);
    if (Number.isNaN(parsed.getTime())) return;

    const y = parsed.getFullYear();
    const m = parsed.getMonth();
    const monthChanged = y !== this.viewYear || m !== this.viewMonth;
    if (monthChanged) {
      this.viewYear = y;
      this.viewMonth = m;
      fullRender = true;
    }

    const prev = this.selectedKey;
    this.selectedKey = key;

    if (fullRender) {
      this.render();
    } else {
      this._updateSelection(prev, key);
    }
    this.onSelectDate?.(key);
  }

  _updateSelection(prevKey, nextKey) {
    this._gridEl?.querySelector(`[data-date="${prevKey}"]`)?.classList.remove('cal-day--selected');
    this._gridEl?.querySelector(`[data-date="${nextKey}"]`)?.classList.add('cal-day--selected');
  }

  setReminders(list) {
    this.reminders = list || [];
    this.render();
  }

  getSelectedKey() {
    return this.selectedKey;
  }

  selectToday() {
    const now = new Date();
    this.viewYear = now.getFullYear();
    this.viewMonth = now.getMonth();
    this._selectDate(dateKey(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  _daysWithReminders() {
    const set = new Set();
    const cells = this._buildCells();
    for (const cell of cells) {
      if (this.reminders.some((r) => hasReminderDot(r, cell.key))) set.add(cell.key);
    }
    return set;
  }

  _buildCells() {
    const firstDay = new Date(this.viewYear, this.viewMonth, 1).getDay();
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(this.viewYear, this.viewMonth, 0).getDate();

    let py = this.viewYear;
    let pm = this.viewMonth - 1;
    if (pm < 0) {
      pm = 11;
      py -= 1;
    }

    const cells = [];
    for (let i = firstDay - 1; i >= 0; i -= 1) {
      const d = prevMonthDays - i;
      cells.push({ y: py, m: pm, d, muted: true, key: dateKey(py, pm, d) });
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      cells.push({
        y: this.viewYear,
        m: this.viewMonth,
        d,
        muted: false,
        key: dateKey(this.viewYear, this.viewMonth, d),
      });
    }

    let ny = this.viewYear;
    let nm = this.viewMonth + 1;
    if (nm > 11) {
      nm = 0;
      ny += 1;
    }
    let tail = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ y: ny, m: nm, d: tail, muted: true, key: dateKey(ny, nm, tail) });
      tail += 1;
    }
    return cells;
  }

  getRemindersForSelected() {
    return remindersForDate(this.reminders, this.selectedKey);
  }

  render() {
    if (!this._gridEl) return;

    this._titleEl.textContent = `${this.viewYear} 年 ${MONTHS[this.viewMonth]}`;
    const today = new Date();
    const todayK = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
    const reminderDays = this._daysWithReminders();

    this._gridEl.innerHTML = this._buildCells()
      .map(({ y, m, d, muted, key }) => {
        const dayType = getDayType(key);
        const marks = getDayMarks(key);
        const classes = ['cal-day', `cal-day--${dayType}`];
        if (muted) classes.push('cal-day--muted');
        if (key === todayK) classes.push('cal-day--today');
        if (key === this.selectedKey) classes.push('cal-day--selected');
        if (isBirthdayCell(y, m, d)) classes.push('cal-day--birthday');
        if (reminderDays.has(key)) classes.push('cal-day--has-reminder');
        if (marks.solarTerm) classes.push('cal-day--solar');
        const label = marks.primary
          ? `<span class="cal-day-label${marks.solarTerm === marks.primary ? ' cal-day-label--solar' : ''}">${marks.primary}</span>`
          : '';
        return `<button type="button" class="${classes.join(' ')}" data-date="${key}" title="${marks.labels.join(' · ') || ''}"><span class="cal-day-num">${d}</span>${label}</button>`;
      })
      .join('');
  }
}
