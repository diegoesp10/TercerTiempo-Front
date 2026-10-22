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
    rollupOptions: {
      output: {
        // Librerías pesadas en chunks propios con nombre estable: se cachean entre despliegues y solo se descargan
        // en las páginas que las usan (ECharts en estadísticas y comparador, Plyr en los vídeos).
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/echarts/') || id.includes('/zrender/') || id.includes('/vue-echarts/')) return 'echarts';
          if (id.includes('/gsap/')) return 'gsap';
          if (id.includes('/vue/') || id.includes('/@vue/') || id.includes('/vue-router/') || id.includes('/pinia/')) return 'vue';
          return undefined;
        },
      },
    },
    // ECharts supera los 500 kB sin comprimir por naturaleza; el aviso por defecto no aporta nada aquí.
    chunkSizeWarningLimit: 750,
  },
});
