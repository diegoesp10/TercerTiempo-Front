import { http } from './http';
import type { SquadTeamStatsDto, TeamMatchStatsDto, TeamMatchStatsInput } from '@/types/api';

/** Datos del equipo por partido (córners, posesión, tiros…) que apunta el cuerpo técnico de una plantilla. */
export const teamStatsApi = {
  /** Guarda (crea o sobrescribe) los datos del equipo en un partido disputado. Solo el cuerpo técnico. */
  record: (squadId: string, matchId: string, stats: TeamMatchStatsInput) =>
    http<TeamMatchStatsDto>(`/api/squads/${squadId}/matches/${matchId}/team-stats`, { method: 'PUT', body: stats }),
  /** Temporada: partido a partido y en media. Misma visibilidad que la plantilla. */
  season: (squadId: string) => http<SquadTeamStatsDto>(`/api/squads/${squadId}/team-stats`),
};
