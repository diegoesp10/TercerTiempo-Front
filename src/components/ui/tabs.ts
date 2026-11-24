import type { RouteLocationRaw } from 'vue-router';

export interface TabItem {
  key: string;
  label: string;
  // Etiqueta corta: si las largas no caben, se prueba con estas antes de plegar las pestañas en un menú.
  short?: string;
  // Con destino, la pestaña navega; sin él, cambia la vista (v-model).
  to?: RouteLocationRaw;
  icon?: string;
  count?: number | string | null;
  title?: string;
  // Color propio (el de su serie en un gráfico): fondo de la pestaña elegida y punto en el menú plegado.
  color?: string;
}
