import { ContextMenu } from './pet/ContextMenu.js';

const ROOT = document.getElementById('ctx-root');

ROOT.innerHTML = `
  <div id="ctx-menu">
    <div class="ctx-panel" role="menu">
      <div class="ctx-brand">
        <img src="./logo.png" alt="" />
        <div>
          <span class="ctx-brand-name">阿群</span>
          <span class="ctx-brand-by">3D 模型</span>
        </div>
      </div>
      <div class="ctx-rainbow" aria-hidden="true"></div>
      <div class="ctx-group">
        <button type="button" class="ctx-item" data-action="toggle-visible">
          <span class="ctx-icon">◉</span>
          <span class="ctx-label" data-ctx-label="visible">暂时隐藏</span>
        </button>
        <button type="button" class="ctx-item ctx-item--accent" data-action="open-settings">
          <span class="ctx-icon">✦</span>
          <span class="ctx-label">控制中心</span>
        </button>
      </div>
      <div class="ctx-divider"></div>
      <div class="ctx-group ctx-group--compact">
        <div class="ctx-chip-unit">
          <button type="button" class="ctx-chip" data-action="toggle-keyboard">
            <span data-ctx-label="keyboard">按键监听</span>
          </button>
          <button type="button" class="ctx-tip-btn" data-ctx-tip="keyboard" aria-label="什么是按键监听">?</button>
        </div>
        <button type="button" class="ctx-chip" data-action="toggle-top">
          <span data-ctx-label="top">置顶</span>
        </button>
        <button type="button" class="ctx-chip" data-action="toggle-lock">
          <span data-ctx-label="lock">锁定</span>
        </button>
        <button type="button" class="ctx-chip" data-action="toggle-through">
          <span data-ctx-label="through">穿透</span>
        </button>
      </div>
      <p class="ctx-tip-banner" data-ctx-tip-pop="keyboard" hidden>
        按键监听仅用于在模型前显示按键标签与敲击动效，不会记录、上传或读取聊天与密码，与键盘监控无关。暂停后将不再显示按键。
      </p>
      <div class="ctx-divider"></div>
      <button type="button" class="ctx-item ctx-item--danger" data-action="quit">
        <span class="ctx-icon">⏻</span>
        <span class="ctx-label">退出</span>
      </button>
    </div>
  </div>
`;

const menu = new ContextMenu({
  root: document.getElementById('ctx-menu'),
  panel: document.querySelector('.ctx-panel'),
  popupMode: true,
  onAction: async (action) => {
    if (action === 'open-settings') {
      await window.aqunPet?.openSettingsFromPopup?.();
      return;
    }
    await window.aqunPet?.menuAction?.(action);
    window.aqunPet?.closeContextPopup?.();
  },
});

window.aqunPet?.onContextPopupShow?.((settings) => {
  menu.showPopup(settings);
});
