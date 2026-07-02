import { APP_VERSION, APP_VERSION_LABEL, FEATURE_SUMMARY, renderChangelogHtml, renderFeaturesHtml } from './releaseNotes.js';
const TAB_META = {
  about: { title: '首页', sub: '快速了解阿群 · 一键进入常用功能' },
  calendar: { title: '日历', sub: '课表 · 提醒 · 天气 · 日程一目了然' },
  sites: { title: '常用站点', sub: '学习 · 生活 · 工具 · 一键直达' },
  tools: { title: '小工具', sub: '效率 · 换算 · 天气 · 日常随手可用' },
  appearance: { title: '模型', sub: '换模型 · 调大小 · 透明度即时预览' },
  interaction: { title: '互动', sub: '眼神跟随 · 键盘反馈 · 气泡与彩蛋' },
  system: { title: '窗口', sub: '置顶 · 穿透 · 锁定与提醒开关' },
  advanced: { title: '高级', sub: '重置默认 · 动画预览 · 姿势编辑器' },
};

const RESET_CONFIRM_META = {
  appearance: {
    title: '重置模型',
    desc: '模型、窗口大小与透明度将恢复为默认设置，其他选项不受影响。',
    icon: '◴',
    tone: 'mint',
  },
  interaction: {
    title: '重置互动',
    desc: '眼神总体/分项灵敏度、键盘标签、气泡、空闲话语与联网热梗等将恢复默认。',
    icon: '◎',
    tone: 'sky',
  },
  system: {
    title: '重置窗口',
    desc: '置顶、穿透、位置锁定、键盘暂停与提醒开关等将恢复默认。',
    icon: '⚙',
    tone: 'sage',
  },
  tutorial: {
    title: '重置教程入口',
    desc: '将重新显示模型窗口右下角的教程光点，方便再次查看新手引导。',
    icon: '✦',
    tone: 'rose',
  },
  reminders: {
    title: '重置日历提醒',
    desc: '清空所有自定义提醒与课表条目，并恢复系统默认提醒。',
    icon: '📅',
    tone: 'amber',
  },
  all: {
    title: '恢复全部默认',
    desc: '外观、互动、系统、提醒与教程状态将全部恢复，此操作不可撤销。',
    icon: '↺',
    tone: 'danger',
  },
};

/** 百分比滑块：显示为整数 %，内部仍用 0–1 或倍率 */
const PERCENT_FIELDS = {
  petScale: { min: 60, max: 180, scale: 100 },
  opacity: { min: 35, max: 100, scale: 100 },
  lookSensitivity: { min: 60, max: 220, scale: 100 },
  lookHeadSensitivity: { min: 60, max: 220, scale: 100 },
  lookBodySensitivity: { min: 60, max: 220, scale: 100 },
  lookHandSensitivity: { min: 40, max: 180, scale: 100 },
  keyboardOpacity: { min: 35, max: 100, scale: 100 },
};

export class SettingsPanel {
  constructor({
    panel,
    closeBtn,
    onChange,
    onLiveChange,
    onOpenChange,
    onTabChange,
    modelPicker,
    toolsPanel,
    calendarPanel,
    sitesPanel,
    onReset,
    standalone = false,
  }) {
    this.panel = panel;
    this.closeBtn = closeBtn;
    this.onChange = onChange;
    this.onLiveChange = onLiveChange;
    this.onOpenChange = onOpenChange;
    this.onTabChange = onTabChange;
    this.modelPicker = modelPicker;
    this.toolsPanel = toolsPanel;
    this.calendarPanel = calendarPanel;
    this.sitesPanel = sitesPanel;
    this.onReset = onReset;
    this.standalone = standalone;
    this.open = standalone;
    this._controls = {};
    this._silentApply = false;
    this._activeTab = 'about';

    this._headerTitle = panel?.querySelector('[data-header-title]');
    this._headerSub = panel?.querySelector('[data-header-sub]');
    this._navItems = panel?.querySelectorAll('.aq-nav-item');
    this._pages = panel?.querySelectorAll('.aq-page');

    this.closeBtn?.addEventListener('click', () => this.setOpen(false));
    this.panel?.addEventListener('pointerdown', (e) => e.stopPropagation());
    this._bindTabs();
    this._bindControls();
    this._bindPercentInputs();
    this._bindLookSensExpand();
    this._bindExternalLinks();
    this._bindDevCard();
    this._bindWindowControls();
    this._bindPreviewControls();
    this._mountResetModal();
    this._mountChangelogModal();
    this._bindResetControls();
    this._bindAboutPage();
    this._bindGotoTabs();
    this._bindUpdateControls();
  }

