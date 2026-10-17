// Tipos espejo de los DTOs de la API (TercerTiempo.Application). Los enums viajan como string.

export type AccountType = 'Player' | 'Coach';
export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward';
export type MatchStatus = 'Scheduled' | 'InProgress' | 'Played' | 'Postponed' | 'Cancelled';
export type CompetitionLevel = 'Professional' | 'National' | 'Regional' | 'Cup' | 'Youth' | 'Other';
export type SquadVisibility = 'Private' | 'Public';
export type StaffRole = 'HeadCoach' | 'AssistantCoach' | 'Delegate' | 'Physio' | 'Analyst' | 'Other';
export type SquadPlayerStatus = 'Active' | 'Left';

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

// --- Cuentas ---

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  accountType: AccountType;
  position: Position | null;
  birthDate: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Plantilla a la que está vinculado un jugador. */
export interface PlayerSquadDto {
  squadId: string;
  squadPlayerId: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamCrestUrl: string | null;
  competitionId: string;
  competitionName: string;
  competitionLevel: CompetitionLevel;
  seasonId: string;
  seasonLabel: string;
  shirtNumber: number | null;
  visibility: SquadVisibility;
}

export interface PlayerDto {
  id: string;
  displayName: string;
  position: Position;
  birthDate: string | null;
  squad: PlayerSquadDto | null;
}

export interface SquadSummaryDto {
  id: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamCrestUrl: string | null;
  competitionId: string;
  competitionName: string;
  competitionLevel: CompetitionLevel;
  seasonId: string;
  seasonLabel: string;
  visibility: SquadVisibility;
  playersCount: number;
  staffCount: number;
  /** Rol del técnico autenticado en esta plantilla (null si no forma parte del staff). */
  myRole: StaffRole | null;
}

export interface CoachDto {
  id: string;
  displayName: string;
  squads: SquadSummaryDto[];
}

export interface AccountDto {
  type: AccountType;
  player: PlayerDto | null;
  coach: CoachDto | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  account: AccountDto;
}

// --- Plantillas ---

export interface SquadStaffDto {
  coachId: string;
  displayName: string;
  role: StaffRole;
  joinedAt: string;
}

/** Ficha de un jugador dentro de la plantilla (venga del proveedor o añadida a mano). */
export interface SquadPlayerDto {
  id: string;
  fullName: string;
  position: Position | null;
  shirtNumber: number | null;
  fromRoster: boolean;
  linked: boolean;
  linkedPlayerName: string | null;
  status: SquadPlayerStatus;
}

export interface SquadDetailDto {
  summary: SquadSummaryDto;
  /** Solo se devuelve al cuerpo técnico. */
  inviteCode: string | null;
  canManage: boolean;
  staff: SquadStaffDto[];
  players: SquadPlayerDto[];
}

export interface SquadPlayerRequest {
  fullName: string;
  position: Position | null;
  shirtNumber: number | null;
}

export interface JoinSquadStaffRequest {
  inviteCode: string;
  role: StaffRole;
}

export interface JoinSquadAsPlayerRequest {
  inviteCode: string;
  squadPlayerId: string | null;
}

export interface SquadInviteDto {
  squadId: string;
  teamName: string;
  competitionName: string;
  seasonLabel: string;
  unlinkedPlayers: SquadPlayerDto[];
}

export interface SquadMatchDto {
  match: MatchDto;
  entriesRecorded: number;
}

export interface MatchSheetEntryDto {
  player: SquadPlayerDto;
  performance: PerformanceDto | null;
}

export interface MatchSheetDto {
  squad: SquadSummaryDto;
  match: MatchDto;
  canEdit: boolean;
  entries: MatchSheetEntryDto[];
}

/** Línea del acta tal y como se envía: con played = false se borra la línea si existía. */
export interface MatchSheetEntryInput extends PerformanceStats {
  squadPlayerId: string;
  played: boolean;
}

export interface SquadPlayerStatsDto {
  player: SquadPlayerDto;
  stats: IndividualStatsDto;
  impact: TeamImpactDto;
}

export interface SquadStatsDto {
  squad: SquadSummaryDto;
  teamMatchesPlayed: number;
  matchesRecorded: number;
  players: SquadPlayerStatsDto[];
}

// --- Competiciones / equipos ---

export interface CompetitionDto {
  id: string;
  name: string;
  category: string;
  level: CompetitionLevel;
  tier: number;
  group: string | null;
  region: string;
  sortOrder: number;
  currentSeasonId: string | null;
  currentSeasonLabel: string | null;
  teamsCount: number;
}

export interface SeasonDto {
  id: string;
  label: string;
  competitionId: string;
  competitionName: string;
  level: CompetitionLevel;
  region: string;
  startsOn: string;
  endsOn: string;
}

