import { getAppearanceModels } from './modelRegistry.js';
import { ModelPreview } from './ModelPreview.js';

/** 四模型预览与切换 */
export class ModelPicker {
  constructor({ container, getActiveId, getModelUrl, onSelect }) {
    this.container = container;
    this.getActiveId = getActiveId || (() => 'aqun_rig');
    this.getModelUrl = getModelUrl;
    this.onSelect = onSelect;
    this._previews = new Map();
    this._cards = [];
    this._visible = false;
    this._mounted = false;
  }

  mount() {
    if (this._mounted || !this.container) return;
    this._mounted = true;
    this.container.innerHTML = '';

    getAppearanceModels().forEach((model) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'aq-model-card';
      card.dataset.modelId = model.id;

      const canvas = document.createElement('canvas');
      canvas.className = 'aq-model-preview';
      canvas.setAttribute('aria-hidden', 'true');

      const meta = document.createElement('div');
      meta.className = 'aq-model-meta';
      meta.innerHTML = `<span class="aq-model-name">${model.name}</span><span class="aq-model-desc">${model.desc}</span>`;

      const badge = document.createElement('span');
      badge.className = 'aq-model-badge';
      badge.textContent = '使用中';

      card.append(canvas, meta, badge);
      card.addEventListener('click', () => this._select(model.id));
      this.container.appendChild(card);
      this._cards.push({ id: model.id, card, canvas, badge });
    });

    this._syncActive();
  }

  setVisible(visible) {
    this._visible = visible;
    if (!this._mounted) this.mount();
    if (visible) {
      void this._ensurePreviews().then(async () => {
        if (!this._visible) return;
        await Promise.all([...this._previews.values()].map((p) => p.whenReady()));
        if (!this._visible) return;
        await new Promise((r) => requestAnimationFrame(r));
        this._previews.forEach((p) => p.start());
      });
    } else {
      this._previews.forEach((p) => p.stop());
    }
  }

  syncActive() {
    this._syncActive();
  }

  _syncActive() {
    const active = this.getActiveId();
    this._cards.forEach(({ id, card, badge }) => {
      const on = id === active;
      card.classList.toggle('is-active', on);
      badge.hidden = !on;
    });
  }

  async _select(id) {
    if (id === this.getActiveId()) return;
    await this.onSelect?.(id);
    this._syncActive();
  }

  async _ensurePreviews() {
    for (const { id, canvas } of this._cards) {
      if (this._previews.has(id)) continue;
      let url = this.getModelUrl(id);
      if (url && typeof url.then === 'function') url = await url;
      if (!url) continue;
      this._previews.set(id, new ModelPreview(canvas, url, id));
    }
  }

  dispose() {
    this._previews.forEach((p) => p.dispose());
    this._previews.clear();
    this._cards = [];
    this._mounted = false;
    if (this.container) this.container.innerHTML = '';
  }
}
