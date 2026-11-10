import { computed, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { useMyClub } from '@/composables/useMyClub';
import type { CompetitionDto } from '@/types/api';
import { groupByLevel, levelLabels } from '@/utils/format';

const STORAGE_KEY = 'tt.home-competition';

// Compartida por los bloques de la portada (jornada, previsor, árbitros): cambiar la liga en uno la cambia en todos.
const competitions = shallowRef<CompetitionDto[]>([]);
const selectedId = ref<string | null>(null);
const ready = ref(false);
let request: Promise<void> | null = null;

/**
 * La liga que enseña la portada. Al abrir, la de tu club (si el ajuste está activo); si no, la última que se vio en
 * este dispositivo; si no, la primera.
 */
export function useHomeCompetition() {
  const { preferredCompetition, withMyClubFirst } = useMyClub();

  if (!request) {
    request = api.competitions
      .list()
      .then((list) => {
        competitions.value = list;
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(STORAGE_KEY);
        } catch { /* sin almacenamiento local: se empieza por la primera */ }
        selectedId.value = preferredCompetition(list)
          ?? list.find((c) => c.id === saved)?.id
          ?? [...list].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id
          ?? null;
      })
      .catch(() => {
        request = null;
      })
      .finally(() => {
        ready.value = true;
      });
  }

  const options = computed(() =>
    withMyClubFirst(groupByLevel(competitions.value).flatMap((group) => group.competitions.map((c) => ({ value: c.id, label: c.name, group: levelLabels[group.level] })))),
  );
  const competition = computed(() => competitions.value.find((c) => c.id === selectedId.value) ?? null);

  function select(id: string | null) {
    selectedId.value = id;
    if (!id) return;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch { /* sin almacenamiento local: se vuelve a la primera la próxima vez */ }
  }

  return { competitions, competition, options, selectedId, ready, select };
}
