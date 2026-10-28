// Tipos espejo de los DTOs de la API (TercerTiempo.Application). Los enums viajan como string.

export type AccountType = 'Player' | 'Coach' | 'Club';
export type AppointmentStatus = 'Pending' | 'Active' | 'Expired' | 'Revoked';
export type MatchSide = 'Home' | 'Away';
export type OfficialSheetAvailability = 'NotPlayed' | 'Pending' | 'Available' | 'Unavailable' | 'Fetching';
export type OfficialEventType = 'Goal' | 'PenaltyGoal' | 'OwnGoal' | 'YellowCard' | 'SecondYellow' | 'RedCard' | 'Substitution';
/** Admin: el administrador lo ve para el mantenimiento de la web, sin comprarlo ni gestionarlo. */
export type VideoAccessLevel = 'None' | 'Locked' | 'Owner' | 'Purchased' | 'Free' | 'Admin';
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
  /** La misma contraseña otra vez: el servidor comprueba que coinciden. */
  confirmPassword: string;
  /** Cuerpo técnico y club. Los jugadores no lo mandan: su nombre es el de la ficha del código. */
  displayName: string | null;
  accountType: AccountType;
  /** Jugadores, opcional: si falta se toma la posición de la ficha. */
  position: Position | null;
  birthDate: string | null;
  /** Cuerpo técnico: código de acceso del club. Jugadores: código personal de su ficha. */
  accessCode: string | null;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  /** La nueva otra vez: el servidor comprueba que coinciden. */
  confirmNewPassword: string;
}

/** Último cambio de contraseña; nextChangeAt es desde cuándo se puede volver a cambiar (null: ya se puede). */
export interface PasswordStatusDto {
  changedAt: string | null;
  nextChangeAt: string | null;
  canChange: boolean;
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
  /** Su ficha en la plantilla publicada del equipo (para enlazar su ficha pública). */
  rosterEntryId: string | null;
}

export interface PlayerDto {
  id: string;
  displayName: string;
  position: Position;
  birthDate: string | null;
  squad: PlayerSquadDto | null;
  /** Foto subida por el propio jugador (recortada, fondo transparente). */
  photoUrl: string | null;
  /** Su perfil completo se ve desde fuera de su club (con sesión). */
  publicProfile: boolean;
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

export interface ClubSquadDto {
  squadId: string;
  teamId: string;
  seasonId: string;
}

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
  /** Estado de la licencia del club, que cubre a este equipo. */
  license: LicenseStatus;
  /** Último día con acceso a los datos privados del equipo. */
  licenseValidUntil: string;
}

// --- Árbitros (solo clubes y cuerpos técnicos con licencia) ---

export type OfficialRole = 'Referee' | 'AssistantReferee1' | 'AssistantReferee2' | 'FourthOfficial';

export interface RefereeStatsDto {
  matches: number;
  ratings: number;
  /** Nota media 0-10; null sin notas. */
  average: number | null;
  /** Cuántas notas de cada valor, de 0 a 10. */
  distribution: number[];
}

/** Main: árbitro principal; Assistant: asistente o cuarto árbitro. */
export type OfficialDuty = 'Main' | 'Assistant';

export interface RefereeCategoryDto {
  /** Clave para filtrar («3a-asturfutbol»). */
  key: string;
  name: string;
  level: CompetitionLevel;
  tier: number;
  /** Árbitros principales con algún partido en la categoría. */
  referees: number;
  /** Asistentes y cuartos árbitros. */
  assistants: number;
  matches: number;
  ratings: number;
  /** Ligas (cada grupo) de la categoría: con ellas se reconoce la de los equipos de la cuenta. */
  competitionIds: string[];
}

export type RefereeSort = 'Average' | 'Ratings' | 'Matches' | 'Name' | 'LastMatch';
export type SortOrder = 'Desc' | 'Asc';

