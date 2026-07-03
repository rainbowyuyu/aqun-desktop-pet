/** 追踪陪伴时长与活跃使用，供气泡上下文使用 */
export class BubbleContextTracker {
  constructor() {
    this._sessionStart = Date.now();
    this._lastActivity = Date.now();
    this._lastTick = Date.now();
    this._activeMs = 0;
    this._todayReminders = [];
    this._dayInfo = null;
  }

  touch() {
    this._lastActivity = Date.now();
  }

  setTodayReminders(items, dayInfo) {
    this._todayReminders = items || [];
    this._dayInfo = dayInfo || null;
  }

  /** 每帧或取文案前调用，累计活跃时长 */
  tick(now = Date.now()) {
    const idleGap = now - this._lastActivity;
    if (idleGap < 120000) {
      this._activeMs += now - this._lastTick;
    }
    this._lastTick = now;
  }

  snapshot(now = new Date()) {
    this.tick(now.getTime());
    return {
      now,
      sessionMinutes: Math.floor((now.getTime() - this._sessionStart) / 60000),
      activeMinutes: Math.floor(this._activeMs / 60000),
      dayType: this._dayInfo?.dayType,
      dayMarks: this._dayInfo?.marks,
      todayReminders: this._todayReminders,
      todayReminderCount: this._todayReminders.length,
      hasClassToday: this._todayReminders.some((r) => r.category === 'class'),
    };
  }
}
