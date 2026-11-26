import { fileURLToPath, URL } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// La fuente de la marca (solo la parte latina, la de casi todo el texto) se pide a la vez que el CSS, sin esperar a que
// el CSS la nombre. Su nombre lleva la huella del build, así que se busca en lo generado.
function preloadFont(): Plugin {
  let base = '/';
  return {
    name: 'preload-archivo-latin',
    apply: 'build',
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const font = Object.keys(ctx.bundle ?? {}).find((name) => /archivo-latin-wdth-normal-[\w-]+\.woff2$/.test(name));
        if (!font) return [];
        return [{ tag: 'link', attrs: { rel: 'preload', href: `${base}${font}`, as: 'font', type: 'font/woff2', crossorigin: true }, injectTo: 'head' }];
      },
    },
  };
}

// Cada archivo de texto del build, también en .gz con la compresión más alta: el Nginx los sirve tal cual (gzip_static)
// en vez de comprimir en cada petición con el nivel bajo de por defecto. Los que no llegan a 1 KB no compensan.
function precompress(): Plugin {
  return {
    name: 'precompress-gzip',
    apply: 'build',
    async writeBundle(options) {
      const { readdir, readFile, writeFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const { gzipSync, constants } = await import('node:zlib');
      const dir = options.dir;
      if (!dir) return;
      const files = (await readdir(dir, { recursive: true, withFileTypes: true }))
        .filter((entry) => entry.isFile() && /\.(?:js|css|html|svg|json|txt|xml|wasm)$/.test(entry.name))
        .map((entry) => join(entry.parentPath, entry.name));
      await Promise.all(files.map(async (file) => {
        const content = await readFile(file);
        if (content.length < 1024) return;
        await writeFile(`${file}.gz`, gzipSync(content, { level: constants.Z_BEST_COMPRESSION }));
      }));
    },
  };
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), preloadFont(), precompress()],
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
            // El calendario de la agenda con lo que arrastra (preact y el polyfill de Temporal): aparte de la vista, que
            // así se pinta sin esperarlo.
            { name: 'fullcalendar', test: /[\\/]node_modules[\\/].*(?:@fullcalendar|preact|temporal-polyfill)[\\/]/, priority: 10 },
          ],
        },
      },
    },
    // ECharts y Three.js superan los 500 kB sin comprimir por naturaleza; el aviso por defecto no aporta nada aquí.
    chunkSizeWarningLimit: 750,
  },
});
