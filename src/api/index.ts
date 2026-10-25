import { apiBaseUrl, http } from './http';
import type {
  AccountDto,
  AppointmentDto,
  AuthResponse,
  BeginVideoUploadRequest,
  ClubCatalogDto,
  ClubDto,
  CoachDto,
  CompetitionDto,
  CompetitionMatchdayDto,
  CreateAppointmentRequest,
  InjuryDto,
  InjuryRequest,
  InjuryTypeDto,
  JoinSquadAsPlayerRequest,
  LeagueTableDto,
  BillingInterval,
  LicenseCheckoutDto,
  LicensePlan,
  LicensingCatalogDto,
  LicensingStatusDto,
  LoginRequest,
  MatchDetailDto,
  MatchDto,
  MatchPreviewDto,
  MatchSheetDto,
  MatchSheetEntryInput,
  MatchVideoDto,
  OfficialSheetDto,
  PerformanceWithMatchDto,
  PlayerDashboardDto,
  PlayerDto,
  RegisterRequest,
  ResolveSuggestionRequest,
  RosterEntryDetailDto,
  RosterEntryDto,
  RosterEntryRequest,
  SharedVideoDto,
  SheetComparisonDto,
  SquadDetailDto,
  RegistrationOptionsDto,
  SeasonYearDto,
  CookiePolicyDto,
  ConsentDto,
  ConsentAction,
  ClubInvitationLookupDto,
  SquadInviteDto,
  SquadMatchDto,
  SquadPlayerDto,
  SquadPlayerProfileDto,
  SquadPlayerRequest,
  SquadSeasonTableDto,
  SquadStatsDto,
  SquadSummaryDto,
  SquadTimelineDto,
  SquadVisibility,
  SuggestionDto,
  SuggestPerformanceRequest,
  TeamCrestImportDto,
  TeamDetailDto,
  ClubLicenseDto,
  SearchResultsDto,
  PlayerCardDto,
  SearchType,
  TeamSummaryDto,
  VideoPart,
  VideoShareLinkDto,
  VideoTicketDto,
  VideoUploadDto,
  VideoVisibility,
} from '@/types/api';

/** Listas de referencia (competiciones, catálogo de clubes): cambian con la sincronización diaria, no al navegar. */
const REFERENCE_CACHE_MS = 5 * 60_000;
/** Cálculos de una plantilla que comparten varias pestañas (estadísticas y comparador): cualquier cambio guardado los invalida. */
const SQUAD_READ_CACHE_MS = 30_000;