/** Los árbitros de una categoría, en el orden pedido. */
export interface RefereeCategoryListDto {
  category: RefereeCategoryDto;
  duty: OfficialDuty | null;
  sort: RefereeSort;
  order: SortOrder;
  referees: RefereeSummaryDto[];
}

/** Un árbitro en una categoría y función: sale una vez por cada combinación en que ha estado. */
export interface RefereeSummaryDto {
  id: string;
  name: string;
  categoryKey: string;
  category: string;
  duty: OfficialDuty;
  matches: number;
  ratings: number;
  average: number | null;
  lastMatchAt: string | null;
}

/** Quién puso una nota, tal como era al votar: el club o un técnico de su cuerpo técnico. */
export interface RefereeRaterDto {
  name: string;
  club: boolean;
  /** Función del técnico en la plantilla; null si la puso el club. */
  staffRole: StaffRole | null;
}

/** La nota (definitiva) de un equipo a un árbitro en un partido, con quién la puso y por qué. */
export interface TeamRatingDto {
  teamId: string;
  teamName: string;
  teamCrestUrl: string | null;
  score: number;
  /** Null si no lo hay o si la administración lo retiró. */
  comment: string | null;
  /** Comentario retirado por la administración por no respetar las normas (la nota sigue). */
  commentHidden: boolean;
  ratedBy: RefereeRaterDto;
  ratedAt: string;
}

export interface RefereeRatingDto {
  matchId: string;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  categoryKey: string | null;
  category: string | null;
  /** Equipo que puso la nota. */
  teamId: string;
  teamName: string;
  teamCrestUrl: string | null;
  role: OfficialRole;
  score: number;
  comment: string | null;
  commentHidden: boolean;
  ratedBy: RefereeRaterDto;
  ratedAt: string;
}

/** Si un comentario se puede publicar o qué palabras prohibidas lleva. */
export interface CommentCheckDto {
  allowed: boolean;
  terms: string[];
  message: string | null;
}

// --- Moderación (administración) ---

export type CommentFilter = 'All' | 'Flagged' | 'Hidden' | 'Visible';
export type ForbiddenWordKind = 'Profanity' | 'Insult' | 'Slur' | 'Threat';

export interface RefereeCommentAdminDto {
  ratingId: string;
  refereeId: string;
  refereeName: string;
  matchId: string;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  teamName: string;
  ratedBy: RefereeRaterDto;
  role: OfficialRole;
  score: number;
  /** El comentario completo, también si está retirado. */
  comment: string;
  hidden: boolean;
  hiddenAt: string | null;
  /** Palabras de la lista actual que contiene. */
  flaggedTerms: string[];
  ratedAt: string;
}

export interface RefereeCommentsDto {
  total: number;
  flagged: number;
  hidden: number;
  comments: RefereeCommentAdminDto[];
}

export interface ForbiddenWordDto {
  term: string;
  kind: ForbiddenWordKind;
  createdAt: string;
}

export interface ForbiddenWordsDto {
  total: number;
  words: ForbiddenWordDto[];
}

export interface RefereeMatchDto {
  match: MatchDto;
  categoryKey: string | null;
  category: string | null;
  role: OfficialRole;
  ratings: number;
  average: number | null;
  /** Las notas de los dos equipos en ese partido, primero la del local. */
  teamRatings: TeamRatingDto[];
}

export interface RefereeDetailDto {
  id: string;
  name: string;
  /** Su ficha en futbolasturiano.es, si la publica. */
  profileUrl: string | null;
  stats: RefereeStatsDto;
  /** Sus cifras en cada categoría como principal y como asistente, de la categoría más alta a la más baja. */
  byCategory: RefereeCategoryStatsDto[];
  /** Las mejores notas con comentario. */
  best: RefereeRatingDto[];
  ratings: RefereeRatingDto[];
  matches: RefereeMatchDto[];
}

export interface RefereeCategoryStatsDto {
  categoryKey: string;
  category: string;
  duty: OfficialDuty;
  matches: number;
  ratings: number;
  average: number | null;
}

