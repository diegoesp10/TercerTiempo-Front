import type { MatchDto, TeamRefDto } from '@/types/api';

/** Escudo de un equipo: la URL que traiga el dato o, si solo hay id, la ruta de la API que lo sirve por id. */
export const crestFor = (crestUrl: string | null | undefined, teamId: string | null | undefined): string | null =>
  crestUrl ?? (teamId ? `/api/teams/${teamId}/crest` : null);

/** El rival de un equipo en un partido (con su escudo). */
export const opponentOf = (match: MatchDto, teamId: string): TeamRefDto =>
  match.homeTeam.id === teamId ? match.awayTeam : match.homeTeam;
