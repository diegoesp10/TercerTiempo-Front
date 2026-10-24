// Tipos espejo de los DTOs de la API (TercerTiempo.Application). Los enums viajan como string.

export type AccountType = 'Player' | 'Coach' | 'Club';
export type AppointmentStatus = 'Pending' | 'Active' | 'Expired' | 'Revoked';
export type MatchSide = 'Home' | 'Away';
export type OfficialSheetAvailability = 'NotPlayed' | 'Pending' | 'Available' | 'Unavailable' | 'Fetching';
export type OfficialEventType = 'Goal' | 'PenaltyGoal' | 'OwnGoal' | 'YellowCard' | 'SecondYellow' | 'RedCard' | 'Substitution';
export type VideoAccessLevel = 'None' | 'Locked' | 'Owner' | 'Purchased' | 'Free';
/** El partido se sube entero o en dos partes, nunca mezclado. */
export type VideoPart = 'Full' | 'FirstHalf' | 'SecondHalf';
/** Private: plantilla, club y compradores. Public: cualquiera que llegue al partido, sin pagar. */
export type VideoVisibility = 'Private' | 'Public';
export type Position = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward';
export type MatchStatus = 'Scheduled' | 'InProgress' | 'Played' | 'Postponed' | 'Cancelled';
export type CompetitionLevel = 'Professional' | 'National' | 'Regional' | 'Cup' | 'Youth' | 'Other';
export type SquadVisibility = 'Private' | 'Public';
export type StaffRole = 'HeadCoach' | 'AssistantCoach' | 'Delegate' | 'Physio' | 'Analyst' | 'Other';
export type SquadPlayerStatus = 'Active' | 'Left';
export type MatchOutcome = 'NotPlayed' | 'Win' | 'Draw' | 'Loss';