export interface MatchOfficialDto {
  refereeId: string;
  name: string;
  role: OfficialRole;
  /** Media que le ponen en esa función (principal o asistente), en todos sus partidos. */
  average: number | null;
  ratings: number;
  /** Las notas de los dos equipos en este partido, primero la del local. */
  teamRatings: TeamRatingDto[];
  /** La nota de tu equipo en este partido, si ya la ha puesto: es definitiva. */
  myScore: number | null;
}

export interface MatchOfficialsDto {
  matchId: string;
  homeTeam: TeamRefDto;
  awayTeam: TeamRefDto;
  categoryKey: string | null;
  category: string | null;
  played: boolean;
  /** La cuenta puede puntuar ahora en nombre de uno de los dos equipos (club o cuerpo técnico, con licencia). */
  canRate: boolean;
  /** La cuenta es de uno de los dos equipos pero no tiene licencia vigente para puntuar. */
  needsLicense: boolean;
  raterTeamId: string | null;
  raterTeamName: string | null;
  officials: MatchOfficialDto[];
}

export interface PendingRefereeRatingDto {
  match: MatchDto;
  teamId: string;
  teamName: string;
  officials: number;
  rated: number;
}

// --- Avisos del club (la campanita; solo cuentas de club) ---

export type AlertKind = 'LicenseExpiring';

export interface AlertDto {
  id: string;
  kind: AlertKind;
  title: string;
  message: string;
  /** Ruta del frontal a la que lleva el aviso. */
  link: string | null;
  /** Día al que se refiere: el último con acceso, en los de caducidad. */
  dueOn: string | null;
  createdAt: string;
  read: boolean;
  /** Ya no aplica (por ejemplo, el club reactivó la renovación). */
  resolved: boolean;
}

export interface ClubAlertsDto {
  /** Avisos vigentes sin leer: el número de la campanita. */
  unread: number;
  alerts: AlertDto[];
}

// --- Licencia del club (primer equipo y filiales) ---

export type LicenseStatus = 'Trial' | 'Active' | 'Expired';
export type PaymentStatus = 'Pending' | 'Paid' | 'Cancelled' | 'Failed';
/** Lo que se cobra: la licencia de club y, aparte, cada licencia de técnico. */
export type LicenseItem = 'Club' | 'StaffSeat';
export type BillingInterval = 'Monthly' | 'Yearly';

/** Equipo que cubre la licencia del club, con su cuerpo técnico (los técnicos salen de la bolsa del club). */
export interface LicensedTeamDto {
  teamId: string;
  teamName: string;
  teamCrestUrl: string | null;
  squadId: string | null;
  /** Técnicos de la temporada (vigentes o pendientes de canjear). */
  staffCount: number;
}

/** Licencia de club (primer equipo y filiales, todas las funciones para el club) más sus licencias de técnico. */
export interface ClubLicenseDto {
  clubId: string;
  clubName: string;
  status: LicenseStatus;
  trialEndsOn: string;
  paidUntil: string | null;
  validUntil: string;
  daysLeft: number;
  /** true una vez contratada la licencia de club; antes, la prueba. */
  contracted: boolean;
  interval: BillingInterval | null;
  autoRenew: boolean;
  /** Cambio de facturación pedido para la próxima renovación. */
  nextInterval: BillingInterval | null;
  /** Licencias de técnico contratadas: la bolsa del club para todos sus equipos. */
  staffSeats: number;
  /** Técnicos que quedarán en la próxima renovación si se ha pedido reducirlos. */
  nextStaffSeats: number | null;
  /** Técnicos que admite ahora: los de la prueba mientras no se ha contratado; después, los contratados. */
  staffLimit: number;
  /** Técnicos con nombramiento vigente o pendiente en todos los equipos del club. */
  staffInUse: number;
  /** Día del próximo cobro, si se renueva. */
  renewsOn: string | null;
  renewalPriceCents: number | null;
  /** Equipos cubiertos (para un técnico o un jugador, solo los suyos). */
  teams: LicensedTeamDto[];
}