  _bindUpdateControls() {
    const statusEl = this.panel?.querySelector('[data-update-status]');
    const statusTextEl = this.panel?.querySelector('[data-update-status-text]');
    const statusIconEl = this.panel?.querySelector('[data-update-status-icon]');
    const currentVerEl = this.panel?.querySelector('[data-update-current-ver]');
    const remoteVerEl = this.panel?.querySelector('[data-update-remote-ver]');
    const remoteVerBox = this.panel?.querySelector('.aq-update-ver--remote');
    const checkBtn = this.panel?.querySelector('[data-check-update]');
    const repoBtn = this.panel?.querySelector('[data-open-repo]');
    const releasesBtn = this.panel?.querySelector('[data-open-releases]');

    const STATUS_ICONS = {
      normal: 'ℹ',
      pending: '',
      ok: '✓',
      update: '↑',
      error: '!',
    };

    const setStatus = (text, tone = 'normal') => {
      if (!statusEl) return;
      statusEl.dataset.tone = tone;
      if (statusTextEl) statusTextEl.textContent = text;
      if (statusIconEl) statusIconEl.textContent = STATUS_ICONS[tone] ?? STATUS_ICONS.normal;
    };

    const setVersions = (current, remote, hasUpdate = false) => {
      if (currentVerEl) currentVerEl.textContent = current ? `v${current}` : '—';
      if (remoteVerEl) remoteVerEl.textContent = remote ? `v${remote}` : '—';
      remoteVerBox?.classList.toggle('is-highlight', Boolean(hasUpdate));
    };

    const loadRepoInfo = async () => {
      try {
        const info = await window.aqunPet?.getRepoInfo?.();
        if (info?.currentVersion) {
          setVersions(info.currentVersion, null);
          setStatus(`已加载 · 仓库 ${info.owner}/${info.repo}`, 'normal');
        }
      } catch {
        setStatus('当前版本信息不可用', 'error');
      }
    };
    loadRepoInfo();

    checkBtn?.addEventListener('click', async () => {
      if (checkBtn.disabled) return;
      try {
        checkBtn.disabled = true;
        checkBtn.classList.add('is-busy');
        setStatus('正在检查 GitHub 更新…', 'pending');
        const res = await window.aqunPet?.checkForUpdate?.();
        if (!res?.ok) {
          setStatus(`检查失败：${res?.error || '网络错误'}`, 'error');
          return;
        }
        setVersions(res.currentVersion, res.latestVersion, res.hasUpdate);
        if (res.hasUpdate) {
          setStatus(
            `发现新版本 v${res.latestVersion} · 请在仓库拉取后运行 npm run update:build`,
            'update',
          );
        } else {
          setStatus(`已是最新版本 v${res.currentVersion}`, 'ok');
        }
      } catch (err) {
        setStatus(`检查失败：${err.message}`, 'error');
      } finally {
        checkBtn.disabled = false;
        checkBtn.classList.remove('is-busy');
      }
    });

    repoBtn?.addEventListener('click', async () => {
      const info = await window.aqunPet?.getRepoInfo?.();
      if (info?.repoUrl) window.aqunPet?.openExternal?.(info.repoUrl);
    });

    releasesBtn?.addEventListener('click', async () => {
      const info = await window.aqunPet?.getRepoInfo?.();
      if (info?.releasesUrl) window.aqunPet?.openExternal?.(info.releasesUrl);
    });
  }

