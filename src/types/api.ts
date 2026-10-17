// Tipos espejo de los DTOs de la API (TercerTiempo.Application). Los enums viajan como string.

export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward';
export type MembershipStatus = 'Pending' | 'Active' | 'Inactive';
export type MatchStatus = 'Scheduled' | 'InProgress' | 'Played' | 'Postponed' | 'Cancelled';

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
}

// --- Auth / jugador ---

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
  position: Position;
  birthDate: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SquadMembershipDto {
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamCrestUrl: string | null;
  seasonId: string;
  seasonLabel: string;
  shirtNumber: number | null;
  status: MembershipStatus;
  verifiedInRoster: boolean;
  joinedAt: string;
}

export interface PlayerDto {
  id: string;
  displayName: string;
  position: Position;
  birthDate: string | null;
  linkedToProvider: boolean;
  membership: SquadMembershipDto | null;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  player: PlayerDto;
}

export interface JoinTeamRequest {
  teamId: string;
  rosterEntryId: string | null;
  shirtNumber: number | null;
}

// --- Competición / equipos ---

export interface SeasonDto {
  id: string;
  label: string;
  competitionId: string;
  competitionName: string;
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
  position: number | null;
  played: number | null;
  points: number | null;
}

export interface RosterEntryDto {
  id: string;
  fullName: string;
  position: Position | null;
  shirtNumber: number | null;
  claimed: boolean;
}

export interface SquadMemberDto {
  playerId: string;
  displayName: string;
  position: Position;
  shirtNumber: number | null;
  status: MembershipStatus;
}

export interface TeamDetailDto {
  id: string;
  name: string;
  shortName: string;
  crestUrl: string | null;
  season: SeasonDto;
  standing: StandingDto | null;
  roster: RosterEntryDto[];
  registeredPlayers: SquadMemberDto[];
}

export interface LeagueTableDto {
  season: SeasonDto;
  standings: StandingDto[];
}

// --- Partidos / rendimiento ---

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
  myPerformanceId: string | null;
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
  selfRating: number;
  notes: string | null;
}

export interface PerformanceDto extends PerformanceStats {
  id: string;
  matchId: string;
  playerId: string;
  playerName: string;
  playerPosition: Position;
  teamId: string;
  updatedAt: string;
}

export interface MatchDetailDto {
  match: MatchDto;
  myPerformance: PerformanceDto | null;
  performances: PerformanceDto[];
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
  playersOnPlatform: number;
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
  competition: string;
  season: string;
  teams: number;
  matches: number;
  standings: number;
  rosterEntries: number;
  syncedAt: string;
}
