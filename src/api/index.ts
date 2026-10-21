import { apiBaseUrl, http } from './http';
import type {
  AccountDto,
  AppointmentDto,
  AuthResponse,
  ClubCatalogDto,
  ClubDto,
  TeamCrestImportDto,
  CoachDto,
  CompetitionDto,
  CompetitionMatchdayDto,
  CreateAppointmentRequest,
  JoinSquadAsPlayerRequest,
  LeagueTableDto,
  LoginRequest,
  MatchDetailDto,
  MatchDto,
  MatchSheetDto,
  MatchSheetEntryInput,
  MatchVideoDto,
  OfficialSheetDto,
  PerformanceWithMatchDto,
  PlayerDashboardDto,
  PlayerDto,
  RegisterRequest,
  SheetComparisonDto,
  SquadDetailDto,
  SquadInviteDto,
  SquadMatchDto,
  SquadPlayerDto,
  SquadPlayerProfileDto,
  SquadPlayerRequest,
  SquadStatsDto,
  SquadSummaryDto,
  SquadTimelineDto,
  SquadVisibility,
  SyncResultDto,
  TeamDetailDto,
  TeamSummaryDto,
  VideoTicketDto,
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

  /** Técnicos con cuenta: canjear los códigos de acceso que les entrega su club. */
  coaches: {
    redeem: (accessCode: string) => http<CoachDto>('/api/coaches/me/appointments/redeem', { method: 'POST', body: { accessCode } }),
  },

  /** Clubes: sus equipos y los nombramientos de sus técnicos. */
  clubs: {
    catalog: (search?: string) => http<ClubCatalogDto[]>(`/api/clubs/catalog${search ? `?search=${encodeURIComponent(search)}` : ''}`),
    me: () => http<ClubDto>('/api/clubs/me'),
    addTeam: (teamId: string) => http<ClubDto>('/api/clubs/me/teams', { method: 'POST', body: { teamId } }),
    removeTeam: (teamId: string) => http<ClubDto>(`/api/clubs/me/teams/${teamId}`, { method: 'DELETE' }),
    uploadTeamCrest: (teamId: string, file: File) => {
      const body = new FormData();
      body.append('file', file);
      return http<TeamCrestImportDto>(`/api/clubs/me/teams/${teamId}/crest`, { method: 'PUT', body });
    },
    createAppointment: (body: CreateAppointmentRequest) => http<AppointmentDto>('/api/clubs/me/appointments', { method: 'POST', body }),
    updateAppointment: (appointmentId: string, validUntil: string) =>
      http<AppointmentDto>(`/api/clubs/me/appointments/${appointmentId}`, { method: 'PUT', body: { validUntil } }),
    revokeAppointment: (appointmentId: string) => http<AppointmentDto>(`/api/clubs/me/appointments/${appointmentId}`, { method: 'DELETE' }),
  },

  /** Gestión de plantillas por el cuerpo técnico (las lecturas también valen para jugadores vinculados y plantillas públicas). */
  squads: {
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
    /** Acta interna frente al acta oficial; con refresh se vuelve a pedir a la federación. */
    compareSheet: (squadId: string, matchId: string, refresh = false) =>
      http<SheetComparisonDto>(`/api/squads/${squadId}/matches/${matchId}/sheet/comparison${refresh ? '?refresh=true' : ''}`),
    uploadVideo: (squadId: string, matchId: string, file: File, title: string | null) => {
      const body = new FormData();
      body.append('file', file, file.name);
      if (title) body.append('title', title);
      return http<MatchVideoDto>(`/api/squads/${squadId}/matches/${matchId}/video`, { method: 'POST', body });
    },
    stats: (squadId: string) => http<SquadStatsDto>(`/api/squads/${squadId}/stats`),
    playerProfile: (squadId: string, squadPlayerId: string) =>
      http<SquadPlayerProfileDto>(`/api/squads/${squadId}/players/${squadPlayerId}/profile`),
    timeline: (squadId: string) => http<SquadTimelineDto>(`/api/squads/${squadId}/timeline`),
  },

  competitions: {
    list: () => http<CompetitionDto[]>('/api/competitions'),
    /** Partidos de una jornada; sin número, la jornada en curso o la próxima. */
    matchday: (competitionId: string, matchday?: number | null) =>
      http<CompetitionMatchdayDto>(`/api/competitions/${competitionId}/matchdays/${matchday ?? 'current'}`),
  },
  teams: {
    list: (competitionId: string) => http<TeamSummaryDto[]>(`/api/teams?competitionId=${encodeURIComponent(competitionId)}`),
    get: (teamId: string) => http<TeamDetailDto>(`/api/teams/${teamId}`),
    matches: (teamId: string) => http<MatchDto[]>(`/api/teams/${teamId}/matches`),
  },
  matches: {
    get: (matchId: string) => http<MatchDetailDto>(`/api/matches/${matchId}`),
    /** Acta oficial de la federación (o por qué aún no está). */
    officialSheet: (matchId: string, refresh = false) =>
      http<OfficialSheetDto>(`/api/matches/${matchId}/official-sheet${refresh ? '?refresh=true' : ''}`),
    videos: (matchId: string) => http<MatchVideoDto[]>(`/api/matches/${matchId}/videos`),
  },
  videos: {
    purchase: (videoId: string) => http<MatchVideoDto>(`/api/videos/${videoId}/purchase`, { method: 'POST' }),
    ticket: (videoId: string) => http<VideoTicketDto>(`/api/videos/${videoId}/ticket`, { method: 'POST' }),
    remove: (videoId: string) => http<boolean>(`/api/videos/${videoId}`, { method: 'DELETE' }),
    /** URL que se pasa al reproductor (el ticket sustituye al JWT). */
    streamUrl: (ticket: VideoTicketDto) => `${apiBaseUrl}/api/videos/${ticket.videoId}/stream?ticket=${encodeURIComponent(ticket.ticket)}`,
  },
  stats: {
    leagueTable: (competitionId?: string | null) =>
      http<LeagueTableDto>(competitionId ? `/api/league/table?competitionId=${encodeURIComponent(competitionId)}` : '/api/league/table'),
  },
  admin: {
    sync: () => http<SyncResultDto>('/api/admin/sync', { method: 'POST' }),
  },
};