export interface ProblemDetails {
  /** Código de error del catálogo (p. ej. license.required). */
  code?: string;
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
  /** Cuerpo técnico y club. Los jugadores no lo mandan: su nombre es el de la ficha del código. */
  displayName: string | null;
  accountType: AccountType;
  /** Jugadores, opcional: si falta se toma la posición de la ficha. */
  position: Position | null;
  birthDate: string | null;
  /** Cuerpo técnico: código de acceso del club. Jugadores: código personal de su ficha. */
  accessCode: string | null;
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
  /** Foto subida por el propio jugador (recortada, fondo transparente). */
  photoUrl: string | null;
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

/** Nombramiento visto por el técnico. */
export interface CoachAppointmentDto {
  id: string;
  clubName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonLabel: string;
  competitionName: string;
  role: StaffRole;
  validFrom: string;
  validUntil: string;
  status: AppointmentStatus;
  squadId: string | null;
}

export interface CoachDto {
  id: string;
  displayName: string;
  /** Plantillas con nombramiento vigente. */
  squads: SquadSummaryDto[];
  appointments: CoachAppointmentDto[];
}

// --- Clubes ---

export interface ClubTeamDto {
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamCrestUrl: string | null;
  competitionId: string | null;
  competitionName: string | null;
  seasonId: string | null;
  seasonLabel: string | null;
  seasonEndsOn: string | null;
  squadId: string | null;
  activeAppointments: number;
  /** Estado de la licencia del equipo. */
  license: LicenseStatus;
  /** Último día con acceso a los datos privados del equipo. */
  licenseValidUntil: string;
}

// --- Licencias por equipo ---

export type LicenseStatus = 'Trial' | 'Active' | 'Expired';
export type PaymentStatus = 'Pending' | 'Paid' | 'Cancelled';
/** Básica: un técnico. Premium: cuerpo técnico ampliado. Las dos con la plantilla entera. */
export type LicensePlan = 'Basic' | 'Premium';
export type BillingInterval = 'Monthly' | 'Yearly';

export interface TeamLicenseDto {
  teamId: string;
  teamName: string;
  squadId: string | null;
  status: LicenseStatus;
  trialEndsOn: string;
  paidUntil: string | null;
  validUntil: string;
  daysLeft: number;
  /** Plan contratado; null mientras no se ha elegido (la prueba). */
  plan: LicensePlan | null;
  /** Plan con el que funciona ahora: el contratado o Premium durante la prueba. */
  effectivePlan: LicensePlan;
  interval: BillingInterval | null;
  autoRenew: boolean;
  /** Cambio pedido para la próxima renovación. */
  nextPlan: LicensePlan | null;
  nextInterval: BillingInterval | null;
  /** Día del próximo cobro, si se renueva. */
  renewsOn: string | null;
  renewalPriceCents: number | null;
  /** Técnicos de la temporada (vigentes o pendientes de canjear) y los que admite el plan. */
  staffCount: number;
  staffLimit: number;
}

export interface LicensePlanDto {
  plan: LicensePlan;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxStaff: number;
}

export interface LicensingCatalogDto {
  plans: LicensePlanDto[];
  currency: string;
  trialDays: number;
  renewalGraceDays: number;
  /** «mock» = pago simulado, sin cobro real. */
  provider: string;
}

export interface LicensingStatusDto {
  licensed: boolean;
  teams: TeamLicenseDto[];
  catalog: LicensingCatalogDto;
}

export interface LicenseCheckoutDto {
  sessionId: string;
  url: string;
  teamId: string;
  teamName: string;
  plan: LicensePlan;
  interval: BillingInterval;
  /** Lo que se cobra hoy (0 si aún queda prueba o periodo pagado). */
  amountCents: number;
  periodPriceCents: number;
  firstChargeOn: string;
  currency: string;
  provider: string;
  status: PaymentStatus;
}

/** Nombramiento visto por el club: el código de acceso solo llega mientras está pendiente. */
export interface AppointmentDto {
  id: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  seasonLabel: string;
  coachName: string;
  email: string | null;
  role: StaffRole;
  accessCode: string | null;
  status: AppointmentStatus;
  coachId: string | null;
  coachDisplayName: string | null;
  redeemedAt: string | null;
  validFrom: string;
  validUntil: string;
  createdAt: string;
}

export interface ClubDto {
  id: string;
  name: string;
  teams: ClubTeamDto[];
  appointments: AppointmentDto[];
}

/** Club del catálogo del proveedor (primer equipo + filiales): es la lista de la que se elige el nombre al darse de alta. */
export interface ClubCatalogDto {
  name: string;
  registered: boolean;
  teams: ClubCatalogTeamDto[];
}

export interface ClubCatalogTeamDto {
  id: string;
  name: string;
  competitionName: string | null;
}

/** Resultado de cambiar el escudo de un equipo: la nueva crestUrl lleva versión para invalidar la caché. */
export interface TeamCrestImportDto {
  teamId: string;
  teamName: string;
  crestUrl: string;
  contentType: string;
  bytes: number;
}

export interface CreateAppointmentRequest {
  teamId: string;
  coachName: string;
  email: string | null;
  role: StaffRole;
  validUntil: string | null;
}

export interface AccountDto {
  type: AccountType;
  player: PlayerDto | null;
  coach: CoachDto | null;
  club: ClubDto | null;
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
  /** Último día del nombramiento del club. */
  validUntil: string | null;
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
  /** Lesión abierta; solo la ven el cuerpo técnico y los jugadores vinculados. */
  injury: InjuryDto | null;
  /** Código personal pendiente; solo lo reciben el club y el cuerpo técnico. */
  inviteCode: string | null;
  /** Foto de la ficha publicada por el club, si la ha subido. */
  photoUrl: string | null;
}

export type InjuryType =
  | 'MuscleContracture'
  | 'MuscleTear'
  | 'AnkleSprain'
  | 'KneeSprain'
  | 'CruciateLigament'
  | 'Meniscus'
  | 'Fracture'
  | 'Contusion'
  | 'Tendinitis'
  | 'Pubalgia'
  | 'Concussion'
  | 'Illness'
  | 'Other';

export interface InjuryTypeDto {
  type: InjuryType;
  label: string;
  /** Duración media orientativa en días; null si no hay referencia. */
  averageDays: number | null;
}

export interface InjuryDto {
  id: string;
  squadPlayerId: string;
  playerName: string;
  shirtNumber: number | null;
  type: InjuryType;
  typeLabel: string;
  averageDays: number | null;
  reason: string | null;
  /** Fechas en formato YYYY-MM-DD. */
  startedOn: string;
  expectedReturnOn: string | null;
  returnedOn: string | null;
  active: boolean;
  /** Días de baja hasta hoy (o hasta el alta). */
  daysOut: number;
}

export interface InjuryRequest {
  squadPlayerId: string | null;
  type: InjuryType;
  reason: string | null;
  startedOn: string;
  expectedReturnOn: string | null;
}

export interface SquadDetailDto {
  summary: SquadSummaryDto;
  canInvitePlayers: boolean;
  canManage: boolean;
  staff: SquadStaffDto[];
  players: SquadPlayerDto[];
}

export interface SquadPlayerRequest {
  fullName: string;
  position: Position | null;
  shirtNumber: number | null;
}

export interface JoinSquadAsPlayerRequest {
  inviteCode: string;
}

export interface SquadInviteDto {
  squadId: string;
  teamName: string;
  competitionName: string;
  seasonLabel: string;
  player: SquadPlayerDto;
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
  /** Datos del equipo en el partido; null si el cuerpo técnico no los ha apuntado. */
  teamStats?: TeamMatchStatsDto | null;
}

/** Datos colectivos del partido que no trae el acta pública; «for» es el equipo de la plantilla y «against» el rival. */
export interface TeamMatchStatsInput {
  possessionPct: number | null;
  cornersFor: number;
  cornersAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  shotsOnTargetFor: number;
  shotsOnTargetAgainst: number;
  offsidesFor: number;
  offsidesAgainst: number;
  foulsCommitted: number;
  foulsReceived: number;
  setPieceGoalsFor: number;
  setPieceGoalsAgainst: number;
  notes: string | null;
}

export interface TeamMatchStatsDto extends TeamMatchStatsInput {
  updatedAt: string;
}

/** Medias por partido con datos apuntados (la posesión, sobre los partidos en que se apuntó). */
export interface TeamStatsAveragesDto {
  possessionPct: number | null;
  cornersFor: number;
  cornersAgainst: number;
  shotsFor: number;
  shotsAgainst: number;
  shotsOnTargetFor: number;
  shotsOnTargetAgainst: number;
  offsidesFor: number;
  offsidesAgainst: number;
  foulsCommitted: number;
  foulsReceived: number;
  setPieceGoalsFor: number;
  setPieceGoalsAgainst: number;
}

export interface SquadTeamStatsDto {
  matchesRecorded: number;
  averages: TeamStatsAveragesDto | null;
  matches: { match: MatchDto; stats: TeamMatchStatsDto }[];
}

/** Línea del acta tal y como se envía: con played = false se borra la línea si existía. */
export interface MatchSheetEntryInput extends PerformanceStats {
  squadPlayerId: string;
  played: boolean;
  /** Dorsal solo para este partido (null = el de la ficha). */
  shirtNumber: number | null;
}

export interface SquadPlayerStatsDto {
  player: SquadPlayerDto;
  stats: IndividualStatsDto;
  impact: TeamImpactDto;
}

/** Temporada de cada jugador: acta interna si existe; si no, la oficial (sin asistencias, faltas ni nota). */
export interface SquadSeasonRowDto {
  player: SquadPlayerDto;
  matches: number;
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  fouls: number;
  averageRating: number | null;
  fromInternal: number;
  fromOfficial: number;
}

export interface SquadSeasonTableDto {
  squad: SquadSummaryDto;
  teamMatchesPlayed: number;
  internalSheets: number;
  officialSheets: number;
  rows: SquadSeasonRowDto[];
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
  /** Añadida o corregida por el club: el proveedor ya no la sobrescribe. */
  managedByClub: boolean;
  /** Foto subida por el club (ruta relativa a la API con versión); null si no hay. */
  photoUrl: string | null;
  /** Totales de la temporada según las actas oficiales; null si aún no aparece en ninguna. */
  stats: RosterEntryStatsDto | null;
}

export interface RosterEntryStatsDto {
  appearances: number;
  started: number;
  minutesPlayed: number;
  goals: number;
  yellowCards: number;
  redCards: number;
}

export interface RosterOfficialAppearanceDto {
  match: MatchDto;
  home: boolean;
  line: OfficialLineDto;
}

export interface RosterInternalAppearanceDto {
  match: MatchDto;
  home: boolean;
  performance: PerformanceDto;
}

export interface RosterInternalStatsDto {
  appearances: number;
  started: number;
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
  redCards: number;
  averageRating: number | null;
}

/** Ficha de un jugador de la plantilla con sus actas oficiales y las de Tercer Tiempo (vista del club). */
export interface RosterEntryDetailDto {
  entry: RosterEntryDto;
  official: RosterOfficialAppearanceDto[];
  internal: RosterInternalAppearanceDto[];
  internalStats: RosterInternalStatsDto | null;
  /** El cuerpo técnico lleva la plantilla en Tercer Tiempo y este jugador está en ella. */
  hasSquad: boolean;
}

export interface RosterEntryRequest {
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
  /** Ficha del club según la federación (sede, campo, equipación); null si no se ha localizado. */
  profile: TeamProfileDto | null;
  /** Página del equipo en la federación. */
  officialUrl: string | null;
}

export interface TeamProfileDto {
  officialName: string | null;
  locality: string | null;
  province: string | null;
  address: string | null;
  postalCode: string | null;
  website: string | null;
  ground: string | null;
  groundSurface: string | null;
  groundAddress: string | null;
  groundLocality: string | null;
  shirtColor: string | null;
  shortsColor: string | null;
  socksColor: string | null;
}

/** Resumen de una jornada de la temporada (fechas y partidos jugados). */
export interface MatchdaySummaryDto {
  number: number;
  startsAt: string;
  endsAt: string;
  /** Fecha central de la jornada (mediana de sus partidos). */
  referenceAt: string;
  matches: number;
  played: number;
}

/** Partidos de una jornada de una liga, con la jornada en curso y el resto de jornadas para navegar. */
export interface CompetitionMatchdayDto {
  competitionId: string;
  competitionName: string;
  /** null si la competición aún no tiene temporada en curso. */
  season: SeasonDto | null;
  matchday: number | null;
  currentMatchday: number | null;
  matchdays: MatchdaySummaryDto[];
  matches: MatchDto[];
  /** Explicación cuando no hay partidos (temporada nueva o sin calendario). */
  notice: string | null;
}

export interface LeagueTableDto {
  season: SeasonDto | null;
  standings: StandingDto[];
  /** Explicación cuando no hay clasificación (temporada nueva o sin partidos). */
  notice: string | null;
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
  notes: string | null;
  /** Faltas cometidas. */
  fouls?: number;
  /** Pérdidas de balón. */
  ballLosses?: number;
  /** Recuperaciones de balón. */
  recoveries?: number;
  /** Pases completados (no más que los intentados). */
  passesCompleted?: number;
  passesAttempted?: number;
}

export interface PerformanceDto extends PerformanceStats {
  id: string;
  /** Nota calculada con los datos del acta (3,0-10,0); null si no llegó a jugar. */
  rating: number | null;
  matchId: string;
  squadId: string;
  squadPlayerId: string;
  playerName: string;
  position: Position | null;
  /** Dorsal con el que jugó: el de este partido si se registró, si no el de su ficha. */
  shirtNumber: number | null;
  /** Dorsal registrado solo para este partido (null = el de la ficha). */
  matchShirtNumber: number | null;
  teamId: string;
  updatedAt: string;
}

// --- Previa del partido (cuerpo técnico) ---

export interface MatchPreviewDto {
  match: MatchDto;
  competitionName: string;
  home: TeamPreviewDto;
  away: TeamPreviewDto;
  prediction: PredictionDto;
  dataNotes: string[];
}

export interface TeamPreviewDto {
  team: TeamRefDto;
  position: number | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  pointsPerMatch: number;
  goalsForPerMatch: number;
  goalsAgainstPerMatch: number;
  atVenue: VenueRecordDto;
  form: FormResultDto[];
  officialSheets: number;
  inFormPlayers: PreviewPlayerDto[];
  setPieces: SetPiecesDto;
}

export interface VenueRecordDto {
  label: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface FormResultDto {
  matchId: string;
  matchday: number;
  opponentName: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  outcome: 'W' | 'D' | 'L';
}

export interface PreviewPlayerDto {
  name: string;
  shirtNumber: number | null;
  matches: number;
  started: number;
  minutes: number;
  goals: number;
  penaltyGoals: number;
  yellowCards: number;
  redCards: number;
  goalsLastThree: number;
  formScore: number;
}

export interface SetPiecesDto {
  penaltyGoalsFor: number;
  penaltyGoalsAgainst: number;
  ownGoalsFor: number;
  ownGoalsAgainst: number;
  yellowCards: number;
  redCards: number;
}

export interface PredictionDto {
  homeWin: number;
  draw: number;
  awayWin: number;
  expectedHomeGoals: number;
  expectedAwayGoals: number;
  mostLikelyScore: string;
  reasons: string[];
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
  competitionName: string | null;
  seasonLabel: string | null;
  sheets: MatchSquadSheetDto[];
}

// --- Sugerencias de los jugadores sobre su línea del acta ---

export type SuggestionStatus = 'Pending' | 'Approved' | 'Declined';

export interface SuggestedStatsDto {
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
}

export interface SuggestionDto {
  id: string;
  squadId: string;
  player: SquadPlayerDto;
  match: MatchDto;
  /** Línea que propone el jugador. */
  proposed: SuggestedStatsDto;
  /** Línea actual del acta; null si propone una entrada nueva. */
  current: PerformanceDto | null;
  message: string | null;
  status: SuggestionStatus;
  createdAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface SuggestPerformanceRequest extends SuggestedStatsDto {
  matchId: string;
  message: string | null;
}

export interface ResolveSuggestionRequest {
  approve: boolean;
  note: string | null;
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
  fouls: number;
  ballLosses: number;
  recoveries: number;
  passesCompleted: number;
  passesAttempted: number;
  /** Pases completados sobre intentados; null sin pases apuntados. */
  passAccuracyPct: number | null;
  recoveriesPer90: number | null;
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

// --- Gráficos ---

/** Perfil por 90' (ejes del radar). */
export interface PlayerAxesDto {
  goalsPer90: number;
  assistsPer90: number;
  shotsOnTargetPer90: number;
  keyPassesPer90: number;
  tacklesPer90: number;
  interceptionsPer90: number;
  savesPer90: number;
  averageRating: number | null;
  participationPct: number;
}

/** Aportación de cada bloque a la nota (sobre la base de 6,0) y nota final. */
export interface RatingBreakdownDto {
  attack: number;
  creation: number;
  defense: number;
  goalkeeping: number;
  discipline: number;
  result: number;
  total: number;
}

export interface PlayerMatchPointDto {
  match: MatchDto;
  home: boolean;
  opponentName: string;
  opponentShortName: string;
  goalsFor: number | null;
  goalsAgainst: number | null;
  outcome: MatchOutcome;
  performance: PerformanceDto | null;
  rating: RatingBreakdownDto | null;
  /** Su línea en el acta oficial de la federación, si está descargada. */
  official: OfficialLineDto | null;
}

export interface SquadPlayerProfileDto {
  squad: SquadSummaryDto;
  player: SquadPlayerDto;
  stats: IndividualStatsDto;
  impact: TeamImpactDto;
  profile: PlayerAxesDto;
  squadAverage: PlayerAxesDto;
  squadBest: PlayerAxesDto;
  matches: PlayerMatchPointDto[];
}

export interface SquadTimelinePointDto {
  match: MatchDto;
  home: boolean;
  opponentName: string;
  opponentShortName: string;
  goalsFor: number;
  goalsAgainst: number;
  outcome: MatchOutcome;
  points: number;
  cumulativePoints: number;
  sheetRecorded: boolean;
  playersUsed: number;
  averageRating: number | null;
  bestPlayerName: string | null;
  bestRating: number | null;
}

export interface SquadTimelineDto {
  squad: SquadSummaryDto;
  matches: SquadTimelinePointDto[];
}

// --- Acta oficial (federación) y comparador ---

export interface OfficialLineDto {
  id: string;
  shirtNumber: number | null;
  fullName: string;
  started: boolean;
  played: boolean;
  minuteIn: number | null;
  minuteOut: number | null;
  minutesPlayed: number;
  goals: number;
  penaltyGoals: number;
  ownGoals: number;
  yellowCards: number;
  redCard: boolean;
}

export interface OfficialTeamSheetDto {
  side: MatchSide;
  teamName: string;
  teamId: string | null;
  goals: number | null;
  starters: OfficialLineDto[];
  bench: OfficialLineDto[];
}

export interface OfficialEventDto {
  side: MatchSide;
  type: OfficialEventType;
  minute: number;
  extraMinute: number | null;
  playerName: string;
  relatedPlayerName: string | null;
}

export interface OfficialSheetDto {
  matchId: string;
  status: OfficialSheetAvailability;
  provider: string | null;
  sheetCode: string | null;
  sourceUrl: string | null;
  checkedAt: string | null;
  fetchedAt: string | null;
  referee: string | null;
  message: string | null;
  home: OfficialTeamSheetDto | null;
  away: OfficialTeamSheetDto | null;
  events: OfficialEventDto[];
}

/** Campo en el que difieren las dos actas. */
export interface SheetDifferenceDto {
  field: 'played' | 'started' | 'minutes' | 'goals' | 'yellowCards' | 'redCard';
  coach: string | null;
  official: string | null;
}

export interface SheetComparisonRowDto {
  player: SquadPlayerDto;
  coach: PerformanceDto | null;
  official: OfficialLineDto | null;
  differences: SheetDifferenceDto[];
}

export interface SheetComparisonSummaryDto {
  coachLines: number;
  officialLines: number;
  matched: number;
  rowsWithDifferences: number;
  differences: number;
}

export interface SheetComparisonDto {
  squad: SquadSummaryDto;
  match: MatchDto;
  side: MatchSide;
  canEdit: boolean;
  official: OfficialSheetDto;
  rows: SheetComparisonRowDto[];
  unmatchedOfficial: OfficialLineDto[];
  summary: SheetComparisonSummaryDto;
}

// --- Vídeos ---

export interface MatchVideoDto {
  id: string;
  matchId: string;
  squadId: string;
  teamId: string;
  teamName: string;
  part: VideoPart;
  visibility: VideoVisibility;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  priceCents: number;
  currency: string;
  uploadedAt: string;
  uploadedBy: string;
  access: VideoAccessLevel;
  canWatch: boolean;
  canDelete: boolean;
}

/** Sesión de subida por trozos (reanudable mientras no caduque). */
export interface VideoUploadDto {
  uploadId: string;
  squadId: string;
  matchId: string;
  part: VideoPart;
  fileName: string;
  sizeBytes: number;
  chunkSize: number;
  totalChunks: number;
  receivedBytes: number;
  /** Índice del siguiente trozo que espera la API. */
  nextChunk: number;
  complete: boolean;
  expiresAt: string;
}

export interface BeginVideoUploadRequest {
  part: VideoPart;
  title: string | null;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface VideoShareLinkDto {
  id: string;
  videoId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  active: boolean;
}

/** Vídeo visto a través de un enlace compartido (sin sesión). */
export interface SharedVideoDto {
  videoId: string;
  title: string;
  part: VideoPart;
  teamName: string;
  match: MatchDto;
  contentType: string;
  sizeBytes: number;
  expiresAt: string;
}

export interface VideoTicketDto {
  videoId: string;
  ticket: string;
  expiresAt: string;
}

// --- Administración: trabajos en segundo plano y llamadas a webs externas (/jobs) ---

export interface AdminAuthResponse {
  accessToken: string;
  expiresAt: string;
  userName: string;
}

export type JobRunStatus = 'running' | 'succeeded' | 'partial' | 'failed' | 'paused' | 'interrupted';

export interface JobRunDto {
  id: string;
  job: string;
  manual: boolean;
  status: JobRunStatus;
  startedAt: string;
  finishedAt: string | null;
  summary: string | null;
  errors: string[];
  requests: number;
  /** Datos de las ligas: «Jornada en curso (21 oct – 28 oct)», «Temporada completa»… */
  scope: string | null;
}

export type SyncScopeKind = 'CurrentRound' | 'DateRange' | 'FullSeason';

export interface FootballSyncSettingsDto {
  scheduledScope: SyncScopeKind;
  daysBack: number;
  daysAhead: number;
  rostersInRound: boolean;
  fullSyncEveryDays: number;
  roundFrom: string;
  roundTo: string;
  lastFullSyncAt: string | null;
  nextFullSyncAt: string | null;
  competitions: { id: string; name: string; category: string; tier: number; group: string | null }[];
  updatedAt: string;
}

export type UpdateFootballSyncRequest = Pick<FootballSyncSettingsDto, 'scheduledScope' | 'daysBack' | 'daysAhead' | 'rostersInRound' | 'fullSyncEveryDays'>;

export interface RunFootballSyncRequest {
  scope: SyncScopeKind;
  from: string | null;
  to: string | null;
  competitionIds: string[];
  includeRosters: boolean;
}

export interface JobDto {
  name: string;
  title: string;
  description: string;
  intervalMinutes: number | null;
  enabled: boolean;
  running: boolean;
  nextRunAt: string | null;
  progress: { current: string | null; done: number; total: number } | null;
  lastRun: JobRunDto | null;
}

export interface ScrapeSourceDto {
  provider: string;
  hourRequests: number | null;
  maxPerHour: number | null;
  dayRequests: number | null;
  maxPerDay: number | null;
  pausedUntil: string | null;
  nextRequestAt: string | null;
  last24h: number;
  failed24h: number;
  lastRequestAt: string | null;
}

export interface ScrapeRequestDto {
  id: number;
  at: string;
  provider: string;
  method: string;
  url: string;
  statusCode: number | null;
  durationMs: number;
  error: string | null;
  jobRunId: string | null;
}

export interface JobsOverviewDto {
  jobs: JobDto[];
  sources: ScrapeSourceDto[];
  runs: JobRunDto[];
  requests: ScrapeRequestDto[];
  generatedAt: string;
}

export interface RegistrationOptionsDto {
  clubInviteRequired: boolean;
}

export type ClubInvitationStatus = 'available' | 'used' | 'expired' | 'revoked';

export interface ClubInvitationDto {
  id: string;
  code: string;
  note: string | null;
  status: ClubInvitationStatus;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  clubName: string | null;
  revokedAt: string | null;
}

// --- Administración: planes, precios y prueba de las licencias (en la base de datos) ---

export interface LicensePlanSettingsDto {
  plan: LicensePlan;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  maxStaff: number;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
}

export interface LicensingSettingsDto {
  currency: string;
  trialDays: number;
  plans: LicensePlanSettingsDto[];
  /** Pasarela del entorno ('mock' o 'stripe'): viene de la configuración y no se edita. */
  provider: string;
  updatedAt: string;
}

export type UpdateLicensingSettingsRequest = Pick<LicensingSettingsDto, 'currency' | 'trialDays' | 'plans'>;

// --- Administración: licencias y cobros de todos los clubes ---

export type AdminLicenseState = 'trial' | 'trial-plan' | 'active' | 'grace' | 'unpaid' | 'cancelled' | 'trial-ended';

export interface AdminLicenseDto {
  id: string;
  clubId: string;
  clubName: string;
  teamId: string;
  teamName: string;
  state: AdminLicenseState;
  hasAccess: boolean;
  effectivePlan: LicensePlan;
  plan: LicensePlan | null;
  interval: BillingInterval | null;
  autoRenew: boolean;
  nextPlan: LicensePlan | null;
  nextInterval: BillingInterval | null;
  trialEndsOn: string;
  paidUntil: string | null;
  renewsOn: string | null;
  nextChargeCents: number | null;
  owedCents: number;
  owedSince: string | null;
  paidCents: number;
  lastPaymentAt: string | null;
  provider: string | null;
}

export interface AdminLicensePaymentDto {
  id: string;
  clubName: string;
  teamName: string;
  kind: 'Subscription' | 'Renewal';
  plan: LicensePlan;
  interval: BillingInterval;
  amountCents: number;
  periodPriceCents: number;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  paidAt: string | null;
}

export interface LicensesOverviewDto {
  summary: {
    total: number;
    trial: number;
    paying: number;
    grace: number;
    unpaid: number;
    inactive: number;
    owedCents: number;
    collectedCents: number;
    monthlyRecurringCents: number;
    pendingCheckouts: number;
  };
  licenses: AdminLicenseDto[];
  payments: AdminLicensePaymentDto[];
  currency: string;
  today: string;
}
