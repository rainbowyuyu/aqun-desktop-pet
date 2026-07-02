import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        panel: path.resolve(__dirname, 'panel.html'),
        contextPopup: path.resolve(__dirname, 'context-popup.html'),
        poseEditor: path.resolve(__dirname, 'pose-editor.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
        },
      },
    },
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
