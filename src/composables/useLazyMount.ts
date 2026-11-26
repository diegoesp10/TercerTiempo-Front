import { ref, watch, type Ref, type WatchSource } from 'vue';

// Una ventana que todavía no se ha abierto no se monta, y así su código (asíncrono) no se descarga con la página. La
// primera vez que se abre se monta y ya se queda: al cerrarla sigue saliendo con su animación.
export function useLazyMount(open: WatchSource<boolean>): Ref<boolean> {
  const mounted = ref(false);
  watch(open, (value) => { if (value) mounted.value = true; }, { immediate: true });
  return mounted;
}
