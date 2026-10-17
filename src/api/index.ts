import { http } from './http';
import type {
  AuthResponse,
  CompetitionDto,
  JoinTeamRequest,
  LeagueTableDto,
  LoginRequest,
  MatchDetailDto,
  MatchDto,
  PerformanceDto,
  PerformanceStats,
  PerformanceWithMatchDto,
  PlayerDashboardDto,
  PlayerDto,
  RegisterRequest,
  SyncResultDto,
  TeamDetailDto,
  TeamSummaryDto,
} from '@/types/api';

export const api = {
  auth: {
    register: (body: RegisterRequest) => http<AuthResponse>('/api/auth/register', { method: 'POST', body }),
    login: (body: LoginRequest) => http<AuthResponse>('/api/auth/login', { method: 'POST', body }),
  },
  players: {
    me: () => http<PlayerDto>('/api/players/me'),
    joinTeam: (body: JoinTeamRequest) => http<PlayerDto>('/api/players/me/team', { method: 'POST', body }),
    leaveTeam: () => http<PlayerDto>('/api/players/me/team', { method: 'DELETE' }),
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
    logPerformance: (matchId: string, body: PerformanceStats) =>
      http<PerformanceDto>(`/api/matches/${matchId}/performance`, { method: 'PUT', body }),
  },
  performances: {
    mine: () => http<PerformanceWithMatchDto[]>('/api/performances/me'),
  },
  stats: {
    dashboard: () => http<PlayerDashboardDto>('/api/stats/dashboard'),
    leagueTable: (competitionId?: string | null) =>
      http<LeagueTableDto>(competitionId ? `/api/league/table?competitionId=${encodeURIComponent(competitionId)}` : '/api/league/table'),
  },
  admin: {
    sync: () => http<SyncResultDto>('/api/admin/sync', { method: 'POST' }),
  },
};
