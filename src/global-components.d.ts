import type { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

declare module 'vue' {
  export interface GlobalComponents {
    /** Icono de Font Awesome registrado en src/icons.ts (ver main.ts). */
    Icon: typeof FontAwesomeIcon;
  }
}

export {};
