import { PoseEditorApp } from './poseEditor/PoseEditorApp.js';

const app = new PoseEditorApp();
app.init().catch((err) => {
  console.error('[PoseEditor]', err);
  const status = document.querySelector('[data-editor-status]');
  if (status) status.textContent = `加载失败：${err.message}`;
});

window.addEventListener('beforeunload', () => app.dispose());