export interface LicensePriceDto {
  monthlyPriceCents: number;
  yearlyPriceCents: number;
}

export interface LicensingCatalogDto {
  /** Licencia de club: el primer equipo y sus filiales. */
  club: LicensePriceDto;
  /** Cada licencia de técnico. */
  staffSeat: LicensePriceDto;
  currency: string;
  trialDays: number;
  /** Técnicos que admite la prueba. */
  trialStaffSeats: number;
  /** Licencias de técnico que puede tener un club como mucho. */
  maxStaffSeats: number;
  renewalGraceDays: number;
  /** «mock» = pago simulado, sin cobro real. */
  provider: string;
}

export interface LicensingStatusDto {
  licensed: boolean;
  /** Club: la suya. Técnico o jugador: las de los clubes de sus equipos. */
  licenses: ClubLicenseDto[];
  catalog: LicensingCatalogDto;
}

export interface LicenseCheckoutDto {
  sessionId: string;
  url: string;
  clubId: string;
  clubName: string;
  /** Equipos que cubre la licencia: el primer equipo y sus filiales. */
  teamNames: string[];
  interval: BillingInterval;
  /** Licencias de técnico que se contratan con la de club. */
  staffSeats: number;
  /** Lo que se cobra hoy (0 si aún queda prueba o periodo pagado). */
  amountCents: number;
  periodPriceCents: number;
  firstChargeOn: string;
  currency: string;
  provider: string;
  status: PaymentStatus;
  /** Avisos de la pasarela de esta licencia desde que se abrió el pago (la cola de eventos). */
  events: PaymentEventDto[] | null;
}

export type PaymentEventStatus = 'pending' | 'processed' | 'ignored' | 'failed';

/** Aviso de la pasarela en la cola: webhook de Stripe o evento de la simulada (mismo formato). */
export interface PaymentEventDto {
  id: string;
  provider: string;
  externalId: string;
  type: string;
  status: PaymentEventStatus;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  nextAttemptAt: string | null;
  error: string | null;
  licenseId: string | null;
  clubName: string | null;
  summary: string | null;
}

export type SimulatedPaymentOutcome = 'Succeeded' | 'Declined' | 'InsufficientFunds' | 'ExpiredCard' | 'AuthenticationFailed';
export type SimulatedLicenseEvent = 'RenewalPaid' | 'RenewalFailed' | 'SubscriptionDeleted';

export interface SimulatedPaymentDto {
  succeeded: boolean;
  /** Código de rechazo como el de Stripe. */
  declineCode: string | null;
  message: string;
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
  /** Equipos que cubre la licencia del club: el primer equipo y sus filiales. */
  teams: ClubTeamDto[];
  appointments: AppointmentDto[];
  /** Filiales del mismo club que aún no están vinculados (solo en GET /api/clubs/me y al vincular o quitar). */
  availableFilials: ClubFilialDto[];
}

export interface ClubFilialDto {
  teamId: string;
  teamName: string;
  teamCrestUrl: string | null;
  competitionName: string | null;
}