export interface StandingDto {
  position: number;
  teamId: string;
  teamName: string;
  teamShortName: string;
  crestUrl: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TeamSummaryDto {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
  competitionId: string;
  competitionName: string;
  position: number | null;
  played: number | null;
  points: number | null;
}

/** Jugador de la plantilla según el proveedor externo. */
export interface RosterEntryDto {
  id: string;
  fullName: string;
  position: Position | null;
  shirtNumber: number | null;
}

/** Plantilla gestionada en Tercer Tiempo para el equipo en la temporada actual, si existe. */
export interface TeamSquadDto {
  squadId: string;
  visibility: SquadVisibility;
  playersCount: number;
  staffCount: number;
  canView: boolean;
  isMine: boolean;
}

export interface TeamDetailDto {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
  season: SeasonDto;
  standing: StandingDto | null;
  rosterPublished: boolean;
  roster: RosterEntryDto[];
  squad: TeamSquadDto | null;
}

export interface LeagueTableDto {
  season: SeasonDto;
  standings: StandingDto[];
}

// --- Partidos / actas ---

export interface TeamRefDto {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
}

export interface MatchDto {
  id: string;
  seasonId: string;
  matchday: number;
  kickoffAt: string;
  status: MatchStatus;
  homeTeam: TeamRefDto;
  awayTeam: TeamRefDto;
  homeGoals: number | null;
  awayGoals: number | null;
  venue: string | null;
}

export interface PerformanceStats {
  started: boolean;
  minutesPlayed: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  yellowCards: number;
  redCard: boolean;
  /** Valoración del cuerpo técnico, 1-10. */
  rating: number;
  notes: string | null;
}

export interface PerformanceDto extends PerformanceStats {
  id: string;
  matchId: string;
  squadId: string;
  squadPlayerId: string;
  playerName: string;
  position: Position | null;
  shirtNumber: number | null;
  teamId: string;
  updatedAt: string;
}

/** Acta de una plantilla en un partido; si no es visible para el usuario llega sin líneas. */
export interface MatchSquadSheetDto {
  squadId: string;
  teamId: string;
  teamName: string;
  visibility: SquadVisibility;
  visible: boolean;
  entries: PerformanceDto[];
}

export interface MatchDetailDto {
  match: MatchDto;
  sheets: MatchSquadSheetDto[];
}

export interface PerformanceWithMatchDto {
  performance: PerformanceDto;
  match: MatchDto;
}

// --- Estadísticas ---

export interface IndividualStatsDto {
  matchesLogged: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  goalContributions: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  tackles: number;
  interceptions: number;
  saves: number;
  yellowCards: number;
  redCards: number;
  averageRating: number | null;
  goalsPer90: number | null;
  assistsPer90: number | null;
  goalContributionsPer90: number | null;
  shotAccuracyPct: number | null;
}

export interface TeamImpactDto {
  teamId: string;
  teamMatchesPlayed: number;
  teamGoalsFor: number;
  teamGoalsAgainst: number;
  teamPoints: number;
  participationPct: number;
  goalSharePct: number | null;
  goalContributionSharePct: number | null;
  matchesWithPlayer: number;
  winsWithPlayer: number;
  drawsWithPlayer: number;
  lossesWithPlayer: number;
  pointsPerMatchWithPlayer: number | null;
  goalsForPerMatchWithPlayer: number | null;
  goalsAgainstPerMatchWithPlayer: number | null;
  matchesWithoutPlayer: number;
  pointsPerMatchWithoutPlayer: number | null;
  goalsForPerMatchWithoutPlayer: number | null;
  goalsAgainstPerMatchWithoutPlayer: number | null;
}

export interface LeagueComparisonDto {
  teamsCount: number;
  teamPosition: number | null;
  leagueAvgGoalsForPerMatch: number;
  leagueAvgPointsPerMatch: number;
  teamGoalsForPerMatch: number | null;
  teamGoalsAgainstPerMatch: number | null;
  teamPointsPerMatch: number | null;
  /** Fichas con minutos en actas visibles (plantillas públicas y la propia). */
  playersCompared: number;
  goalsPer90Percentile: number | null;
  assistsPer90Percentile: number | null;
  ratingPercentile: number | null;
  minutesPercentile: number | null;
}

export interface PlayerDashboardDto {
  player: PlayerDto;
  season: SeasonDto | null;
  individual: IndividualStatsDto;
  teamImpact: TeamImpactDto | null;
  league: LeagueComparisonDto | null;
  recentPerformances: PerformanceWithMatchDto[];
}

export interface SyncResultDto {
  provider: string;
  competitions: number;
  teams: number;
  matches: number;
  standings: number;
  rosterEntries: number;
  errors: string[];
  syncedAt: string;
}
