import { SITE_GROUPS } from './toolsRegistry.js';

/** 常用站点 — 学习 · 生活 · 工具 */
export class SitesPanel {
  constructor({ root }) {
    this.root = root;
    this._mount();
  }

  _mount() {
    if (!this.root) return;
    const total = SITE_GROUPS.reduce((n, g) => n + g.links.length, 0);
    this.root.innerHTML = `
      <div class="sites-panel">
        <p class="aq-section-label">常用站点</p>
        <p class="aq-section-hint">学习 · 生活 · 工具 · 点击在新窗口打开 · 共 ${total} 个</p>
        <div class="sites-groups" data-sites-groups></div>
      </div>
    `;
    this._renderGroups();
  }

  _renderGroups() {
    const host = this.root.querySelector('[data-sites-groups]');
    if (!host) return;

    host.innerHTML = SITE_GROUPS.map(
      (group) => `
        <section class="sites-group">
          <h3 class="sites-group-label">${group.label}</h3>
          <div class="tools-site-grid sites-grid">
            ${group.links
              .map(
                (link) => `
              <button type="button" class="tools-site-btn" data-open-url="${link.url}" style="--link-accent:${link.accent}">
                <span class="tools-site-icon">${link.icon}</span>
                <span class="tools-site-name">${link.name}</span>
                <span class="tools-site-desc">${link.desc}</span>
              </button>`,
              )
              .join('')}
          </div>
        </section>`,
    ).join('');

    host.querySelectorAll('[data-open-url]').forEach((btn) => {
      btn.addEventListener('click', () => window.aqunPet?.openExternal?.(btn.dataset.openUrl));
    });
  }

  onVisible() {}

  dispose() {}
}
