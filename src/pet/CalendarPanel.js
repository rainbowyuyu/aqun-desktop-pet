import { CalendarWidget } from './CalendarWidget.js';
import { REPEAT_LABELS } from './toolsRegistry.js';
import { getDayDetails, remindersForDate } from './calendarUtils.js';
import { fetchWeather, weatherLinesForDayInfo } from './weatherService.js';
import { locateCity, locateCitySafe, locationPayload, shouldAutoLocate } from './locationService.js';
import { DEFAULT_WEATHER_CITY } from './locationDefaults.js';
import {
  parseScheduleCsv,
  parseScheduleIcs,
  SCHEDULE_CSV_TEMPLATE,
  SCHEDULE_IMPORT_HINT,
} from './scheduleImport.js';

/** 独立日历侧边栏 — 提醒 · 课表 · 天气 */
export class CalendarPanel {
  constructor({ root, onRemindersChange, getWeatherCity, getWeatherCoords, getLocateState, onWeatherCityChange, onWeatherLocated }) {
    this.root = root;
    this.onRemindersChange = onRemindersChange;
    this.getWeatherCity = getWeatherCity || (() => DEFAULT_WEATHER_CITY);
    this.getWeatherCoords = getWeatherCoords || (() => ({ lat: null, lon: null }));
    this.getLocateState = getLocateState;
    this.onWeatherCityChange = onWeatherCityChange;
    this.onWeatherLocated = onWeatherLocated;
    this._reminders = [];
    this._ctxDateKey = null;
    this._weatherReady = false;
    this._locating = null;
    this._mount();
  }