/** Club del catálogo del proveedor (primer equipo + filiales): es la lista de la que se elige el nombre al darse de alta. */
export interface ClubCatalogDto {
  name: string;
  registered: boolean;
  teams: ClubCatalogTeamDto[];
  crestUrl?: string | null;
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
  teamId: string;
  teamCrestUrl: string | null;
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
  /** Penaltis a favor (lanzados por el equipo) y en contra. */
  penaltiesFor: number;
  penaltiesAgainst: number;
  /** Goles de penalti: son parte de los goles a balón parado. */
  penaltyGoalsFor: number;
  penaltyGoalsAgainst: number;
  throwInsFor: number;
  throwInsAgainst: number;
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
  penaltiesFor: number;
  penaltiesAgainst: number;
  penaltyGoalsFor: number;
  penaltyGoalsAgainst: number;
  throwInsFor: number;
  throwInsAgainst: number;
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
  /** Temporada de la liga dentro de la temporada elegida. */
  seasonId: string | null;
  seasonLabel: string | null;
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

/** Ficha de un jugador para cualquier cuenta con sesión; el perfil completo solo si es de su club o lo ha hecho público. */
export interface PlayerCardDto {
  entry: RosterEntryDto;
  team: { id: string; name: string; shortName: string; crestUrl: string | null; competitionName: string | null; seasonLabel: string | null };
  official: RosterOfficialAppearanceDto[];
  hasAccount: boolean;
  profilePublic: boolean;
  /** Quien mira ve el perfil completo (actas de Tercer Tiempo). */
  extended: boolean;
  internal: RosterInternalAppearanceDto[];
  internalStats: RosterInternalStatsDto | null;
  /** Perfil interno en la plantilla, para su club y su plantilla. */
  internalProfileLink: string | null;
  isMe: boolean;
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
  /** Puestos destacados (ascenso, promoción, descenso) con su nombre y color. */
  zones?: LeagueZoneDto[] | null;
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
  playerPhotoUrl?: string | null;
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
  opponentId: string;
  opponentCrestUrl: string | null;
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
  photoUrl: string | null;
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
  /** Equipo del partido que gestiona quien mira (su club o su cuerpo técnico vigente): lo ve como el cuerpo técnico. */
  managedTeamId: string | null;
  /** Plantilla de ese equipo en la temporada del partido; null si el club todavía no la ha abierto. */
  managedSquadId: string | null;
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
  teamId: string;
  teamCrestUrl: string | null;
}

export interface VideoTicketDto {
  videoId: string;
  ticket: string;
  expiresAt: string;
}

// --- Administración: trabajos en segundo plano y llamadas a webs externas (/jobs) ---

/** Sin segundo paso trae el token; con el MFA de publicación, solo el reto (mfa) y el token llega al verificar el código. */
export interface AdminAuthResponse {
  accessToken: string | null;
  expiresAt: string | null;
  userName: string;
  mfa: AdminMfaChallenge | null;
}

export interface AdminMfaChallenge {
  /** Billete de 5 minutos para mandar el código. */
  ticket: string;
  expiresAt: string;
  /** Solo la primera vez: la clave para dar de alta la cuenta en Microsoft Authenticator. */
  setup: AdminMfaSetup | null;
}

export interface AdminMfaSetup {
  /** Base32 en grupos de 4, para escribirla a mano. */
  sharedKey: string;
  /** otpauth://totp/... para el QR. */
  authenticatorUri: string;
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
  /** Encolar las actas de la federación de los partidos ya jugados del alcance (se bajan a su ritmo: 20/h, 60/día). */
  includeSheets: boolean;
}

// --- Administración: descargas en directo ---

export type SyncLeagueStatus = 'pending' | 'running' | 'done' | 'failed';

export interface SyncLeagueDto {
  name: string;
  status: SyncLeagueStatus;
  /** Fase en curso: Calendario, Equipos, Partidos, Clasificación, Plantillas (3/18), Guardando. */
  stage: string | null;
  teams: number;
  matches: number;
  played: number;
  standings: number;
  roster: number;
  error: string | null;
}

export interface SyncTeamRefDto {
  id: string;
  name: string;
  crestUrl: string | null;
}

export interface SyncEventDto {
  id: number;
  at: string;
  kind: 'match' | 'team' | 'standings' | 'roster';
  league: string;
  text: string;
  home: SyncTeamRefDto | null;
  away: SyncTeamRefDto | null;
  homeGoals: number | null;
  awayGoals: number | null;
  matchday: number | null;
  kickoffAt: string | null;
  matchId: string | null;
  /** new / updated / same (partidos) o new (equipos). */
  change: 'new' | 'updated' | 'same' | null;
}

export interface SyncLiveDto {
  running: boolean;
  scope: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  summary: string | null;
  done: number;
  total: number;
  current: string | null;
  leagues: SyncLeagueDto[];
  feed: SyncEventDto[];
  errors: string[];
}

export type SheetDownloadStatus = 'pending' | 'downloading' | 'done' | 'missing' | 'failed';

export interface SheetQueueItemDto {
  matchId: string;
  status: SheetDownloadStatus;
  competition: string;
  matchday: number;
  kickoffAt: string;
  home: SyncTeamRefDto;
  away: SyncTeamRefDto;
  homeGoals: number | null;
  awayGoals: number | null;
  detail: string | null;
  attempts: number;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export type PauseKind = 'rest' | 'session' | 'retry' | 'blocked' | 'error' | 'hour' | 'day';

export interface SheetQueueDto {
  pending: number;
  downloading: number;
  done: number;
  missing: number;
  failed: number;
  pausedUntil: string | null;
  /** Por qué espera: descanso entre tandas, sesión cortada (no es bloqueo), bloqueo, error de la web o tope de peticiones. */
  pauseKind: PauseKind | null;
  pauseReason: string | null;
  hourRequests: number;
  maxPerHour: number;
  dayRequests: number;
  /** 0 = sin tope diario. */
  maxPerDay: number;
  nextRequestAt: string | null;
  burstRequests: number;
  maxPerBurst: number | null;
  requestsNeeded: number;
  estimatedFinishAt: string | null;
  items: SheetQueueItemDto[];
}

export interface LiveDownloadsDto {
  football: SyncLiveDto;
  sheets: SheetQueueDto;
  generatedAt: string;
  /** Todos los trabajos en segundo plano (también ligas y actas) con su estado, su avance y lo último que han tocado. */
  jobs: JobLiveDto[];
}

/** La federación está en pausa: el trabajo de las actas sigue solo a esa hora; lanzarlo antes lo deja pedido para entonces. */
export interface JobPauseDto {
  until: string;
  kind: PauseKind | null;
  reason: string | null;
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
  /** Día y hora fijos («Los lunes a las 7:00»); null si va por intervalo. */
  schedule?: string | null;
  pause: JobPauseDto | null;
}

export type JobEventTone = 'info' | 'success' | 'warning';

export interface JobEventDto {
  id: number;
  at: string;
  text: string;
  tone: JobEventTone;
  home: SyncTeamRefDto | null;
  away: SyncTeamRefDto | null;
  matchId: string | null;
}

/** Un trabajo en directo: su estado y lo último que ha tocado en la ejecución en curso o en la última desde que arrancó la API. */
export interface JobLiveDto {
  job: JobDto;
  startedAt: string | null;
  feed: JobEventDto[];
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
  pauseKind: PauseKind | null;
  pauseReason: string | null;
  burstRequests: number;
  maxPerBurst: number | null;
  burstRestMinutes: number | null;
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
  teamId: string | null;
}

/** Club del buscador de invitaciones: sus equipos, la cuenta si ya la tiene y su invitación. teamId se manda al crearla. */
export interface InvitationClubDto {
  name: string;
  teamId: string;
  teams: { id: string; name: string; competitionName: string | null }[];
  registeredAs: string | null;
  invitation: ClubInvitationDto | null;
}

/** Para qué club es una invitación de la beta (en el alta va fijado). */
export interface ClubInvitationLookupDto {
  code: string;
  clubName: string | null;
}

// --- Administración: precios y prueba de las licencias (en la base de datos) ---

export interface LicensePriceSettingsDto {
  item: LicenseItem;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  stripeMonthlyPriceId: string | null;
  stripeYearlyPriceId: string | null;
}

export interface LicensingSettingsDto {
  currency: string;
  trialDays: number;
  /** Técnicos que admite la prueba. */
  trialStaffSeats: number;
  /** Licencias de técnico que puede tener un club como mucho. */
  maxStaffSeats: number;
  /** Días antes del fin de una licencia que no se renueva en los que se avisa al club (vacío = sin avisos). */
  expiryAlertDays: number[];
  prices: LicensePriceSettingsDto[];
  /** Pasarela del entorno ('mock' o 'stripe'): viene de la configuración y no se edita. */
  provider: string;
  updatedAt: string;
}

export type UpdateLicensingSettingsRequest = Pick<LicensingSettingsDto, 'currency' | 'trialDays' | 'trialStaffSeats' | 'maxStaffSeats' | 'expiryAlertDays' | 'prices'>;

// --- Administración: licencias y cobros de todos los clubes ---

export type AdminLicenseState = 'trial' | 'trial-plan' | 'active' | 'grace' | 'unpaid' | 'cancelled' | 'trial-ended';

export interface AdminLicenseDto {
  id: string;
  clubId: string;
  clubName: string;
  /** Equipos que cubre: el primer equipo y sus filiales. */
  teamNames: string[];
  state: AdminLicenseState;
  hasAccess: boolean;
  contracted: boolean;
  interval: BillingInterval | null;
  autoRenew: boolean;
  nextInterval: BillingInterval | null;
  /** Licencias de técnico contratadas. */
  staffSeats: number;
  nextStaffSeats: number | null;
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
  kind: 'Subscription' | 'Renewal' | 'StaffSeats';
  interval: BillingInterval;
  /** Licencias de técnico de la suscripción con este pago. */
  staffSeats: number;
  amountCents: number;
  periodPriceCents: number;
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
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
  /** Pasarela en uso: mock (simulada, con simulador) o stripe. */
  provider: string;
}

/** Temporada de la app (2026/2027...): el dato padre del que cuelga todo lo demás. */
export interface SeasonYearDto {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

// --- Cookies y analítica propia ---

export type CookieCategory = 'Necessary' | 'Preferences' | 'Analytics';
export type CookieStorage = 'Cookie' | 'LocalStorage' | 'SessionStorage';

export interface CookieDto {
  id: string;
  name: string;
  category: CookieCategory;
  storage: CookieStorage;
  provider: string;
  purpose: string;
  duration: string;
  sortOrder: number;
  requiresConsent: boolean;
}

export interface CookiePolicyDto {
  /** Versión vigente: un consentimiento guardado solo vale si es de esta versión. */
  version: string;
  updatedAt: string;
  cookies: CookieDto[];
}

export type ConsentAction = 'AcceptAll' | 'RejectAll' | 'Custom';

export interface ConsentDto {
  visitorId: string;
  analytics: boolean;
  action: ConsentAction;
  policyVersion: string;
  createdAt: string;
}

export type AnalyticsEventType = 'PageView' | 'Search' | 'Click';
export type AnalyticsEntity = 'Team' | 'Club' | 'Competition' | 'Match' | 'Squad';
export type ClubScope = 'Actor' | 'Subject';

export interface TrackEventDto {
  type: AnalyticsEventType;
  path: string;
  routeName: string | null;
  label: string | null;
  entityType: AnalyticsEntity | null;
  entityId: string | null;
  occurredAt: string;
}

export interface AnalyticsCountDto { key: string; label: string; count: number; visitors: number }
export interface AnalyticsEntityCountDto { type: AnalyticsEntity; id: string; name: string; crestUrl: string | null; count: number; visitors: number }
export interface AnalyticsClubCountDto { clubId: string; name: string; crestUrl: string | null; count: number; visitors: number }

export interface AnalyticsReportDto {
  from: string;
  to: string;
  clubId: string | null;
  scope: ClubScope;
  totals: { pageViews: number; visitors: number; sessions: number; searches: number; clicks: number };
  days: { day: string; pageViews: number; visitors: number }[];
  pages: AnalyticsCountDto[];
  searches: AnalyticsCountDto[];
  clicks: AnalyticsCountDto[];
  entities: AnalyticsEntityCountDto[];
  actors: AnalyticsCountDto[];
  activeClubs: AnalyticsClubCountDto[];
  viewedClubs: AnalyticsClubCountDto[];
  consents: { total: number; acceptAll: number; rejectAll: number; custom: number; withAnalytics: number };
  /** Todos los clubes con cuenta, para el filtro. */
  clubs: AnalyticsClubCountDto[];
}

export type UpsertCookieRequest = Pick<CookieDto, 'name' | 'category' | 'storage' | 'provider' | 'purpose' | 'duration' | 'sortOrder'>;

// --- Buscador ---

export type SearchType = 'competition' | 'team' | 'club' | 'player' | 'match' | 'squad' | 'referee';

export interface SearchItemDto {
  type: SearchType;
  id: string;
  title: string;
  subtitle: string | null;
  /** Ruta del frontal donde está la información. */
  link: string;
  /** Escudo (crest), foto del jugador (photo), escudo del local (match) o icono de liga (league). */
  imageUrl: string | null;
  imageKind: 'crest' | 'photo' | 'match' | 'league' | 'referee' | 'none';
  /** Escudo del equipo del jugador o del visitante del partido. */
  secondaryImageUrl: string | null;
  /** Resultado del partido («0-1» o «vs») o jornadas de la liga. */
  meta: string | null;
  date: string | null;
  badges: string[];
  score: number;
}

export interface SearchGroupDto {
  type: SearchType;
  label: string;
  total: number;
  items: SearchItemDto[];
}

export interface SearchResultsDto {
  query: string;
  /** Palabras buscadas ya normalizadas (sin tildes), para resaltarlas. */
  terms: string[];
  /** Sin nada con todas las palabras: se enseña lo que coincide con casi todas. */
  partial: boolean;
  total: number;
  groups: SearchGroupDto[];
  indexedAt: string;
  elapsedMs: number;
}

// --- Previsor de resultados (público) ---

export type LeagueZoneKind = 'Champion' | 'DirectPromotion' | 'PromotionPlayoff' | 'RelegationPlayoff' | 'Relegation' | 'Other';

/** Un puesto destacado de la clasificación tal como lo publica la web de la liga (color y leyenda). */
export interface LeagueZoneDto {
  position: number;
  kind: LeagueZoneKind;
  /** «Ascenso directo», «Promoción de ascenso», «Descenso»... */
  label: string;
  /** #rrggbb */
  color: string;
}

export interface LeagueZonesDto {
  /** Puestos que cuentan como ascenso o promoción. */
  promotion: number[];
  /** Puestos de descenso; vacío si la liga no tiene. */
  relegation: number[];
  teams: number;
  /** true si son las plazas que publica la web de la liga; false si son aproximadas. */
  published: boolean;
  places: LeagueZoneDto[];
}

export interface TeamPredictionDto {
  teamId: string;
  teamName: string;
  shortName: string;
  crestUrl: string | null;
  /** En la jornada elegida. */
  position: number;
  points: number;
  played: number;
  goalDifference: number;
  /** Probabilidades de 0 a 1. */
  champion: number;
  promotion: number;
  relegation: number;
  expectedPoints: number;
  expectedPosition: number;
  /** Probabilidad de acabar en cada puesto, del 1.º al último. */
  positionOdds: number[];
  attack: number;
  defense: number;
}

export interface LeaguePredictionDto {
  season: SeasonDto | null;
  matchday: number | null;
  matchdays: number[];
  totalMatchdays: number;
  knownMatches: number;
  simulatedMatches: number;
  simulations: number;
  zones: LeagueZonesDto | null;
  /** Ordenados por el puesto final esperado. */
  teams: TeamPredictionDto[];
  notice: string | null;
}

export interface TeamEvolutionDto {
  teamId: string;
  teamName: string;
  shortName: string;
  crestUrl: string | null;
  /** Una por jornada de matchdays. */
  champion: number[];
  promotion: number[];
  relegation: number[];
  position: number[];
}

export interface LeaguePredictionEvolutionDto {
  matchdays: number[];
  simulations: number;
  zones: LeagueZonesDto | null;
  teams: TeamEvolutionDto[];
}
