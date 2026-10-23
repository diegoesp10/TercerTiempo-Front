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
    rolldownOptions: {
      output: {
        // Librerías pesadas en chunks propios con nombre estable: se cachean entre despliegues y solo se descargan
        // en las páginas que las usan (ECharts en estadísticas y comparador, Three.js para el campo de fondo).
        // Cada grupo arrastra sus dependencias, así que Vue va primero (más prioridad): si no, vue-echarts se llevaría
        // el runtime de Vue al chunk de ECharts y la carga inicial de cualquier página descargaría ECharts entero.
        codeSplitting: {
          groups: [
            { name: 'vue', test: /[\\/]node_modules[\\/](?:\.pnpm[\\/][^\\/]+[\\/]node_modules[\\/])?(?:vue|@vue|vue-router|pinia)[\\/]/, priority: 40 },
            { name: 'echarts', test: /[\\/]node_modules[\\/].*(?:echarts|zrender)[\\/]/, priority: 30 },
            { name: 'three', test: /[\\/]node_modules[\\/].*[\\/]three[\\/]/, priority: 20 },
            { name: 'gsap', test: /[\\/]node_modules[\\/].*[\\/]gsap[\\/]/, priority: 10 },
          ],
        },
      },
    },
    // ECharts y Three.js superan los 500 kB sin comprimir por naturaleza; el aviso por defecto no aporta nada aquí.
    chunkSizeWarningLimit: 750,
  },
});
