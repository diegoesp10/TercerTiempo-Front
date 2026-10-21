import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { templateCompilerOptions } from '@tresjs/core';

export default defineConfig({
  // templateCompilerOptions: los componentes <Tres*> de TresJS son elementos del renderer de Three.js, no de Vue.
  plugins: [vue({ ...templateCompilerOptions }), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Apache ECharts (~670 kB) y Three.js (~650 kB) van en chunks propios que solo se descargan donde se usan;
    // el aviso por defecto (500 kB) no aporta nada aquí.
    chunkSizeWarningLimit: 800,
  },
});