  _mount() {
    this.root.innerHTML = `
      <div class="cal-panel">
        <div class="cal-panel-main">
          <div id="cal-panel-widget"></div>
        </div>
        <aside class="cal-panel-side">
          <div class="cal-weather-bar">
            <div class="cal-weather-head">
              <span class="cal-weather-icon" aria-hidden="true">🌤</span>
              <div class="cal-weather-city">
                <input class="tools-input cal-weather-input" data-weather-city placeholder="城市名" maxlength="20" />
                <button type="button" class="tools-chip-btn" data-weather-locate title="使用当前位置">定位</button>
                <button type="button" class="tools-chip-btn" data-weather-refresh>刷新</button>
              </div>
            </div>
            <p class="cal-weather-now" data-weather-now>加载天气…</p>
            <p class="cal-weather-status tools-stats-line" data-weather-status aria-live="polite"></p>
            <div class="cal-weather-forecast" data-weather-forecast></div>
          </div>
          <div class="cal-import-bar">
            <p class="tools-reminder-label">课表</p>
            <p class="cal-import-hint">${SCHEDULE_IMPORT_HINT}</p>
            <div class="cal-import-actions">
              <button type="button" class="tools-chip-btn" data-import-csv>导入 CSV</button>
              <button type="button" class="tools-chip-btn" data-import-ics>导入 ICS</button>
              <button type="button" class="tools-chip-btn" data-import-template>下载模板</button>
              <button type="button" class="tools-chip-btn cal-import-clear" data-import-clear>清空课表</button>
            </div>
            <input type="file" accept=".csv,.txt,.ics" hidden data-import-file />
            <p class="tools-stats-line" data-import-status aria-live="polite"></p>
          </div>
          <div class="cal-panel-side-head">
            <div>
              <p class="tools-reminder-label">提醒</p>
              <p class="tools-reminder-date" data-cal-date-label>—</p>
              <ul class="cal-day-info" data-cal-day-info hidden></ul>
            </div>
            <button type="button" class="tools-chip-btn" data-cal-today>今天</button>
          </div>
          <ul class="tools-reminder-list" data-cal-reminder-list></ul>
          <form class="tools-reminder-form" data-cal-reminder-form>
            <input class="tools-input" name="title" placeholder="提醒标题" maxlength="40" required />
            <input class="tools-input" name="note" placeholder="备注（可选）" maxlength="80" />
            <div class="tools-form-row">
              <input class="tools-input tools-input--time" name="time" type="time" value="09:00" required />
              <select class="tools-select" name="repeat">
                ${Object.entries(REPEAT_LABELS)
                  .map(([k, v]) => `<option value="${k}">${v}</option>`)
                  .join('')}
              </select>
            </div>
            <button type="submit" class="tools-primary-btn">添加提醒</button>
            <p class="tools-stats-line" data-cal-form-status aria-live="polite"></p>
          </form>
        </aside>
      </div>
      <div class="cal-ctx-menu" data-cal-ctx-menu hidden>
        <button type="button" data-ctx-add>添加提醒</button>
        <button type="button" data-ctx-view>查看当日提醒</button>
      </div>
    `;

    this._ctxMenu = this.root.querySelector('[data-cal-ctx-menu]');
    this._form = this.root.querySelector('[data-cal-reminder-form]');
    this._formStatus = this.root.querySelector('[data-cal-form-status]');
    this._importStatus = this.root.querySelector('[data-import-status]');
    this._importFile = this.root.querySelector('[data-import-file]');
    this._weatherCityInput = this.root.querySelector('[data-weather-city]');
    this._weatherNow = this.root.querySelector('[data-weather-now]');
    this._weatherForecast = this.root.querySelector('[data-weather-forecast]');
    this._weatherStatus = this.root.querySelector('[data-weather-status]');

    this._calendar = new CalendarWidget({
      root: this.root.querySelector('#cal-panel-widget'),
      onSelectDate: (key) => this._onDateSelected(key),
      onContextDate: (key, x, y) => this._showCtxMenu(key, x, y),
    });

    this._form?.addEventListener('submit', (e) => this._onAddReminder(e));
    this.root.querySelector('[data-cal-today]')?.addEventListener('click', () => {
      this._calendar.selectToday();
    });

    this._weatherCityInput?.addEventListener('change', () => {
      const city = this._weatherCityInput.value.trim();
      if (city) this.onWeatherCityChange?.(city);
      this._loadWeather(true);
    });
    this.root.querySelector('[data-weather-refresh]')?.addEventListener('click', () => {
      this._loadWeather(true);
    });
    this.root.querySelector('[data-weather-locate]')?.addEventListener('click', () => {
      this._locateWeather();
    });

    this.root.querySelector('[data-import-csv]')?.addEventListener('click', () => {
      this._pendingImport = 'csv';
      if (this._importFile) {
        this._importFile.accept = '.csv,.txt';
        this._importFile.click();
      }
    });
    this.root.querySelector('[data-import-ics]')?.addEventListener('click', () => {
      this._pendingImport = 'ics';
      if (this._importFile) {
        this._importFile.accept = '.ics';
        this._importFile.click();
      }
    });
    this.root.querySelector('[data-import-template]')?.addEventListener('click', () => {
      const blob = new Blob([SCHEDULE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '课表模板.csv';
      a.click();
      URL.revokeObjectURL(a.href);
      this._setImportStatus('已下载 CSV 模板', true);
    });
    this.root.querySelector('[data-import-clear]')?.addEventListener('click', async () => {
      if (!window.confirm('确定清空所有课表条目？')) return;
      const classIds = this._reminders.filter((r) => r.category === 'class').map((r) => r.id);
      for (const id of classIds) {
        await window.aqunPet?.deleteReminder?.(id);
      }
      this._setImportStatus(`已清空 ${classIds.length} 条课表`, true);
      await this.refresh();
    });
    this._importFile?.addEventListener('change', (e) => this._onImportFile(e));

    this._ctxMenu?.querySelector('[data-ctx-add]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._hideCtxMenu();
      this._form?.querySelector('[name="title"]')?.focus();
    });
    this._ctxMenu?.querySelector('[data-ctx-view]')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._hideCtxMenu();
      this._renderReminderList(this._calendar.getSelectedKey());
    });

    this._onDocDismiss = (e) => {
      if (!this._ctxMenu?.classList.contains('is-open')) return;
      if (this._ctxMenu.contains(e.target)) return;
      this._hideCtxMenu();
    };
    this._onDocKeyDown = (e) => {
      if (e.key === 'Escape') this._hideCtxMenu();
    };
    this._onDocScroll = () => this._hideCtxMenu();