  _bindGotoTabs() {
    this.panel?.querySelectorAll('[data-goto-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.gotoTab;
        if (tab) this._switchTab(tab);
      });
    });
  }

  _mountResetModal() {
    const host = this.panel?.querySelector('.aq-shell') || this.panel || document.body;
    const el = document.createElement('div');
    el.className = 'aq-reset-modal';
    el.hidden = true;
    el.innerHTML = `
      <div class="aq-reset-modal-backdrop" data-reset-modal-close></div>
      <div class="aq-reset-modal-card" role="dialog" aria-modal="true" aria-labelledby="aq-reset-modal-title">
        <div class="aq-reset-modal-icon" data-reset-modal-icon aria-hidden="true"></div>
        <h3 class="aq-reset-modal-title" id="aq-reset-modal-title" data-reset-modal-title></h3>
        <p class="aq-reset-modal-desc" data-reset-modal-desc></p>
        <div class="aq-reset-modal-actions">
          <button type="button" class="aq-reset-modal-cancel" data-reset-modal-cancel>再想想</button>
          <button type="button" class="aq-reset-modal-confirm" data-reset-modal-confirm>确认重置</button>
        </div>
      </div>
    `;
    host.appendChild(el);
    this._resetModal = el;
    this._resetModalResolve = null;

    const close = () => this._closeResetModal(false);
    el.querySelector('[data-reset-modal-close]')?.addEventListener('click', close);
    el.querySelector('[data-reset-modal-cancel]')?.addEventListener('click', close);
    el.querySelector('[data-reset-modal-confirm]')?.addEventListener('click', () => this._closeResetModal(true));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  _openResetModal(scope) {
    const meta = RESET_CONFIRM_META[scope];
    if (!meta || !this._resetModal) return Promise.resolve(false);

    this._resetModal.dataset.tone = meta.tone;
    const iconEl = this._resetModal.querySelector('[data-reset-modal-icon]');
    const titleEl = this._resetModal.querySelector('[data-reset-modal-title]');
    const descEl = this._resetModal.querySelector('[data-reset-modal-desc]');
    const confirmBtn = this._resetModal.querySelector('[data-reset-modal-confirm]');
    if (iconEl) iconEl.textContent = meta.icon;
    if (titleEl) titleEl.textContent = meta.title;
    if (descEl) descEl.textContent = meta.desc;
    if (confirmBtn) {
      confirmBtn.textContent = scope === 'all' ? '确认恢复全部' : '确认重置';
    }

    this._resetModal.hidden = false;
    requestAnimationFrame(() => {
      this._resetModal.classList.add('is-open');
      confirmBtn?.focus();
    });

    return new Promise((resolve) => {
      this._resetModalResolve = resolve;
    });
  }

  _closeResetModal(confirmed) {
    if (!this._resetModal) return;
    this._resetModal.classList.remove('is-open');
    window.setTimeout(() => {
      this._resetModal.hidden = true;
      this._resetModalResolve?.(confirmed);
      this._resetModalResolve = null;
    }, 220);
  }

  _confirmReset(scope) {
    return this._openResetModal(scope);
  }

  _mountChangelogModal() {
    const host = this.panel?.querySelector('.aq-shell') || this.panel || document.body;
    const el = document.createElement('div');
    el.className = 'aq-changelog-modal';
    el.hidden = true;
    el.innerHTML = `
      <div class="aq-changelog-backdrop" data-changelog-close aria-hidden="true"></div>
      <div class="aq-changelog-card" role="dialog" aria-modal="true" aria-labelledby="aq-changelog-heading">
        <header class="aq-changelog-header">
          <h3 class="aq-changelog-heading" id="aq-changelog-heading" data-changelog-heading>更新记录</h3>
          <button type="button" class="aq-changelog-close" data-changelog-close aria-label="关闭">
            <span class="aq-changelog-close-icon" aria-hidden="true">×</span>
          </button>
        </header>
        <div class="aq-changelog-body" data-changelog-body></div>
        <footer class="aq-changelog-footer">
          <button type="button" class="aq-changelog-footer-close" data-changelog-close>关闭</button>
        </footer>
      </div>
    `;
    host.appendChild(el);
    this._changelogModal = el;
    el.querySelector('.aq-changelog-card')?.addEventListener('click', (e) => e.stopPropagation());
    el.querySelectorAll('[data-changelog-close]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._closeChangelogModal();
      });
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeChangelogModal();
    });
  }

  _openChangelogModal(filter = 'version') {
    if (!this._changelogModal) return;
    const heading = this._changelogModal.querySelector('[data-changelog-heading]');
    const body = this._changelogModal.querySelector('[data-changelog-body]');
    const card = this._changelogModal.querySelector('.aq-changelog-card');
    if (heading) {
      heading.textContent =
        filter === 'features'
          ? '功能一览'
          : `版本更新记录 · ${APP_VERSION}`;
    }
    if (body) {
      body.classList.toggle('aq-changelog-body--features', filter === 'features');
      body.classList.toggle('aq-changelog-body--versions', filter !== 'features');
      body.innerHTML = filter === 'features' ? renderFeaturesHtml() : renderChangelogHtml();
    }
    card?.classList.toggle('aq-changelog-card--features', filter === 'features');
    this._changelogModal.hidden = false;
    requestAnimationFrame(() => {
      this._changelogModal.classList.add('is-open');
      if (filter === 'features' && body) {
        body.querySelectorAll('.aq-feature-card').forEach((el, i) => {
          el.classList.remove('is-in');
          window.setTimeout(() => el.classList.add('is-in'), 40 + i * 55);
        });
      }
    });
  }

  _closeChangelogModal() {
    if (!this._changelogModal) return;
    this._changelogModal.querySelectorAll('.aq-feature-card.is-in').forEach((el) => {
      el.classList.remove('is-in');
    });
    this._changelogModal.classList.remove('is-open');
    window.setTimeout(() => {
      this._changelogModal.hidden = true;
    }, 220);
  }

  _bindAboutPage() {
    this.panel?.querySelectorAll('[data-show-changelog]').forEach((el) => {
      el.addEventListener('click', () => {
        const filter = el.dataset.showChangelog || 'full';
        this._openChangelogModal(filter);
      });
    });

    this.panel?.querySelector('[data-play-tutorial]')?.addEventListener('click', async () => {
      const card = this.panel.querySelector('[data-play-tutorial]');
      try {
        card?.classList.add('is-busy');
        await window.aqunPet?.playPreviewAnim?.('tutorial');
      } finally {
        card?.classList.remove('is-busy');
      }
    });

    const versionEls = this.panel?.querySelectorAll('[data-app-version]');
    versionEls?.forEach((el) => {
      el.textContent = APP_VERSION_LABEL;
    });
    const featureEl = this.panel?.querySelector('[data-feature-summary]');
    if (featureEl) featureEl.textContent = FEATURE_SUMMARY;
  }

  _setHubStatus(text, ok = true) {
    const statusEl = this.panel?.querySelector('[data-reset-status]');
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.dataset.ok = ok ? '1' : '0';
    if (text) {
      window.setTimeout(() => {
        if (statusEl.textContent === text) statusEl.textContent = '';
      }, 2600);
    }
  }

  _bindPreviewControls() {
    this.panel?.querySelectorAll('[data-preview]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.preview;
        if (!type || btn.disabled) return;
        const label = btn.querySelector('strong')?.textContent || '播放';
        try {
          btn.disabled = true;
          btn.classList.add('is-busy');
          this._setHubStatus('正在模型窗口播放…', true);
          const res = await window.aqunPet?.playPreviewAnim?.(type);
          if (res?.ok === false) {
            this._setHubStatus('模型窗口未就绪', false);
          } else {
            this._setHubStatus(type === 'birthday' ? '生日祝福已触发' : '教程动画已触发', true);
          }
        } catch {
          this._setHubStatus('播放失败，请确认模型窗口已打开', false);
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-busy');
        }
      });
    });
  }

  _bindWindowControls() {
    this.panel?.querySelector('[data-win-min]')?.addEventListener('click', () => {
      window.aqunPet?.panelWindowMinimize?.();
    });
  }

  _bindResetControls() {
    this.panel?.querySelectorAll('[data-reset-scope]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const scope = btn.dataset.resetScope;
        if (!scope || btn.disabled) return;

        const ok = await this._confirmReset(scope);
        if (!ok) return;

        const titleEl = btn.querySelector('.aq-reset-chip-title, .aq-reset-all-label');
        const title = titleEl?.textContent || btn.textContent?.trim() || '重置';

        try {
          btn.disabled = true;
          btn.classList.add('is-busy');
          this._setHubStatus('正在恢复默认…', true);
          const result = await window.aqunPet?.resetSettings?.(scope);
          if (result?.settings) {
            this.applySettings(result.settings);
          }
          if (scope === 'reminders' || scope === 'all') {
            await this.calendarPanel?.refresh?.();
          }
          await this.onReset?.(scope, result?.settings);
          this._setHubStatus(
            scope === 'all' ? '已全部恢复默认' : `「${title}」已恢复默认`,
            true,
          );
        } catch {
          this._setHubStatus('重置失败，请重试', false);
        } finally {
          btn.disabled = false;
          btn.classList.remove('is-busy');
        }
      });
    });
  }

  _bindDevCard() {
    const toggle = this.panel?.querySelector('[data-dev-toggle]');
    const head = toggle?.querySelector('[data-dev-toggle-head]');
    const body = toggle?.querySelector('.aq-dev-expand-body');
    const links = toggle?.querySelectorAll('.aq-dev-link-btn') ?? [];
    if (!toggle || !head) return;

    const setOpen = (open) => {
      toggle.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      body?.setAttribute('aria-hidden', open ? 'false' : 'true');
      links.forEach((btn) => btn.setAttribute('tabindex', open ? '0' : '-1'));
    };

    head.addEventListener('click', () => setOpen(!toggle.classList.contains('is-open')));

    links.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!toggle.classList.contains('is-open')) return;
        const url = btn.dataset.openUrl;
        if (url) window.aqunPet?.openExternal?.(url);
      });
    });
  }

  _bindTabs() {
    this._navItems?.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) this._switchTab(tab);
      });
    });
  }

  _bindExternalLinks() {
    this.panel?.querySelectorAll('[data-open-url]:not(.aq-dev-link-btn)').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.dataset.openUrl;
        if (url) window.aqunPet?.openExternal?.(url);
      });
    });
  }

  _switchTab(tab) {
    this._activeTab = tab;
    this._syncTabUI();
    const pages = this.panel?.querySelector('.aq-pages');
    if (pages) {
      pages.scrollTop = 0;
    }
  }

  _syncTabUI() {
    const tab = this._activeTab;

    this._navItems?.forEach((el) => {
      el.classList.toggle('is-active', el.dataset.tab === tab);
    });

    this._pages?.forEach((page) => {
      page.classList.toggle('is-active', page.dataset.page === tab);
    });

    const meta = TAB_META[tab];
    if (meta && this._headerTitle) this._headerTitle.textContent = meta.title;
    if (meta && this._headerSub) this._headerSub.textContent = meta.sub;

    this.modelPicker?.setVisible(this.open && tab === 'appearance');
    if (tab === 'tools') this.toolsPanel?.onVisible?.();
    if (tab === 'sites') this.sitesPanel?.onVisible?.();
    if (tab === 'calendar') this.calendarPanel?.onVisible?.();
    this.onTabChange?.(tab);
  }

  _bindControls() {
    this.panel?.querySelectorAll('[data-setting]').forEach((el) => {
      const key = el.dataset.setting;
      this._controls[key] = el;

      if (el.type === 'range') {
        el.addEventListener('input', () => {
          const value = this._readValue(el);
          if (this._silentApply) return;
          this._updateLabel(key, value);
          this.onLiveChange?.({ [key]: value });
        });
        el.addEventListener('change', () => this._emit(key, this._readValue(el)));
      } else if (el.type === 'checkbox') {
        el.addEventListener('change', () => {
          const value = el.checked;
          if (this._silentApply) return;
          this.onLiveChange?.({ [key]: value });
          this._emit(key, value);
        });
      } else if (el.type === 'color') {
        el.addEventListener('input', () => {
          const value = el.value;
          if (this._silentApply) return;
          this.onLiveChange?.({ [key]: value });
          this._emit(key, value);
        });
      }
    });
  }

  _bindLookSensExpand() {
    const wrap = this.panel?.querySelector('[data-look-sens-expand]');
    const head = wrap?.querySelector('[data-look-sens-toggle]');
    const body = wrap?.querySelector('.aq-look-sens-expand-body');
    if (!wrap || !head || !body) return;

    const setOpen = (open) => {
      wrap.classList.toggle('is-open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      body.hidden = !open;
    };

    head.addEventListener('click', () => setOpen(!wrap.classList.contains('is-open')));
  }

  _bindPercentInputs() {
    this.panel?.querySelectorAll('[data-input-for]').forEach((input) => {
      const key = input.dataset.inputFor;
      const cfg = PERCENT_FIELDS[key];
      if (!cfg) return;

      input.addEventListener('input', () => {
        if (this._silentApply) return;
        const raw = Number(input.value);
        if (!Number.isFinite(raw)) return;
        const clamped = Math.min(cfg.max, Math.max(cfg.min, raw));
        const value = clamped / cfg.scale;
        const slider = this._controls[key];
        if (slider) slider.value = String(value);
        this.onLiveChange?.({ [key]: value });
      });

      input.addEventListener('change', () => {
        if (this._silentApply) return;
        let raw = Number(input.value);
        if (!Number.isFinite(raw)) {
          const fallback = Number(this._controls[key]?.value ?? cfg.min / cfg.scale);
          this._updateLabel(key, fallback);
          return;
        }
        const clamped = Math.min(cfg.max, Math.max(cfg.min, Math.round(raw)));
        const value = clamped / cfg.scale;
        input.value = String(clamped);
        if (this._controls[key]) this._controls[key].value = String(value);
        this._emit(key, value);
      });
    });
  }

  _readValue(el) {
    if (el.type === 'range') return Number(el.value);
    if (el.type === 'checkbox') return el.checked;
    return el.value;
  }

  _emit(key, value) {
    if (this._silentApply) return;
    this._updateLabel(key, value);
    this.onChange?.({ [key]: value });
  }

  _updateLabel(key, value) {
    const cfg = PERCENT_FIELDS[key];
    if (!cfg) return;
    const display = Math.round(value * cfg.scale);
    const input = this.panel?.querySelector(`[data-input-for="${key}"]`);
    if (input && document.activeElement !== input) {
      input.value = String(display);
    }
  }

  applySettings(settings, { silent = true } = {}) {
    this._silentApply = silent;
    Object.entries(settings).forEach(([key, value]) => {
      const el = this._controls[key];
      if (el == null || value === undefined) return;
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = String(value);
      this._updateLabel(key, value);
    });
    this.modelPicker?.syncActive();
    this._silentApply = false;
  }

  setOpen(open, { persist = true } = {}) {
    const changed = this.open !== open;
    this.open = open;

    if (this.standalone) {
      if (!open) {
        window.aqunPet?.setSettingsWindowOpen?.(false).catch(() => {});
      }
      if (persist && changed) {
        window.aqunPet?.updateSettings?.({ settingsOpen: open }).catch(() => {});
      }
      this.onOpenChange?.(open);
      return;
    }

    const app = document.getElementById('app');
    if (app) app.classList.toggle('settings-open', open);

    if (this.panel) {
      if (open) {
        this.panel.hidden = false;
        this._syncTabUI();
      } else {
        this.panel.hidden = true;
        this.modelPicker?.setVisible(false);
      }
    }

    window.aqunPet?.setSettingsWindowOpen?.(open).catch(() => {});

    this.onOpenChange?.(open);
    if (persist && changed) {
      window.aqunPet?.updateSettings?.({ settingsOpen: open }).catch(() => {});
    }
  }

  isOpen() {
    return this.open;
  }
}
