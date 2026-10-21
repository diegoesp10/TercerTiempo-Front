import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    // Apache ECharts (~670 kB, ~225 kB gzip) va en su propio chunk, que solo se descarga en las páginas con gráficos;
    // el aviso por defecto (500 kB) no aporta nada aquí.
    chunkSizeWarningLimit: 750,
  },
});