    document.addEventListener('mousedown', this._onDocDismiss, true);
    document.addEventListener('click', this._onDocDismiss, true);
    document.addEventListener('keydown', this._onDocKeyDown);
    document.addEventListener('scroll', this._onDocScroll, true);
  }

  _setWeatherStatus(msg, ok = true) {
    if (!this._weatherStatus) return;
    this._weatherStatus.textContent = msg || '';
    this._weatherStatus.dataset.ok = ok ? '1' : '0';
  }

  async _locateWeather() {
    const btn = this.root.querySelector('[data-weather-locate]');
    try {
      btn?.classList.add('is-busy');
      await this.autoLocateWeather({ silent: false, force: true });
    } finally {
      btn?.classList.remove('is-busy');
    }
  }

  async autoLocateWeather({ silent = true, force = false } = {}) {
    if (!force) {
      const state = this.getLocateState?.() ?? {};
      if (!shouldAutoLocate(state)) return false;
    }
    if (this._locating) return this._locating;
    this._locating = this._runAutoLocate(silent).finally(() => {
      this._locating = null;
    });
    return this._locating;
  }

  async _runAutoLocate(silent) {
    try {
      if (!silent) this._setWeatherStatus('正在定位…', true);
      const loc = await locateCitySafe();
      if (this._weatherCityInput) this._weatherCityInput.value = loc.city;
      const partial = locationPayload(loc);
      this.setWeatherCoords(loc.lat, loc.lon);
      this.onWeatherLocated?.(partial);
      await this._loadWeather(true, { lat: loc.lat, lon: loc.lon, city: loc.city });
      if (!silent) {
        const hint =
          loc.source === 'default'
            ? '（无法定位，已使用默认：嘉定 · 上海）'
            : loc.source === 'ip'
              ? '（网络定位）'
              : '';
        this._setWeatherStatus(`✓ 已定位到 ${loc.label || loc.city}${hint}`, true);
      }
      return true;
    } catch (err) {
      if (!silent) this._setWeatherStatus(`✗ ${err.message || '定位失败'}`, false);
      return false;
    }
  }

  async _loadWeather(force = false, override = {}) {
    const city = override.city ?? (this._weatherCityInput?.value.trim() || this.getWeatherCity?.() || DEFAULT_WEATHER_CITY);
    const lat = override.lat ?? this.getWeatherCoords?.()?.lat;
    const lon = override.lon ?? this.getWeatherCoords?.()?.lon;
    if (this._weatherCityInput && !this._weatherCityInput.value) {
      this._weatherCityInput.value = city;
    }
    try {
      const data = await fetchWeather({
        city: lat != null ? undefined : city,
        lat,
        lon,
        force,
      });
      this._weatherReady = true;
      if (this._weatherNow && data.current) {
        this._weatherNow.textContent = `${data.label || city} · 现在 ${data.current.temp}°C · ${data.current.label}`;
      }
      if (this._weatherForecast && data.daily?.length) {
        this._weatherForecast.innerHTML = data.daily.slice(0, 5).map((d) => {
          const wd = new Date(d.date).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' });
          return `<span class="cal-forecast-chip"><b>${wd}</b> ${d.label} ${d.min}~${d.max}°C</span>`;
        }).join('');
      }
      this._renderDayInfo(this._calendar.getSelectedKey());
    } catch (err) {
      if (this._weatherNow) this._weatherNow.textContent = `天气加载失败：${err.message || '请检查城市名'}`;
      this._setWeatherStatus(`✗ ${err.message || '加载失败'}`, false);
    }
  }

  async _onImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const mode = this._pendingImport || (file.name.endsWith('.ics') ? 'ics' : 'csv');
      const items = mode === 'ics' ? parseScheduleIcs(text) : parseScheduleCsv(text);
      if (!items.length) throw new Error('未识别到有效课表条目');

      await window.aqunPet?.importReminders?.(items, { replaceClasses: false });
      this._setImportStatus(`✓ 已导入 ${items.length} 条课表`, true);
      await this.refresh();
    } catch (err) {
      this._setImportStatus(`✗ ${err.message || '导入失败'}`, false);
    }
  }

  _setImportStatus(msg, ok = true) {
    if (!this._importStatus) return;
    this._importStatus.textContent = msg || '';
    this._importStatus.dataset.ok = ok ? '1' : '0';
  }

  _showCtxMenu(key, x, y) {
    if (!this._ctxMenu) return;
    this._ctxDateKey = key;
    const rect = this.root.getBoundingClientRect();
    this._ctxMenu.hidden = false;
    this._ctxMenu.classList.add('is-open');
    this._ctxMenu.style.left = `${Math.max(4, x - rect.left)}px`;
    this._ctxMenu.style.top = `${Math.max(4, y - rect.top)}px`;
  }

  _hideCtxMenu() {
    if (!this._ctxMenu) return;
    this._ctxMenu.hidden = true;
    this._ctxMenu.classList.remove('is-open');
  }

  _onDateSelected(key) {
    this._renderReminderList(key);
    const items = remindersForDate(this._reminders, key);
    this.onRemindersChange?.(items, key);
  }

  async refresh() {
    this._reminders = (await window.aqunPet?.getReminders?.()) || [];
    this._calendar.setReminders(this._reminders);
    this._onDateSelected(this._calendar.getSelectedKey());
    await this._loadWeather(false);
  }

  applySettings(settings) {
    if (settings?.weatherCity && this._weatherCityInput) {
      this._weatherCityInput.value = settings.weatherCity;
    }
  }

  getWeatherCoords() {
    return {
      lat: this._coords?.lat ?? null,
      lon: this._coords?.lon ?? null,
    };
  }

  setWeatherCoords(lat, lon) {
    this._coords = { lat, lon };
  }

  _formatDateLabel(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  }

  _setFormStatus(msg, ok = true) {
    if (!this._formStatus) return;
    this._formStatus.textContent = msg || '';
    this._formStatus.dataset.ok = ok ? '1' : '0';
  }

  _renderDayInfo(key) {
    const infoEl = this.root.querySelector('[data-cal-day-info]');
    if (!infoEl) return;

    const { lines } = getDayDetails(key);
    const weatherLines = this._weatherReady ? weatherLinesForDayInfo(key) : [];
    const all = [...weatherLines, ...lines];

    if (!all.length) {
      infoEl.hidden = true;
      infoEl.innerHTML = '';
      return;
    }

    infoEl.hidden = false;
    infoEl.innerHTML = all
      .map((line) => `<li class="cal-day-info-item cal-day-info-item--${line.kind}">${this._esc(line.text)}</li>`)
      .join('');
  }

  _renderReminderList(key) {
    const listEl = this.root.querySelector('[data-cal-reminder-list]');
    const dateEl = this.root.querySelector('[data-cal-date-label]');
    if (dateEl) dateEl.textContent = this._formatDateLabel(key);
    this._renderDayInfo(key);

    const items = remindersForDate(this._reminders, key, { includeDisabled: true });
    if (!listEl) return;

    if (!items.length) {
      listEl.innerHTML = '<li class="tools-reminder-empty">这一天还没有安排<br><span>添加提醒，或导入课表 CSV / ICS</span></li>';
      return;
    }

    listEl.innerHTML = items
      .map(
        (r) => `
        <li class="tools-reminder-item${r.enabled ? '' : ' is-off'}${r.category === 'class' ? ' is-class' : ''}">
          <div class="tools-reminder-meta">
            <span class="tools-reminder-time">${r.time}</span>
            <span class="tools-reminder-repeat">${r.category === 'class' ? '课表' : (REPEAT_LABELS[r.repeat] || '不重复')}</span>
          </div>
          <p class="tools-reminder-title">${this._esc(r.title)}</p>
          ${r.note ? `<p class="tools-reminder-note">${this._esc(r.note)}</p>` : ''}
          <div class="tools-reminder-actions">
            <button type="button" class="tools-icon-btn" data-toggle-reminder="${r.id}">${r.enabled ? '暂停' : '启用'}</button>
            <button type="button" class="tools-icon-btn tools-icon-btn--danger" data-delete-reminder="${r.id}">删除</button>
          </div>
        </li>`
      )
      .join('');

    listEl.querySelectorAll('[data-toggle-reminder]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const item = this._reminders.find((r) => r.id === btn.dataset.toggleReminder);
        await window.aqunPet?.toggleReminder?.(btn.dataset.toggleReminder, !item?.enabled);
        await this.refresh();
      });
    });
    listEl.querySelectorAll('[data-delete-reminder]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await window.aqunPet?.deleteReminder?.(btn.dataset.deleteReminder);
        await this.refresh();
      });
    });
  }

  async _onAddReminder(e) {
    e.preventDefault();
    const fd = new FormData(this._form);
    const title = String(fd.get('title') || '').trim();
    if (!title) {
      this._setFormStatus('请填写提醒标题', false);
      return;
    }

    try {
      const saved = await window.aqunPet?.saveReminder?.({
        title,
        note: String(fd.get('note') || '').trim(),
        date: this._calendar.getSelectedKey(),
        time: fd.get('time') || '09:00',
        repeat: fd.get('repeat') || 'none',
        enabled: true,
        category: 'reminder',
      });
      if (!saved) throw new Error('保存失败');

      this._form.reset();
      this._form.querySelector('[name="time"]').value = '09:00';
      this._setFormStatus(`✓ 已添加到 ${this._formatDateLabel(this._calendar.getSelectedKey())}`, true);
      await this.refresh();
    } catch (err) {
      this._setFormStatus(`✗ ${err.message || '添加失败'}`, false);
    }
  }

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  onVisible() {
    this.refresh();
  }

  getTodayReminders() {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return remindersForDate(this._reminders, key);
  }

  dispose() {
    document.removeEventListener('mousedown', this._onDocDismiss, true);
    document.removeEventListener('click', this._onDocDismiss, true);
    document.removeEventListener('keydown', this._onDocKeyDown);
    document.removeEventListener('scroll', this._onDocScroll, true);
  }
}
