import { computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

/** Grupo con el que aparecen arriba, en los buscadores, las competiciones de tus equipos. */
export const MY_CLUB_GROUP = 'Tu club';

/**
 * Tu club en buscadores y clasificaciones: sus competiciones se abren por defecto y van las primeras, y sus equipos se
 * distinguen siempre. Con el ajuste «Mi club primero» desactivado solo se mantiene el resaltado.
 */
export function useMyClub() {
  const auth = useAuthStore();
  const settings = useSettingsStore();

  const competitionIds = computed(() => (settings.myClubFirst ? auth.myCompetitionIds : []));

  /** Competición de tu club entre las disponibles (la principal primero), o null. */
  const preferredCompetition = <T extends { id: string }>(available: readonly T[]) =>
    competitionIds.value.map((id) => available.find((c) => c.id === id)).find((c): c is T => !!c)?.id ?? null;

  /** Opciones de un buscador con las competiciones de tu club arriba, agrupadas como «Tu club». */
  const withMyClubFirst = <T extends { value: string; group?: string }>(options: readonly T[]): T[] => {
    const mine = competitionIds.value
      .map((id) => options.find((o) => o.value === id))
      .filter((o): o is T => !!o)
      .map((o) => ({ ...o, group: MY_CLUB_GROUP }));
    return [...mine, ...options.filter((o) => !competitionIds.value.includes(o.value))];
  };

  const isMine = (teamId: string) => auth.isMyTeam(teamId);

  return { preferredCompetition, withMyClubFirst, isMine, myTeamIds: computed(() => auth.myTeamIds) };
}
