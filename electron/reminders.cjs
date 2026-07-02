const { app, Notification } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let reminders = [];
let timer = null;
let getMainWindow = null;
let getIconPath = null;
let getRemindersEnabled = () => true;

function pad(n) {
  return String(n).padStart(2, '0');
}

function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function remindersPath() {
  return path.join(app.getPath('userData'), 'reminders.json');
}

function loadReminders() {
  try {
    const raw = fs.readFileSync(remindersPath(), 'utf8');
    const data = JSON.parse(raw);
    reminders = Array.isArray(data) ? data : data.reminders || [];
  } catch {
    reminders = [];
    seedDefaultReminders();
  }
}

function seedDefaultReminders() {
  const year = new Date().getFullYear();
  reminders = [
    {
      id: crypto.randomUUID(),
      title: '生日快乐',
      note: '新的一岁，愿一切顺利。',
      date: `${year}-07-04`,
      time: '09:00',
      repeat: 'yearly',
      enabled: true,
      lastFired: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: '记得休息一下',
      note: '起来活动一下，喝口水。',
      date: todayKey(),
      time: '15:00',
      repeat: 'daily',
      enabled: true,
      lastFired: null,
      createdAt: new Date().toISOString(),
    },
  ];
  saveReminders();
}

function saveReminders() {
  fs.mkdirSync(path.dirname(remindersPath()), { recursive: true });
  fs.writeFileSync(remindersPath(), JSON.stringify(reminders, null, 2));
}

function getReminders() {
  return reminders.map((r) => ({ ...r }));
}

function upsertReminder(payload) {
  const now = new Date().toISOString();
  if (payload.id) {
    const idx = reminders.findIndex((r) => r.id === payload.id);
    if (idx >= 0) {
      reminders[idx] = { ...reminders[idx], ...payload, updatedAt: now };
      saveReminders();
      return { ...reminders[idx] };
    }
  }
  const item = {
    id: crypto.randomUUID(),
    title: String(payload.title || '提醒').trim(),
    note: String(payload.note || '').trim(),
    date: payload.date || todayKey(),
    time: payload.time || '09:00',
    repeat: payload.repeat || 'none',
    enabled: payload.enabled !== false,
    lastFired: null,
    createdAt: now,
  };
  reminders.push(item);
  saveReminders();
  return { ...item };
}

function deleteReminder(id) {
  const before = reminders.length;
  reminders = reminders.filter((r) => r.id !== id);
  if (reminders.length !== before) saveReminders();
  return before !== reminders.length;
}

function toggleReminder(id, enabled) {
  const item = reminders.find((r) => r.id === id);
  if (!item) return null;
  item.enabled = Boolean(enabled);
  item.updatedAt = new Date().toISOString();
  saveReminders();
  return { ...item };
}

function parseLocalDateKey(key) {
  const [y, m, d] = String(key || '').split('-').map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

function matchesDate(r, key) {
  if (r.repeat === 'none') return r.date === key;
  if (r.repeat === 'daily') return true;
  if (r.repeat === 'weekly') {
    const anchor = parseLocalDateKey(r.date);
    const probe = parseLocalDateKey(key);
    return anchor.getDay() === probe.getDay();
  }
  if (r.repeat === 'yearly') {
    const [, m, d] = r.date.split('-');
    const [, tm, td] = key.split('-');
    return `${m}-${d}` === `${tm}-${td}`;
  }
  return r.date === key;
}

function shouldFire(r, now) {
  if (!r.enabled) return false;
  const key = todayKey(now);
  if (!matchesDate(r, key)) return false;

  const [hh, mm] = r.time.split(':').map(Number);
  if (now.getHours() !== hh || now.getMinutes() !== mm) return false;

  const lastKey = r.lastFired ? r.lastFired.slice(0, 10) : null;
  if (lastKey === key) return false;
  return true;
}

function fireReminder(r, now) {
  if (!getRemindersEnabled()) return;

  r.lastFired = now.toISOString();
  saveReminders();

  const body = r.note ? `${r.title}\n${r.note}` : r.title;
  if (Notification.isSupported()) {
    const icon = getIconPath?.();
    const n = new Notification({
      title: '提醒 · 阿群',
      body,
      icon: icon || undefined,
    });
    n.show();
  }

  const win = getMainWindow?.();
  if (win && !win.isDestroyed()) {
    win.webContents.send('reminder-fired', { ...r });
  }
}

function tick() {
  const now = new Date();
  reminders.forEach((r) => {
    if (shouldFire(r, now)) fireReminder(r, now);
  });
}

function importReminders(items, { replaceClasses = false } = {}) {
  if (!Array.isArray(items) || !items.length) return getReminders();

  if (replaceClasses) {
    reminders = reminders.filter((r) => r.category !== 'class');
  }

  const now = new Date().toISOString();
  items.forEach((payload) => {
    const item = {
      id: crypto.randomUUID(),
      title: String(payload.title || '提醒').trim(),
      note: String(payload.note || '').trim(),
      date: payload.date || todayKey(),
      time: payload.time || '09:00',
      repeat: payload.repeat || 'none',
      enabled: payload.enabled !== false,
      category: payload.category || 'reminder',
      lastFired: null,
      createdAt: now,
    };
    reminders.push(item);
  });

  saveReminders();
  return getReminders();
}

function resetRemindersToDefault() {
  reminders = [];
  seedDefaultReminders();
  return getReminders();
}

function initReminders({ getWindow, getIcon, getEnabled }) {
  getMainWindow = getWindow;
  getIconPath = getIcon;
  getRemindersEnabled = getEnabled || (() => true);
  loadReminders();
  clearInterval(timer);
  timer = setInterval(tick, 20000);
  setTimeout(tick, 3000);
}

function stopReminders() {
  clearInterval(timer);
  timer = null;
}

module.exports = {
  initReminders,
  stopReminders,
  getReminders,
  upsertReminder,
  deleteReminder,
  toggleReminder,
  importReminders,
  resetRemindersToDefault,
};
