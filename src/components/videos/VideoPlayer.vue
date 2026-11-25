<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import BrandMark from '@/components/layout/BrandMark.vue';

// Visor del partido sobre Plyr: el navegador pide el archivo por rangos (la API responde 206), así que se puede saltar
// en la línea de tiempo sin descargarlo entero. Mientras el navegador espera datos se muestra el logo animado. Con start
// (segundos) empieza ahí y en marcha; seek() salta a otro momento sin volver a cargar el vídeo.
const props = defineProps<{ src: string; type: string; title?: string; start?: number | null }>();

const video = ref<HTMLVideoElement | null>(null);
const buffering = ref(false);
const failed = ref(false);
let player: Plyr | null = null;

// Hasta que el navegador conoce la duración no se puede saltar: se guarda el último salto pedido y se hace entonces.
let pendingSeek: number | null = null;
function jump(element: HTMLVideoElement, seconds: number) {
  const end = Number.isFinite(element.duration) ? element.duration : seconds;
  element.currentTime = Math.min(Math.max(0, seconds), end);
  // Sin un clic reciente el navegador puede no dejar arrancar solo: se queda parado en su sitio, listo para darle al play.
  void element.play()?.catch(() => undefined);
}
function seek(seconds: number) {
  const element = video.value;
  if (!element) return;
  if (element.readyState >= HTMLMediaElement.HAVE_METADATA) {
    jump(element, seconds);
    return;
  }
  if (pendingSeek === null) {
    element.addEventListener('loadedmetadata', () => {
      const target = pendingSeek;
      pendingSeek = null;
      if (target !== null) jump(element, target);
    }, { once: true });
  }
  pendingSeek = seconds;
}
defineExpose({ seek });

function attach() {
  if (!video.value) return;
  player = new Plyr(video.value, {
    // Iconos y vídeo en blanco servidos por la propia web: por defecto Plyr los pide a cdn.plyr.io, que la política de
    // seguridad no deja cargar. El vídeo en blanco es el que pone al cerrar o cambiar de vídeo para cortar la descarga.
    iconUrl: '/vendor/plyr/plyr.svg',
    blankVideo: '/vendor/plyr/blank.mp4',
    controls: ['play-large', 'play', 'progress', 'current-time', 'duration', 'mute', 'volume', 'settings', 'pip', 'fullscreen'],
    settings: ['speed'],
    speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
    seekTime: 10,
    keyboard: { focused: true, global: false },
    tooltips: { controls: true, seek: true },
    i18n: {
      play: 'Reproducir', pause: 'Pausar', mute: 'Silenciar', unmute: 'Activar sonido', settings: 'Ajustes', speed: 'Velocidad',
      normal: 'Normal', enterFullscreen: 'Pantalla completa', exitFullscreen: 'Salir de pantalla completa', pip: 'Ventana flotante',
      currentTime: 'Tiempo actual', duration: 'Duración', volume: 'Volumen', seek: 'Buscar', seekLabel: '{currentTime} de {duration}',
    },
  });
  const element = video.value;
  element.addEventListener('waiting', () => { buffering.value = true; });
  element.addEventListener('stalled', () => { if (!element.paused) buffering.value = true; });
  element.addEventListener('playing', () => { buffering.value = false; });
  element.addEventListener('canplay', () => { buffering.value = false; });
  element.addEventListener('pause', () => { buffering.value = false; });
  element.addEventListener('error', () => { failed.value = true; buffering.value = false; });
}

onMounted(() => {
  attach();
  if (props.start != null) seek(props.start);
});
watch(() => props.src, () => { failed.value = false; buffering.value = false; player?.source && (player.source = { type: 'video', title: props.title, sources: [{ src: props.src, type: props.type }] }); });
onBeforeUnmount(() => { player?.destroy(); player = null; });
</script>

<template>
  <div class="tt-player relative overflow-hidden rounded-xl bg-black">
    <video ref="video" playsinline preload="metadata" crossorigin="anonymous">
      <source :src="src" :type="type" />
      Tu navegador no reproduce este formato.
    </video>
    <div v-if="buffering && !failed" class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
      <BrandMark animated class="h-12 w-12" />
      <span class="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Cargando vídeo…</span>
    </div>
    <div v-if="failed" class="absolute inset-0 flex items-center justify-center bg-black/70 px-6 text-center text-sm text-white">
      No se ha podido reproducir el vídeo. Comprueba que el archivo sea MP4 (H.264) o WebM.
    </div>
  </div>
</template>

<style>
.tt-player {
  --plyr-color-main: var(--t-brand-500);
  --plyr-video-control-color: #fff;
  --plyr-menu-background: var(--t-surface);
  --plyr-menu-color: var(--t-slate-900);
  --plyr-font-family: inherit;
}
.tt-player .plyr {
  border-radius: 0.75rem;
}
.tt-player .plyr--video {
  max-height: 70vh;
}
</style>
