import { http } from './http';
import type {
  AccountDto,
  AuthResponse,
  CompetitionDto,
  JoinSquadAsPlayerRequest,
  JoinSquadStaffRequest,
  LeagueTableDto,
  LoginRequest,
  MatchDetailDto,
  MatchDto,
  MatchSheetDto,
  MatchSheetEntryInput,
  PerformanceWithMatchDto,
  PlayerDashboardDto,
  PlayerDto,
  RegisterRequest,
  SquadDetailDto,
  SquadInviteDto,
  SquadMatchDto,
  SquadPlayerDto,
  SquadPlayerRequest,
  SquadStatsDto,
  SquadSummaryDto,
  SquadVisibility,
  SyncResultDto,
  TeamDetailDto,
  TeamSummaryDto,
} from '@/types/api';

export const api = {
  auth: {
    register: (body: RegisterRequest) => http<AuthResponse>('/api/auth/register', { method: 'POST', body }),
    login: (body: LoginRequest) => http<AuthResponse>('/api/auth/login', { method: 'POST', body }),
    me: () => http<AccountDto>('/api/auth/me'),
  },

  /** Lo que puede hacer un jugador: vincularse a su ficha y consultar sus números. */
  players: {
    invite: (inviteCode: string) => http<SquadInviteDto>(`/api/players/me/invite/${encodeURIComponent(inviteCode.trim())}`),
    joinSquad: (body: JoinSquadAsPlayerRequest) => http<PlayerDto>('/api/players/me/squad', { method: 'POST', body }),
    leaveSquad: () => http<PlayerDto>('/api/players/me/squad', { method: 'DELETE' }),
    dashboard: () => http<PlayerDashboardDto>('/api/players/me/dashboard'),
    performances: () => http<PerformanceWithMatchDto[]>('/api/players/me/performances'),
  },

  /** Gestión de plantillas por el cuerpo técnico (las lecturas también valen para jugadores vinculados y plantillas públicas). */
  squads: {
    claim: (teamId: string) => http<SquadDetailDto>('/api/squads', { method: 'POST', body: { teamId } }),
    joinStaff: (body: JoinSquadStaffRequest) => http<SquadDetailDto>('/api/squads/join', { method: 'POST', body }),
    mine: () => http<SquadSummaryDto[]>('/api/squads/mine'),
    get: (squadId: string) => http<SquadDetailDto>(`/api/squads/${squadId}`),
    addPlayer: (squadId: string, body: SquadPlayerRequest) =>
      http<SquadPlayerDto>(`/api/squads/${squadId}/players`, { method: 'POST', body }),
    updatePlayer: (squadId: string, squadPlayerId: string, body: SquadPlayerRequest) =>
      http<SquadPlayerDto>(`/api/squads/${squadId}/players/${squadPlayerId}`, { method: 'PUT', body }),
    removePlayer: (squadId: string, squadPlayerId: string) =>
      http<SquadPlayerDto>(`/api/squads/${squadId}/players/${squadPlayerId}`, { method: 'DELETE' }),
    importRoster: (squadId: string) => http<SquadDetailDto>(`/api/squads/${squadId}/players/import`, { method: 'POST' }),
    setVisibility: (squadId: string, visibility: SquadVisibility) =>
      http<SquadDetailDto>(`/api/squads/${squadId}/visibility`, { method: 'PUT', body: { visibility } }),
    rotateInviteCode: (squadId: string) => http<SquadDetailDto>(`/api/squads/${squadId}/invite-code`, { method: 'POST' }),
    matches: (squadId: string) => http<SquadMatchDto[]>(`/api/squads/${squadId}/matches`),
    sheet: (squadId: string, matchId: string) => http<MatchSheetDto>(`/api/squads/${squadId}/matches/${matchId}/sheet`),
    recordSheet: (squadId: string, matchId: string, entries: MatchSheetEntryInput[]) =>
      http<MatchSheetDto>(`/api/squads/${squadId}/matches/${matchId}/sheet`, { method: 'PUT', body: { entries } }),
    stats: (squadId: string) => http<SquadStatsDto>(`/api/squads/${squadId}/stats`),
  },

  competitions: {
    list: () => http<CompetitionDto[]>('/api/competitions'),
  },
  teams: {
    list: (competitionId: string) => http<TeamSummaryDto[]>(`/api/teams?competitionId=${encodeURIComponent(competitionId)}`),
    get: (teamId: string) => http<TeamDetailDto>(`/api/teams/${teamId}`),
    matches: (teamId: string) => http<MatchDto[]>(`/api/teams/${teamId}/matches`),
  },
  matches: {
    get: (matchId: string) => http<MatchDetailDto>(`/api/matches/${matchId}`),
  },
  stats: {
    leagueTable: (competitionId?: string | null) =>
      http<LeagueTableDto>(competitionId ? `/api/league/table?competitionId=${encodeURIComponent(competitionId)}` : '/api/league/table'),
  },
  admin: {
    sync: () => http<SyncResultDto>('/api/admin/sync', { method: 'POST' }),
  },
};
