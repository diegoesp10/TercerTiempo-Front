import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue';

export type SortValue = number | string | null | undefined;

const empty = (value: SortValue) => value === null || value === undefined || value === '';

/**
 * Orden de una tabla por columnas: un clic ordena por esa columna (de mayor a menor, salvo las de texto, que empiezan
 * por la A) y el siguiente le da la vuelta. Lo que no tiene dato va siempre al final, y a igualdad se respeta el orden
 * de partida.
 */
export function useSort<T, K extends string>(
  rows: { readonly value: T[] },
  getters: MaybeRefOrGetter<Record<K, (row: T) => SortValue>>,
  initial: K,
  options: { desc?: boolean; ascendingFirst?: K[] } = {},
) {
  const sortKey = ref(initial) as Ref<K>;
  const sortDesc = ref(options.desc ?? true);

  function sortBy(key: K) {
    if (sortKey.value === key) {
      sortDesc.value = !sortDesc.value;
    } else {
      sortKey.value = key;
      sortDesc.value = !(options.ascendingFirst ?? []).includes(key);
    }
  }

  const sorted = computed(() => {
    const get = toValue(getters)[sortKey.value] ?? (() => null);
    return rows.value
      .map((row, index) => ({ row, index, value: get(row) }))
      .sort((a, b) => {
        if (empty(a.value) || empty(b.value)) return empty(a.value) === empty(b.value) ? a.index - b.index : empty(a.value) ? 1 : -1;
        const cmp =
          typeof a.value === 'number' && typeof b.value === 'number' ? a.value - b.value : String(a.value).localeCompare(String(b.value), 'es');
        return (sortDesc.value ? -cmp : cmp) || a.index - b.index;
      })
      .map((entry) => entry.row);
  });

  /** Para `v-bind` en `SortHeader`: si es la columna activa y en qué sentido. */
  const state = (key: K) => ({ active: sortKey.value === key, desc: sortDesc.value });

  return { sortKey, sortDesc, sorted, sortBy, state };
}
