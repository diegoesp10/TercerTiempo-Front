<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>();

/**
 * Lo que se puede hacer hoy en la app, de lo público a lo de cada plantilla. Es el escaparate de las pantallas de
 * acceso: cada función nueva que llegue a la app tiene aquí su línea.
 */
const features = [
  { icon: 'table-list', title: 'Las ligas, al día', text: 'Jornadas, clasificación y actas oficiales.' },
  { icon: 'arrow-trend-up', title: 'Previsor y previa', text: 'Cómo acabará la liga y cómo llega tu rival.' },
  { icon: 'clipboard-list', title: 'Actas de cada partido', text: 'Minutos, goles, tarjetas y nota de cada uno.' },
  { icon: 'chart-line', title: 'Estadísticas y comparador', text: 'La temporada de tu plantilla, jugador a jugador.' },
  { icon: 'video', title: 'Vídeo y análisis', text: 'Sube el partido y se analiza solo.' },
  { icon: 'calendar-check', title: 'Agenda y convocatorias', text: 'Calendario y convocatorias con visto.' },
  { icon: 'user-injured', title: 'Plantilla y lesiones', text: 'Fichas, fotos, bajas y jugadores a prueba.' },
  { icon: 'flag', title: 'Árbitros', text: 'Tu nota a quien pita y las de los demás.' },
  { icon: 'ticket', title: 'Pases de partido', text: 'Abre un partido a quien tú decidas.' },
];
</script>

<template>
  <!-- Pantallas de acceso: titular y lo que ofrece la app a la izquierda, formulario a la derecha. La lista se reparte
       por el alto que deje el formulario: junta en «Entrar» y desahogada en «Darme de alta», sin hueco en medio. -->
  <div class="mx-auto mt-4 grid grid-cols-1 max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:grid-cols-5">
    <aside class="auth-aside relative hidden overflow-hidden p-8 text-white lg:col-span-2 lg:flex lg:flex-col xl:p-10">
      <div>
        <p class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Tercer Tiempo</p>
        <h2 class="mt-3 text-3xl font-bold leading-[1.05] tracking-tight text-white">{{ title }}</h2>
        <p class="mt-3 text-sm leading-relaxed text-white/70">{{ subtitle }}</p>
      </div>
      <ul class="mt-8 flex flex-1 flex-col justify-between gap-3">
        <li v-for="f in features" :key="f.title" class="flex items-center gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon :icon="f.icon" class="h-3.5 w-3.5 text-white" /></span>
          <span class="min-w-0">
            <span class="block text-sm font-semibold leading-tight text-white">{{ f.title }}</span>
            <span class="block text-xs leading-snug text-white/65">{{ f.text }}</span>
          </span>
        </li>
      </ul>
    </aside>
    <div class="p-6 sm:p-8 lg:col-span-3 lg:flex lg:flex-col lg:justify-center">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-aside {
  background: linear-gradient(160deg, #10306f 0%, #0b2152 55%, #081a42 100%);
}
</style>
