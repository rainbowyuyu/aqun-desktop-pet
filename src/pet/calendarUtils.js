/** 简易中国法定节假日（2025–2026，可扩展） */
import { getDayMarks, getDayDetailLines } from './calendarMarks.js';

export { getDayMarks, getDayDetailLines };

const CN_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
  '2025-02-01', '2025-02-02', '2025-02-03', '2025-02-04',
  '2025-04-04', '2025-04-05', '2025-04-06',
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',
  '2025-05-31', '2025-06-01', '2025-06-02',
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04', '2025-10-05',
  '2025-10-06', '2025-10-07', '2025-10-08',
  '2026-01-01', '2026-01-28', '2026-01-29', '2026-01-30', '2026-01-31',
  '2026-02-01', '2026-02-02', '2026-02-03',
  '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27',
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
  '2026-10-06', '2026-10-07',
]);

/** 调休补班（周末当工作日） */
export const CN_WORK_WEEKENDS = new Set([
  '2025-01-26', '2025-02-08', '2025-04-27', '2025-09-28', '2025-10-11',
  '2026-02-14', '2026-02-28', '2026-05-09', '2026-09-27', '2026-10-10',
]);

export function getDayDetails(key) {
  const dayType = getDayType(key);
  const marks = getDayMarks(key);
  const lines = getDayDetailLines(key, dayType);
  if (CN_WORK_WEEKENDS.has(key) && !lines.some((l) => l.text === '调休补班')) {
    lines.unshift({ kind: 'work', text: '调休补班' });
  }
  return { dayType, marks, lines };
}

export function dateKeyFromParts(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getDayType(key) {
  const date = parseDateKey(key);
  const dow = date.getDay();
  const isWeekend = dow === 0 || dow === 6;

  if (CN_HOLIDAYS.has(key)) return 'holiday';
  if (CN_WORK_WEEKENDS.has(key)) return 'workday';
  if (isWeekend) return 'weekend';
  return 'workday';
}

/** 日历打点：daily 在当月每天都显示小点 */
export function hasReminderDot(r, key) {
  if (!r.enabled) return false;
  if (r.repeat === 'none') return r.date === key;
  if (r.repeat === 'daily') return true;
  if (r.repeat === 'yearly') {
    const [, m, d] = r.date.split('-');
    const [, tm, td] = key.split('-');
    return `${m}-${d}` === `${tm}-${td}`;
  }
  if (r.repeat === 'weekly') {
    const anchor = parseDateKey(r.date);
    const probe = parseDateKey(key);
    return anchor.getDay() === probe.getDay();
  }
  return r.date === key;
}

/** 某日提醒列表（含 daily / weekly / yearly）；includeDisabled 为 true 时含已暂停项 */
export function remindersForDate(reminders, key, { includeDisabled = false } = {}) {
  return reminders
    .filter((r) => {
      if (!includeDisabled && !r.enabled) return false;
      if (r.repeat === 'none') return r.date === key;
      if (r.repeat === 'daily') return true;
      if (r.repeat === 'yearly') {
        const [, m, d] = r.date.split('-');
        const [, tm, td] = key.split('-');
        return `${m}-${d}` === `${tm}-${td}`;
      }
      if (r.repeat === 'weekly') {
        const anchor = parseDateKey(r.date);
        const probe = parseDateKey(key);
        return anchor.getDay() === probe.getDay();
      }
      return r.date === key;
    })
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
}

/** 解析 HH:MM 为当日分钟数 */
export function reminderMinutesOnDate(r) {
  const [hh, mm] = String(r.time || '00:00').split(':').map(Number);
  if (!Number.isFinite(hh)) return 0;
  return hh * 60 + (mm || 0);
}

/** 距提醒时刻还有多少分钟（负值表示已过期） */
export function minutesUntilReminder(r, key, now = new Date()) {
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return reminderMinutesOnDate(r) - nowMins;
}

/**
 * 是否仍应展示/预告（未过期；可选提前 leadMinutes 内才展示）
 * @param {{ gracePastMinutes?: number, leadMinutes?: number|null }} opts
 */
export function isReminderStillRelevant(r, key, now = new Date(), {
  gracePastMinutes = 0,
  leadMinutes = null,
} = {}) {
  const diff = minutesUntilReminder(r, key, now);
  if (diff < -gracePastMinutes) return false;
  if (leadMinutes != null && diff > leadMinutes) return false;
  return true;
}

/** 今日尚未过期、且在预告窗口内的提醒（用于模型前 HUD） */
export function upcomingRemindersForDate(reminders, key, now = new Date(), opts = {}) {
  return remindersForDate(reminders, key, opts).filter((r) =>
    isReminderStillRelevant(r, key, now, opts),
  );
}