export const api = {
  privacy: {
    /** Política de cookies vigente con su catálogo. */
    cookies: () => http<CookiePolicyDto>('/api/cookies', { silent: true }),
    consent: (visitorId: string, action: ConsentAction, analytics: boolean) =>
      http<ConsentDto>('/api/cookies/consent', { method: 'POST', body: { visitorId, action, analytics }, silent: true }),
  },
  seasons: {
    /** Temporadas de la app, de la más reciente a la más antigua (la actual marcada). */
    list: () => http<SeasonYearDto[]>('/api/seasons', { silent: true, cacheMs: 300_000 }),
  },
  auth: {
    register: (body: RegisterRequest) => http<AuthResponse>('/api/auth/register', { method: 'POST', body }),
    invite: (inviteCode: string) => http<SquadInviteDto>(`/api/auth/invite/${encodeURIComponent(inviteCode.trim())}`),
    login: (body: LoginRequest) => http<AuthResponse>('/api/auth/login', { method: 'POST', body }),
    me: () => http<AccountDto>('/api/auth/me'),
    /** Si el alta de clubes exige invitación (beta cerrada). */
    registrationOptions: () => http<RegistrationOptionsDto>('/api/auth/registration-options', { silent: true, cacheMs: 300_000 }),
    /** Para qué club es una invitación de la beta (404 si no vale). */
    clubInvitation: (code: string) =>
      http<ClubInvitationLookupDto>(`/api/auth/club-invitation/${encodeURIComponent(code.trim())}`, { silent: true }),
  },

  /** Lo que puede hacer un jugador: vincularse a su ficha y consultar sus números. */
  players: {
    invite: (inviteCode: string) => http<SquadInviteDto>(`/api/players/me/invite/${encodeURIComponent(inviteCode.trim())}`),
    joinSquad: (body: JoinSquadAsPlayerRequest) => http<PlayerDto>('/api/players/me/squad', { method: 'POST', body }),
    leaveSquad: () => http<PlayerDto>('/api/players/me/squad', { method: 'DELETE' }),
    uploadPhoto: (file: File) => {
      const body = new FormData();
      body.append('file', file, file.name);
      return http<PlayerDto>('/api/players/me/photo', { method: 'PUT', body });
    },
    deletePhoto: () => http<PlayerDto>('/api/players/me/photo', { method: 'DELETE' }),
    /** Perfil completo visible para cualquier cuenta con sesión (true) o solo para tu club y tu plantilla (false). */
    setPublicProfile: (isPublic: boolean) => http<PlayerDto>('/api/players/me/public-profile', { method: 'PUT', body: { public: isPublic } }),
    dashboard: () => http<PlayerDashboardDto>('/api/players/me/dashboard'),
    performances: () => http<PerformanceWithMatchDto[]>('/api/players/me/performances'),
    /** Propone corregir o crear su línea del acta de un partido; la decide su club o su cuerpo técnico. */
    suggest: (body: SuggestPerformanceRequest) => http<SuggestionDto>('/api/players/me/suggestions', { method: 'POST', body }),
    suggestions: () => http<SuggestionDto[]>('/api/players/me/suggestions'),
  },

  /** Técnicos con cuenta: canjear los códigos de acceso que les entrega su club. */
  coaches: {
    redeem: (accessCode: string) => http<CoachDto>('/api/coaches/me/appointments/redeem', { method: 'POST', body: { accessCode } }),
  },

  /** Clubes: sus equipos y los nombramientos de sus técnicos. */
  clubs: {
    catalog: (search?: string) => http<ClubCatalogDto[]>(`/api/clubs/catalog${search ? `?search=${encodeURIComponent(search)}` : ''}`, { cacheMs: REFERENCE_CACHE_MS }),
    me: () => http<ClubDto>('/api/clubs/me'),
    addTeam: (teamId: string) => http<ClubDto>('/api/clubs/me/teams', { method: 'POST', body: { teamId } }),
    removeTeam: (teamId: string) => http<ClubDto>(`/api/clubs/me/teams/${teamId}`, { method: 'DELETE' }),
    addRosterEntry: (teamId: string, body: RosterEntryRequest) => http<RosterEntryDto[]>(`/api/clubs/me/teams/${teamId}/roster`, { method: 'POST', body }),
    updateRosterEntry: (teamId: string, entryId: string, body: RosterEntryRequest) =>
      http<RosterEntryDto[]>(`/api/clubs/me/teams/${teamId}/roster/${entryId}`, { method: 'PUT', body }),
    removeRosterEntry: (teamId: string, entryId: string) => http<RosterEntryDto[]>(`/api/clubs/me/teams/${teamId}/roster/${entryId}`, { method: 'DELETE' }),
    rosterEntry: (teamId: string, entryId: string) => http<RosterEntryDetailDto>(`/api/clubs/me/teams/${teamId}/roster/${entryId}`),
    uploadRosterPhoto: (teamId: string, entryId: string, file: File) => {
      const body = new FormData();
      body.append('file', file);
      return http<RosterEntryDto[]>(`/api/clubs/me/teams/${teamId}/roster/${entryId}/photo`, { method: 'PUT', body });
    },
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
    generatePlayerInviteCode: (squadId: string, squadPlayerId: string) =>
      http<SquadDetailDto>(`/api/squads/${squadId}/players/${squadPlayerId}/invite-code`, { method: 'POST' }),
    matches: (squadId: string) => http<SquadMatchDto[]>(`/api/squads/${squadId}/matches`),
    sheet: (squadId: string, matchId: string) => http<MatchSheetDto>(`/api/squads/${squadId}/matches/${matchId}/sheet`),
    recordSheet: (squadId: string, matchId: string, entries: MatchSheetEntryInput[]) =>
      http<MatchSheetDto>(`/api/squads/${squadId}/matches/${matchId}/sheet`, { method: 'PUT', body: { entries } }),
    /** Compara con el acta guardada; las descargas pendientes las gestiona el backend. */
    compareSheet: (squadId: string, matchId: string) =>
      http<SheetComparisonDto>(`/api/squads/${squadId}/matches/${matchId}/sheet/comparison`),
    uploadVideo: (squadId: string, matchId: string, file: File, title: string | null, part: VideoPart = 'Full') => {
      const body = new FormData();
      body.append('file', file, file.name);
      body.append('part', part);
      if (title) body.append('title', title);
      return http<MatchVideoDto>(`/api/squads/${squadId}/matches/${matchId}/video`, { method: 'POST', body });
    },
    /** Subida por trozos: begin → uploadVideoChunk (api/videoUpload.ts) en orden → complete. */
    beginVideoUpload: (squadId: string, matchId: string, body: BeginVideoUploadRequest) =>
      http<VideoUploadDto>(`/api/squads/${squadId}/matches/${matchId}/video/uploads`, { method: 'POST', body }),
    videoUpload: (squadId: string, uploadId: string) => http<VideoUploadDto>(`/api/squads/${squadId}/video-uploads/${uploadId}`),
    completeVideoUpload: (squadId: string, uploadId: string) => http<MatchVideoDto>(`/api/squads/${squadId}/video-uploads/${uploadId}/complete`, { method: 'POST' }),
    cancelVideoUpload: (squadId: string, uploadId: string) => http<boolean>(`/api/squads/${squadId}/video-uploads/${uploadId}`, { method: 'DELETE' }),
    stats: (squadId: string) => http<SquadStatsDto>(`/api/squads/${squadId}/stats`, { cacheMs: SQUAD_READ_CACHE_MS }),
    seasonTable: (squadId: string) => http<SquadSeasonTableDto>(`/api/squads/${squadId}/season-table`, { cacheMs: SQUAD_READ_CACHE_MS }),
    suggestions: (squadId: string) => http<SuggestionDto[]>(`/api/squads/${squadId}/suggestions`),
    resolveSuggestion: (squadId: string, suggestionId: string, body: ResolveSuggestionRequest) =>
      http<SuggestionDto[]>(`/api/squads/${squadId}/suggestions/${suggestionId}/resolve`, { method: 'POST', body }),
    playerProfile: (squadId: string, squadPlayerId: string) =>
      http<SquadPlayerProfileDto>(`/api/squads/${squadId}/players/${squadPlayerId}/profile`),
    timeline: (squadId: string) => http<SquadTimelineDto>(`/api/squads/${squadId}/timeline`, { cacheMs: SQUAD_READ_CACHE_MS }),
    injuryTypes: () => http<InjuryTypeDto[]>('/api/squads/injury-types', { cacheMs: 60 * 60_000 }),
    injuries: (squadId: string) => http<InjuryDto[]>(`/api/squads/${squadId}/injuries`),
    recordInjury: (squadId: string, body: InjuryRequest) => http<InjuryDto[]>(`/api/squads/${squadId}/injuries`, { method: 'POST', body }),
    updateInjury: (squadId: string, injuryId: string, body: InjuryRequest) => http<InjuryDto[]>(`/api/squads/${squadId}/injuries/${injuryId}`, { method: 'PUT', body }),
    closeInjury: (squadId: string, injuryId: string, returnedOn: string | null) =>
      http<InjuryDto[]>(`/api/squads/${squadId}/injuries/${injuryId}/close`, { method: 'POST', body: { returnedOn } }),
    reopenInjury: (squadId: string, injuryId: string) => http<InjuryDto[]>(`/api/squads/${squadId}/injuries/${injuryId}/reopen`, { method: 'POST' }),
    deleteInjury: (squadId: string, injuryId: string) => http<InjuryDto[]>(`/api/squads/${squadId}/injuries/${injuryId}`, { method: 'DELETE' }),
  },

  /** Buscador de toda la app (ligas, equipos, clubes, jugadores, partidos y tus plantillas); solo con sesión. */
  search: {
    query: (q: string, type: SearchType | null = null, limit = 6) =>
      http<SearchResultsDto>(`/api/search?q=${encodeURIComponent(q)}&limit=${limit}${type ? `&type=${type}` : ''}`, { silent: true, cacheMs: 30_000 }),
  },

  /** Licencia del club (primer equipo y filiales): estado de la cuenta, la licencia del club y pago (simulado de momento). */
  licensing: {
    status: () => http<LicensingStatusDto>('/api/licensing/status', { silent: true }),
    club: () => http<ClubLicenseDto>('/api/licensing/club'),
    /** Planes y precios (público). */
    plans: () => http<LicensingCatalogDto>('/api/licensing/plans', { silent: true }),
    beginCheckout: (plan: LicensePlan, interval: BillingInterval) =>
      http<LicenseCheckoutDto>('/api/licensing/club/checkout', { method: 'POST', body: { plan, interval } }),
    checkout: (sessionId: string) => http<LicenseCheckoutDto>(`/api/licensing/checkout/${encodeURIComponent(sessionId)}`),
    confirm: (sessionId: string) => http<ClubLicenseDto>(`/api/licensing/checkout/${encodeURIComponent(sessionId)}/confirm`, { method: 'POST' }),
    /** Plan o facturación para la próxima renovación (durante la prueba, ya). */
    changeRenewal: (plan: LicensePlan, interval: BillingInterval) =>
      http<ClubLicenseDto>('/api/licensing/club/renewal', { method: 'PUT', body: { plan, interval } }),
    cancelRenewal: () => http<ClubLicenseDto>('/api/licensing/club/renewal/cancel', { method: 'POST' }),
    resumeRenewal: () => http<ClubLicenseDto>('/api/licensing/club/renewal/resume', { method: 'POST' }),
  },

  competitions: {
    list: () => http<CompetitionDto[]>('/api/competitions', { cacheMs: REFERENCE_CACHE_MS }),
    /** Partidos de una jornada; sin número, la jornada en curso o la próxima. */
    matchday: (competitionId: string, matchday?: number | null) =>
      http<CompetitionMatchdayDto>(`/api/competitions/${competitionId}/matchdays/${matchday ?? 'current'}`),
  },
  teams: {
    list: (competitionId: string) => http<TeamSummaryDto[]>(`/api/teams?competitionId=${encodeURIComponent(competitionId)}`),
    /** Ficha de un jugador (con sesión): la básica siempre; la completa si es de tu club o la ha hecho pública. */
    playerCard: (teamId: string, entryId: string) => http<PlayerCardDto>(`/api/teams/${teamId}/roster/${entryId}`),
    get: (teamId: string) => http<TeamDetailDto>(`/api/teams/${teamId}`),
    matches: (teamId: string) => http<MatchDto[]>(`/api/teams/${teamId}/matches`),
  },
  matches: {
    get: (matchId: string) => http<MatchDetailDto>(`/api/matches/${matchId}`),
    /** Acta pública del partido, de la federación (o por qué aún no está). */
    officialSheet: (matchId: string) =>
      http<OfficialSheetDto>(`/api/matches/${matchId}/official-sheet`),
    videos: (matchId: string) => http<MatchVideoDto[]>(`/api/matches/${matchId}/videos`),
    /** Previa con probabilidades y análisis del rival (solo cuerpo técnico). */
    preview: (matchId: string) => http<MatchPreviewDto>(`/api/matches/${matchId}/preview`),
  },
  videos: {
    purchase: (videoId: string) => http<MatchVideoDto>(`/api/videos/${videoId}/purchase`, { method: 'POST' }),
    ticket: (videoId: string) => http<VideoTicketDto>(`/api/videos/${videoId}/ticket`, { method: 'POST' }),
    remove: (videoId: string) => http<boolean>(`/api/videos/${videoId}`, { method: 'DELETE' }),
    /** URL que se pasa al reproductor (el ticket sustituye al JWT). */
    streamUrl: (ticket: VideoTicketDto) => `${apiBaseUrl}/api/videos/${ticket.videoId}/stream?ticket=${encodeURIComponent(ticket.ticket)}`,
    setVisibility: (videoId: string, visibility: VideoVisibility) => http<MatchVideoDto>(`/api/videos/${videoId}/visibility`, { method: 'PUT', body: { visibility } }),
    createShare: (videoId: string, expiresInHours: number | null) => http<VideoShareLinkDto>(`/api/videos/${videoId}/shares`, { method: 'POST', body: { expiresInHours } }),
    shares: (videoId: string) => http<VideoShareLinkDto[]>(`/api/videos/${videoId}/shares`),
    revokeShare: (videoId: string, linkId: string) => http<VideoShareLinkDto[]>(`/api/videos/${videoId}/shares/${linkId}`, { method: 'DELETE' }),
    /** Visor público por enlace compartido (sin sesión). */
    shared: (token: string) => http<SharedVideoDto>(`/api/videos/shared/${encodeURIComponent(token)}`),
    sharedStreamUrl: (token: string) => `${apiBaseUrl}/api/videos/shared/${encodeURIComponent(token)}/stream`,
  },
  stats: {
    leagueTable: (competitionId?: string | null) =>
      http<LeagueTableDto>(competitionId ? `/api/league/table?competitionId=${encodeURIComponent(competitionId)}` : '/api/league/table'),
  },
};
