// Tipos espejo de los DTOs de la API (TercerTiempo.Application). Los enums viajan como string.

import type { InjuryBriefDto, SuspensionBriefDto } from './trainings';

export type AccountType = 'Player' | 'Coach' | 'Club';
export type AppointmentStatus = 'Pending' | 'Active' | 'Expired' | 'Revoked';
export type MatchSide = 'Home' | 'Away';
/** Provisional: alineaciones publicadas, pero el árbitro aún no ha cerrado el acta (sin goles, cambios, tarjetas ni minutos). */
export type OfficialSheetAvailability = 'NotPlayed' | 'Pending' | 'Available' | 'Unavailable' | 'Fetching' | 'Provisional';
export type OfficialEventType = 'Goal' | 'PenaltyGoal' | 'OwnGoal' | 'YellowCard' | 'SecondYellow' | 'RedCard' | 'Substitution';
/**
 * Locked: plantilla pública, se puede pedir acceso al club. Owner: es de la plantilla (club, cuerpo técnico, jugadores).
 * Pass: lo abre un pase del partido. Admin: el administrador, para el mantenimiento de la web.
 */
export type VideoAccessLevel = 'None' | 'Locked' | 'Owner' | 'Pass' | 'Admin';
/** El partido se sube entero o en dos partes, nunca mezclado. */
export type VideoPart = 'Full' | 'FirstHalf' | 'SecondHalf';
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
  /** Foto que ha subido el propio técnico; null si no tiene. */
  photoUrl?: string | null;
}

/** Perfil de un técnico para cualquier cuenta con sesión. */
export interface CoachProfileDto {
  id: string;
  displayName: string;
  photoUrl: string | null;
  /** true si es el perfil de la cuenta que lo mira: solo entonces se puede cambiar la foto. */
  isMe: boolean;
  /** Equipos que dirige o ha dirigido, los vigentes primero. */
  teams: CoachTeamDto[];
  /** Balance de todos sus equipos mientras estuvo con ellos (cada partido una vez). */
  summary?: CoachSummaryDto | null;
}

export interface CoachSummaryDto {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  /** Porcentajes sobre los partidos jugados; null sin partidos. */
  winPct: number | null;
  drawPct: number | null;
  lossPct: number | null;
  pointsPerMatch: number | null;
  /** Media de la posición en la clasificación de sus equipos (una por equipo y temporada); null si ninguno la tiene. */
  averagePosition: number | null;
  /** Equipos y temporadas que entran en la posición media. */
  rankedTeams: number;
}

export interface CoachTeamRecordDto {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CoachTeamDto {
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamCrestUrl: string | null;
  clubName: string;
  competitionName: string;
  seasonLabel: string;
  role: StaffRole;
  validFrom: string;
  validUntil: string;
  /** true mientras el nombramiento está vigente. */
  current: boolean;
  /** Plantilla de ese equipo en esa temporada (privada: solo la abren quienes tienen acceso). */
  squadId: string | null;
  /** Día en que dejó el equipo antes de acabar su nombramiento (el club se lo retiró); null si lo cumplió o sigue. */
  leftOn?: string | null;
  /** Partidos del equipo mientras estuvo con él (del inicio del nombramiento hasta que lo dejó, acabó o hoy). */
  record?: CoachTeamRecordDto | null;
  /** Posición en la clasificación de esa competición y temporada (la actual o la última conocida); null sin clasificación. */
  position?: number | null;
  /** Equipos de esa clasificación. */
  teamsInTable?: number | null;
  /** Actas públicas guardadas de los partidos del equipo en ese tiempo que traen cuerpo técnico. */
  officialSheets?: number;
  /** En cuántas de esas actas figura él (por su nombre). */
  officialAppearances?: number;
  /** Cómo lo apunta la federación en el acta («Entrenador», «2º Entrenador», «Delegado»...); null si no figura. */
  officialRole?: string | null;
  /** En el equipo actual: sus tarjetas de la temporada y cómo llega al próximo partido; null en los anteriores. */
  discipline?: StaffDisciplineDto | null;
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
  /** Notas puestas (sin contar los «No votado»). */
  ratings: number;
  /** Nota media 0-10; null sin notas. */
  average: number | null;
  /** Veces que un equipo decidió no votarle. */
  noVotes: number;
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
  territory: TerritoryDto;
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
  /** De 0 a 10; null si el equipo decidió no votar. */
  score: number | null;
  /** «No votado»: el equipo decidió no puntuarle; queda quién lo decidió, sin nota ni comentario. */
  noVote: boolean;
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
  /** De 0 a 10; null si el equipo decidió no votar. */
  score: number | null;
  noVote: boolean;
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
  score: number | null;
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
  /** Tu equipo decidió no votarle en este partido (también definitivo). */
  myNoVote: boolean;
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
  /** Cuántos ha contestado ya el equipo (con nota o «No votado»). */
  rated: number;
  /** De esos, cuántos quedaron como «No votado». */
  noVotes: number;
}

// --- Avisos del club (la campanita; solo cuentas de club) ---

/**
 * MatchCallUp y MatchNotCalledUp son de partidos (convocatoria, que el jugador firma); TrainingCall (citación al jugador,
 * o cambio o anulación de una sesión) y TrainingAbsence (el jugador avisa de que falta), de entrenamientos. CallUpShort
 * (al cuerpo técnico y al club): la convocatoria se ha enviado sin llegar al número de convocados. InjuryProposal (al
 * cuerpo técnico y al club): la crónica de un partido cuenta que un jugador se lesionó, para registrarlo o descartarlo.
 */
export type AlertKind =
  | 'LicenseExpiring'
  | 'PassRequest'
  | 'MatchCallUp'
  | 'MatchNotCalledUp'
  | 'TrainingCall'
  | 'TrainingAbsence'
  | 'CallUpShort'
  | 'LeagueSuspension'
  | 'InjuryProposal';

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
  /** Ya se vio en la campanita: deja de contar y pasa a «Anteriores». */
  seen: boolean;
  read: boolean;
  /** Ya no aplica (por ejemplo, el club reactivó la renovación). */
  resolved: boolean;
}

export interface ClubAlertsDto {
  /** Avisos nuevos (sin ver y vigentes): el número de la campanita. */
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
  /** Foto que ha subido el propio técnico; null si no tiene. */
  photoUrl?: string | null;
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
  /** Día (YYYY-MM-DD) en que causó baja; null si sigue en la plantilla. */
  leftOn?: string | null;
}

/** Código de un tipo del catálogo de lesiones (lo mantiene el administrador; solo se enseña su nombre). */
export type InjuryType = string;

export interface InjuryTypeDto {
  type: InjuryType;
  label: string;
  /** Duración media orientativa en días; null si no hay referencia. */
  averageDays: number | null;
  /** Clase de sitio que pregunta (qué músculo, qué hueso...); null si tiene un sitio fijo o no pregunta dónde fue. */
  siteKind: BodySiteKind | null;
  /** Sitio fijo (el tobillo en el esguince de tobillo); null si no tiene. */
  baseSite: string | null;
  /** Con sitio fijo, lo que lo precisa si se sabe; con clase, solo esos sitios (vacía: todos los de la clase). */
  sites: string[];
  /** Se pregunta el grado (I, II o III). */
  graded: boolean;
  /** false = retirado: no se ofrece para lesiones nuevas; sale para corregir las que ya lo tienen. */
  active: boolean;
}

/** Lo que es cada sitio del cuerpo: se pregunta «¿Qué músculo?», «¿Qué hueso?»... Las articulaciones son también zonas. */
export type BodySiteKind = 'Zone' | 'Muscle' | 'Bone' | 'Tendon' | 'Ligament' | 'Joint' | 'Cartilage';

/** De la cabeza a los pies: agrupa los sitios al elegirlos. */
export type BodyRegion =
  | 'Head'
  | 'Neck'
  | 'Shoulder'
  | 'Arm'
  | 'Elbow'
  | 'Forearm'
  | 'Wrist'
  | 'Hand'
  | 'Chest'
  | 'Abdomen'
  | 'Back'
  | 'Hip'
  | 'Thigh'
  | 'Knee'
  | 'Leg'
  | 'Ankle'
  | 'Foot';

/** Cómo concuerda el lado con el nombre del sitio: «rodilla izquierda», «isquiotibiales izquierdos». */
export type BodySiteAgreement = 'Masculine' | 'Feminine' | 'MasculinePlural' | 'FemininePlural';

export type BodySide = 'Left' | 'Right' | 'Both';

/** Grado: I distensión, II rotura parcial, III rotura completa. */
export type InjuryGrade = 'I' | 'II' | 'III';

/** Cómo se produjo: con contacto, sin contacto o por sobrecarga. */
export type InjuryMechanism = 'Contact' | 'NonContact' | 'Overuse';

/** Un sitio del cuerpo del catálogo: músculo (con su grupo), hueso, tendón, ligamento, articulación, cartílago o zona. */
export interface BodySiteDto {
  code: string;
  label: string;
  kind: BodySiteKind;
  region: BodyRegion;
  /** Grupo al que pertenece (el bíceps femoral, a los isquiotibiales); null si no está en ninguno. */
  parent: string | null;
  /** Hay izquierdo y derecho: se pregunta el lado. */
  paired: boolean;
  agreement: BodySiteAgreement;
  /** false = retirado: no se ofrece para lesiones nuevas, pero las que ya lo tienen lo enseñan. */
  active: boolean;
}

/** Dónde se lesionó: un partido de liga del equipo (ya jugado) o un entrenamiento de la plantilla (ya empezado). */
export type InjuryOccasionKind = 'Match' | 'Training';

export interface InjuryOccasionDto {
  kind: InjuryOccasionKind;
  /** Id del partido o de la sesión de entrenamiento. */
  id: string;
  /** Día (YYYY-MM-DD) del partido o del entrenamiento. */
  day: string;
  /** «J11 · Local – Visitante» o el título del entrenamiento. */
  label: string;
  /** Hora del saque o del comienzo; solo en la lista para elegir. */
  at?: string | null;
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
  /** Días de baja contados desde el parte: hasta hoy si sigue lesionado, hasta el alta si ya la tiene (de quien causó baja en la plantilla, hasta ese día). */
  daysOut: number;
  /** Pruebas e informes (radiografías, informes del hospital...), los últimos primero. */
  documents: InjuryDocumentDto[];
  /** El jugador causó baja en la plantilla: la lesión es historial (se consulta y se puede borrar, no se cambia). */
  playerLeft?: boolean;
  /** Cuándo se registró el parte en la app; no cambia al corregir las fechas. */
  reportedAt?: string | null;
  /** La vuelta que se previó al dar el parte, para comparar lo previsto con lo real. */
  initialExpectedReturnOn?: string | null;
  /** Días de baja previstos ahora (del parte a la vuelta prevista). */
  expectedDays?: number | null;
  /** Días de baja previstos al dar el parte. */
  initialExpectedDays?: number | null;
  /** Solo si sigue lesionado y hay vuelta prevista: días que faltan para ella (negativo si ya ha pasado). */
  daysLeft?: number | null;
  /** La lesión superada de la que esta es recaída; null si no lo es. */
  relapseOfInjuryId?: string | null;
  /** Viene de la temporada anterior: la misma lesión, que seguía abierta al cambiar de temporada, con su parte. */
  continuesInjuryId?: string | null;
  /** Día en que pasó sin el alta a la temporada siguiente: aquí es historial y se lleva desde allí. */
  continuedOn?: string | null;
  /** El partido o el entrenamiento en que se lesionó; null si fue en otro sitio o no se sabe. */
  occasion?: InjuryOccasionDto | null;
  /** Sitio del cuerpo (código del catálogo); null si el tipo no pregunta dónde fue. */
  site?: string | null;
  siteLabel?: string | null;
  /** Lado, si el sitio tiene dos. */
  side?: BodySide | null;
  /** Dónde fue, para leer: «Rodilla izquierda», «Ligamento cruzado anterior (LCA), rodilla derecha». */
  location?: string | null;
  grade?: InjuryGrade | null;
  mechanism?: InjuryMechanism | null;
}

/** El historial de lesiones de un jugador en el club: las de esta temporada y las de otras (y otros equipos del club). */
export interface PlayerInjuryHistoryDto {
  squadPlayerId: string;
  /** La abierta primero y después de la más reciente a la más antigua. */
  injuries: InjuryHistoryEntryDto[];
  totals: InjuryHistoryTotalsDto;
}

export interface InjuryHistoryEntryDto {
  injury: InjuryDto;
  squadId: string;
  teamName: string;
  seasonLabel: string;
  /** Es de otra plantilla del club (otra temporada u otro equipo): aquí se consulta; se corrige desde aquella. */
  otherSquad: boolean;
  /** Si pasó abierta desde otra temporada, la del parte (es la misma lesión y sale una sola vez). */
  fromSeasonLabel?: string | null;
}

export interface InjuryHistoryTotalsDto {
  injuries: number;
  /** Lesiones superadas: las que tienen el alta. */
  recovered: number;
  /** Días de baja de todas (la abierta, hasta hoy). */
  daysOut: number;
  /** Media de días del parte al alta de las superadas; null si no hay ninguna. */
  averageRecoveryDays: number | null;
  /** Cuántas fueron recaídas de una anterior. */
  relapses: number;
}

/** Recaída: vuelve a lesionarse de lo mismo después del alta. Es una lesión nueva enlazada a la superada. */
export interface RelapseRequest {
  startedOn: string;
  expectedReturnOn: string | null;
  reason: string | null;
  /** Dónde volvió a lesionarse: un partido o un entrenamiento (como mucho uno de los dos). */
  matchId?: string | null;
  trainingSessionId?: string | null;
  /** Sitio y lado; sin ellos, los de la lesión anterior (es la misma lesión que vuelve). */
  site?: string | null;
  side?: BodySide | null;
  grade?: InjuryGrade | null;
  mechanism?: InjuryMechanism | null;
}

export type InjuryDocumentKind = 'Imaging' | 'MedicalReport' | 'Other';

export interface InjuryDocumentDto {
  id: string;
  kind: InjuryDocumentKind;
  kindLabel: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  note: string | null;
  uploadedAt: string;
  /** Ruta de la API que lo sirve: se pide con la sesión (httpBlob), un enlace normal no manda el token. */
  url: string;
}

export interface InjuryRequest {
  squadPlayerId: string | null;
  type: InjuryType;
  reason: string | null;
  startedOn: string;
  expectedReturnOn: string | null;
  /** Al registrar una posible lesión de la crónica: queda registrada y su aviso, resuelto. */
  proposalId?: string | null;
  /** Dónde se lesionó: un partido o un entrenamiento (como mucho uno de los dos); sin ninguno, en otro sitio o no se sabe. */
  matchId?: string | null;
  trainingSessionId?: string | null;
  /** Sitio del cuerpo, el que pregunta el tipo (con sitio fijo, si no se precisa, ese). */
  site?: string | null;
  /** Lado, obligatorio si el sitio tiene dos. */
  side?: BodySide | null;
  /** Grado, si el tipo lo lleva y se sabe. */
  grade?: InjuryGrade | null;
  /** Cómo se produjo, si se sabe. */
  mechanism?: InjuryMechanism | null;
}

/**
 * Posible lesión que cuenta la crónica de un partido (futbolasturiano.es): no es una lesión hasta que el club o el cuerpo
 * técnico la registran; también la pueden descartar. matchDate es el día del partido (el parte que se propone) y minute,
 * el minuto en que dejó el campo según el acta oficial.
 */
export interface InjuryProposalDto {
  id: string;
  squadPlayerId: string;
  playerName: string;
  matchId: string;
  matchday: number;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  minute: number | null;
  excerpt: string;
  phrase: string;
  sourceUrl: string;
  suggestedType: InjuryType | null;
  /** Sitio del cuerpo que nombra la crónica, entre los que pregunta el tipo sugerido; null si no lo dice. */
  suggestedSite?: string | null;
  /** Lado que dice la crónica, si el sitio tiene dos. */
  suggestedSide?: BodySide | null;
  detectedAt: string;
}

/** Lesión de la plantilla en un partido, para sus sucesos: confirmed false es una posible sin registrar (solo club y cuerpo técnico). */
export interface MatchInjuryDto {
  squadPlayerId: string;
  playerName: string;
  minute: number | null;
  phrase: string;
  confirmed: boolean;
  injuryId: string | null;
  proposalId: string | null;
  typeLabel: string | null;
  /** Su línea en el acta oficial, para marcarlo también en la alineación. */
  sheetLineId?: string | null;
  /** Dónde fue la lesión registrada («Rodilla izquierda»); null si no lo dice o es una posible lesión. */
  location?: string | null;
}

export interface SquadDetailDto {
  summary: SquadSummaryDto;
  canInvitePlayers: boolean;
  canManage: boolean;
  staff: SquadStaffDto[];
  /** Los que están en la plantilla: solo con ellos se convoca, se entrena y se hacen actas. */
  players: SquadPlayerDto[];
  /** Los que estuvieron y causaron baja (leftOn), los últimos primero: se consultan, pero no entran en nada nuevo. */
  leftPlayers?: SquadPlayerDto[];
  /** A cuántos se convoca siempre; null: se pregunta en cada convocatoria. */
  callUpSize?: number | null;
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
  /** Va en la convocatoria del partido (solo para el club y el cuerpo técnico). */
  calledUp?: boolean;
  /** Estaba sancionado para este partido: no puede salir como que jugó (la línea que ya tuviera se conserva). */
  suspended?: boolean;
  suspension?: SuspensionBriefDto | null;
  /** Su dorsal en este partido según el acta oficial; null si aún no está o no sale en ella. No se cambia a mano. */
  officialShirtNumber?: number | null;
}

export interface MatchSheetDto {
  squad: SquadSummaryDto;
  match: MatchDto;
  canEdit: boolean;
  entries: MatchSheetEntryDto[];
  /** Datos del equipo en el partido; null si el cuerpo técnico no los ha apuntado. */
  teamStats?: TeamMatchStatsDto | null;
  /** El partido tiene convocatoria con algún convocado: el acta se prepara con esos jugadores. */
  hasCallUp?: boolean;
  /** Ya está el acta oficial del partido: de ella salen los dorsales (sin ella no hay). */
  officialSheet?: boolean;
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
  goalKicksFor: number;
  goalKicksAgainst: number;
  notes: string | null;
}

export interface TeamMatchStatsDto extends TeamMatchStatsInput {
  updatedAt: string;
  /** Con qué analizador del vídeo salieron (nombre y versión, p. ej. «Ojeador 1.0.0»); null si se apuntaron a mano. */
  videoAnalyzer: string | null;
  /** Cuándo se volcaron del vídeo; si updatedAt es posterior, se retocaron a mano después. */
  fromVideoAt: string | null;
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
  goalKicksFor: number;
  goalKicksAgainst: number;
}

export interface SquadTeamStatsDto {
  matchesRecorded: number;
  averages: TeamStatsAveragesDto | null;
  matches: { match: MatchDto; stats: TeamMatchStatsDto }[];
}

/** Línea del acta tal y como se envía: con played = false se borra la línea si existía. El dorsal no va: es el del acta oficial. */
export interface MatchSheetEntryInput extends PerformanceStats {
  squadPlayerId: string;
  played: boolean;
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
  /** Sigue lesionado hoy; solo para quien es de la plantilla (club, cuerpo técnico, jugadores vinculados) y el administrador. */
  injured?: boolean;
  /** Su lesión abierta; null si no lo está o si quien mira no puede ver el detalle (un compañero). */
  injury?: InjuryBriefDto | null;
}

export interface SquadSeasonTableDto {
  squad: SquadSummaryDto;
  teamMatchesPlayed: number;
  internalSheets: number;
  officialSheets: number;
  rows: SquadSeasonRowDto[];
}

/** Cómo llega alguien al próximo partido de liga: amarillas del ciclo y, si no puede estar, el porqué. */
export interface DisciplineDto {
  /** Amarillas del ciclo antes de ese partido (con la quinta se pierde el siguiente). */
  cycleYellows: number;
  /** Si no puede jugar ni entrar en la convocatoria (o, en el cuerpo técnico, estar en el banquillo); null si puede. */
  suspension: SuspensionBriefDto | null;
  /** Cuatro amarillas del ciclo y ninguna sanción: con una más se pierde el siguiente. */
  warned: boolean;
}

/** Tarjetas de la temporada de alguien del cuerpo técnico en las actas oficiales cerradas y cómo llega al próximo partido. */
export interface StaffDisciplineDto {
  yellowCards: number;
  redCards: number;
  next: DisciplineDto;
}

export interface SquadDisciplineDto {
  /** El próximo partido de liga del equipo, al que se refiere todo; null si no queda ninguno. */
  nextMatchId: string | null;
  nextMatchKickoffAt: string | null;
  nextMatchday: number | null;
  /** Solo los apercibidos o sancionados para ese partido. */
  players: { squadPlayerId: string; next: DisciplineDto }[];
  /** El cuerpo técnico de la plantilla que figura en las actas oficiales, con sus tarjetas. */
  staff: { coachId: string; discipline: StaffDisciplineDto }[];
  /** Las amarillas del ciclo con que llega cada jugador a ese partido y por qué; quien no ha visto ninguna no sale. */
  cycles: PlayerYellowCycleDto[];
}

/** Las amarillas del ciclo de un jugador antes del próximo partido, con lo que explica que no sean todas las de la temporada. */
export interface PlayerYellowCycleDto {
  squadPlayerId: string;
  /** De 0 a 4: con 4 está apercibido. */
  inCycle: number;
  /** La jornada de cada amarilla del ciclo, en orden (una por amarilla). */
  cycleMatchdays: number[];
  /** Jornadas en que cumplió ciclo (la 5.ª amarilla, la 10.ª…): después se empieza de cero. */
  completedAt: number[];
  /** Jornadas en que le expulsaron por doble amarilla: esas dos amarillas no cuentan para el ciclo. */
  secondYellowMatchdays: number[];
}

export interface SquadStatsDto {
  squad: SquadSummaryDto;
  teamMatchesPlayed: number;
  matchesRecorded: number;
  players: SquadPlayerStatsDto[];
}

// --- Competiciones / equipos ---

export type TerritoryKind = 'National' | 'Regional';

/** Ámbito de una liga: quién la organiza, la federación española (Nacional) o la de una comunidad (Asturias…). */
export interface TerritoryDto {
  id: string;
  name: string;
  kind: TerritoryKind;
}

export interface CompetitionDto {
  id: string;
  name: string;
  category: string;
  level: CompetitionLevel;
  tier: number;
  group: string | null;
  /** Dónde se juega (la 3ª RFEF · Grupo 2 es nacional y asturiana). */
  region: string;
  territory: TerritoryDto;
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
  /** Añadida o corregida por el club: el proveedor ya no la sobrescribe. */
  managedByClub: boolean;
  /** Foto subida por el club (ruta relativa a la API con versión); null si no hay. */
  photoUrl: string | null;
  /** Totales de la temporada según las actas oficiales; null si aún no aparece en ninguna. */
  stats: RosterEntryStatsDto | null;
  /** Dorsales que ha llevado según las actas oficiales, del más usado al menos. La ficha no tiene un dorsal fijo. */
  shirtNumbers: ShirtNumberUsageDto[];
}

/** Un dorsal y cuánto lo ha llevado un jugador: el de cada partido sale de su acta. */
export interface ShirtNumberUsageDto {
  number: number;
  /** Partidos en los que consta con este dorsal (titular o suplente). */
  matches: number;
  /** Porcentaje sobre sus partidos con dorsal conocido (0-100; entre todos suman 100). */
  percentage: number;
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
  fouls?: number;
  recoveries?: number;
  clearances?: number;
  passesCompleted?: number;
  passesAttempted?: number;
}

/** Ficha de un jugador de la plantilla con sus actas oficiales y las de Tercer Tiempo (vista del club). */
export interface RosterEntryDetailDto {
  entry: RosterEntryDto;
  official: RosterOfficialAppearanceDto[];
  internal: RosterInternalAppearanceDto[];
  internalStats: RosterInternalStatsDto | null;
  /** El cuerpo técnico lleva la plantilla en Tercer Tiempo y este jugador está en ella. */
  hasSquad: boolean;
  /** Partidos que ha jugado ya el equipo en la temporada. */
  teamMatchesPlayed?: number;
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
  /** Partidos que ha jugado ya el equipo en la temporada, para comparar con los suyos. */
  teamMatchesPlayed?: number;
}

export interface RosterEntryRequest {
  fullName: string;
  position: Position | null;
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
  /** Cuerpo técnico de la temporada según las actas oficiales (público). */
  staff?: TeamStaffDto | null;
  /** Página del equipo en futbolasturiano.es, que facilita calendario, resultados y plantilla. */
  sourceUrl?: string | null;
}

export interface TeamStaffDto {
  /** Actas de la temporada que traen el cuerpo técnico del equipo. */
  sheets: number;
  /** Los actuales primero, del entrenador al encargado de material. */
  members: TeamStaffMemberDto[];
}

export interface TeamStaffMemberDto {
  name: string;
  /** Función con la que más figura en las actas, como la escribe la federación; null si solo está nombrado en la app. */
  officialRoleLabel: string | null;
  officialRole: OfficialStaffRole | null;
  /** Función en el cuerpo técnico de la app si el club lo ha nombrado. */
  role: StaffRole | null;
  appearances: number;
  lastSeen: string | null;
  /** false si ya no figura en las últimas actas y no tiene un nombramiento vigente. */
  current: boolean;
  /** Su perfil en la app (solo a cuentas con sesión). */
  coachId: string | null;
  /** Si ya tiene perfil en la app; si no, sale con el nombre del acta oficial. */
  hasProfile: boolean;
  /** Sus tarjetas de la temporada y cómo llega al próximo partido; null si solo está nombrado en la app. */
  discipline?: StaffDisciplineDto | null;
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
  /** Medidas del terreno de juego en metros; las apunta el club del equipo (null si no lo ha hecho). */
  pitchLengthM?: number | null;
  pitchWidthM?: number | null;
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
  /** Despejes. */
  clearances?: number;
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
  /** Dorsal con el que jugó: el del acta oficial del partido si ya está, si no el de su ficha. */
  shirtNumber: number | null;
  /** Dorsal de este partido según el acta oficial (null si aún no está o no sale en ella). No se escribe a mano. */
  matchShirtNumber: number | null;
  teamId: string;
  updatedAt: string;
  playerPhotoUrl?: string | null;
  /** Las acciones las puso el vídeo y aún no cuentan en la nota: el cuerpo técnico las hace suyas al guardar el acta. */
  actionsFromVideo?: boolean;
  /** Goles que encajó el equipo con él en el campo, según el acta oficial cerrada; null si no se sabe. */
  goalsConcededOnPitch?: number | null;
}

// --- Previa del partido (cuerpo técnico) ---

export interface MatchPreviewDto {
  match: MatchDto;
  competitionName: string;
  home: TeamPreviewDto;
  away: TeamPreviewDto;
  prediction: PredictionDto;
  dataNotes: string[];
  /** Hasta cuándo cuentan los datos: el inicio del partido (la previa de la jornada 1 no sabe nada de la 10). */
  asOf?: string | null;
  /** Partidos de la liga jugados antes de este. */
  leagueMatchesBefore?: number;
  /** true: clasificación calculada con los resultados de antes del partido; false: la oficial de hoy. */
  tableFromResults?: boolean;
  /** Enfrentamientos anteriores entre los dos equipos, de esta temporada y de las pasadas guardadas. */
  headToHead?: HeadToHeadDto | null;
}

export interface HeadToHeadDto {
  played: number;
  /** Victorias del local de este partido, jugara donde jugara aquellos. */
  homeWins: number;
  draws: number;
  awayWins: number;
  homeGoals: number;
  awayGoals: number;
  /** Temporadas distintas con algún enfrentamiento. */
  seasons: number;
  /** Del más reciente al más antiguo. */
  matches: HeadToHeadMatchDto[];
}

export interface HeadToHeadMatchDto {
  matchId: string;
  seasonLabel: string;
  competitionName: string;
  matchday: number;
  kickoffAt: string;
  homeTeam: TeamRefDto;
  awayTeam: TeamRefDto;
  homeGoals: number;
  awayGoals: number;
  /** Para el local de este partido. */
  outcome: 'W' | 'D' | 'L';
  /** De la misma temporada y liga. */
  sameSeason: boolean;
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
  /** El dorsal que más ha llevado según las actas oficiales. */
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
  /** Public: acepta solicitudes de acceso a cada partido; nada se ve sin un pase. */
  visibility: SquadVisibility;
  visible: boolean;
  /** Es de dentro (club, cuerpo técnico, jugadores o administrador): puede abrir la plantilla y el comparador. */
  insider: boolean;
  entries: PerformanceDto[];
  /** Para los de fuera: lo que le abren sus pases y cómo pedir el acceso; null para los de dentro. */
  access: MatchSheetAccessDto | null;
}

export interface MatchSheetAccessDto {
  sheetPass: boolean;
  videoPass: boolean;
  downloadPass: boolean;
  /** Plantilla pública de un club con licencia y partido jugado: se puede solicitar. */
  canRequest: boolean;
  hasVideo: boolean;
  sheetPriceCents: number;
  videoPriceCents: number;
  currency: string;
  /** Última solicitud de quien mira para este partido. */
  requestStatus: MatchPassRequestStatus | null;
  /** Pase aprobado para quien mira y todavía sin canjear. */
  readyPassCode: string | null;
  readyPassPriceCents: number | null;
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
  clearances?: number;
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
  leagueAvgGoalsAgainstPerMatch: number;
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
  /** Dorsales que ha llevado: en cada partido, el apuntado en el acta interna y, si no, el del acta oficial. */
  shirtNumbers: ShirtNumberUsageDto[];
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
  /** Cuerpo técnico que firma el acta (entrenador, segundo, delegados...). */
  staff?: OfficialStaffDto[] | null;
}

export type OfficialStaffRole =
  | 'HeadCoach' | 'AssistantCoach' | 'GoalkeeperCoach' | 'FitnessCoach' | 'TeamDelegate' | 'FieldDelegate'
  | 'Physio' | 'Medical' | 'KitManager' | 'Other';

export interface OfficialStaffDto {
  role: OfficialStaffRole;
  /** Tal y como lo escribe el acta («Entrenador», «2º Entrenador», «Delegado de campo»...). */
  roleLabel: string;
  /** «APELLIDOS, NOMBRE», como en el acta. */
  fullName: string;
  /** Su perfil en Tercer Tiempo, si tiene un nombramiento del club con ese nombre. */
  coachId?: string | null;
  /** Amarillas que le enseñó el árbitro en el partido (0 a 2). */
  yellowCards?: number;
  /** Expulsado: roja directa o doble amarilla. */
  redCard?: boolean;
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
  /** Equipo arbitral: el que pitó (o, sin leerlo aún, el árbitro que trae el acta) o, en un partido por jugar, el designado; null si no se sabe nada. */
  referees: SheetRefereesDto | null;
  message: string | null;
  home: OfficialTeamSheetDto | null;
  away: OfficialTeamSheetDto | null;
  events: OfficialEventDto[];
}

/** Equipo arbitral del acta pública. */
export interface SheetRefereesDto {
  /** Partido por jugar: los designados por la federación, que pueden cambiar hasta el día del partido (vacío: aún sin designar). */
  designated: boolean;
  /** Por función: árbitro, asistentes y cuarto árbitro. */
  officials: SheetOfficialDto[];
}

export interface SheetOfficialDto {
  role: OfficialRole;
  name: string;
  /** Su ficha de árbitro; null si solo se sabe el nombre que trae el acta. */
  refereeId: string | null;
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

/** Uploaded (en cola para comprimir), Processing, Ready o Failed. Se ve y se descarga en todos: hasta Ready se sirve el original. */
export type VideoStatus = 'Uploaded' | 'Processing' | 'Ready' | 'Failed';

export interface MatchVideoDto {
  id: string;
  matchId: string;
  squadId: string;
  teamId: string;
  teamName: string;
  part: VideoPart;
  /** Siempre el nombre del partido: «Local vs Visitante dd-mm-aaaa» (con la parte si va en dos). */
  title: string;
  fileName: string;
  contentType: string;
  /** Lo que ocupa; solo para quien lo subió (null para los demás). */
  sizeBytes: number | null;
  uploadedAt: string;
  uploadedBy: string;
  access: VideoAccessLevel;
  canWatch: boolean;
  /** El club y el cuerpo técnico vigente, o un pase con descarga. */
  canDownload: boolean;
  canDelete: boolean;
  status: VideoStatus;
  /** Avance de la compresión en %, mientras está en Processing. */
  progress: number;
  /** Lo que ocupaba el archivo subido, cuando se ha sustituido por el comprimido; solo para quien lo subió. */
  originalSizeBytes: number | null;
  durationSeconds: number | null;
  /** Alto en píxeles (1080 = Full HD) cuando se conoce. */
  height: number | null;
  /** Por qué no se pudo comprimir (solo para el club y el cuerpo técnico). */
  processingError: string | null;
}

/**
 * Estado del análisis de un vídeo: NotRequested (el vídeo está listo pero nadie lo ha pedido), WaitingForVideo (se está
 * comprimiendo: el análisis empieza solo al acabar), Pending (en cola), Running, Ready, Failed o Cancelled (lo paró el
 * cuerpo técnico; se puede volver a pedir) o Paused (en pausa: si se estaba analizando espera donde iba sin perder
 * nada; si estaba en cola no se empieza).
 */
export type VideoAnalysisState = 'NotRequested' | 'WaitingForVideo' | 'Pending' | 'Running' | 'Ready' | 'Failed' | 'Cancelled' | 'Paused';

/** Etapas del análisis, en orden: cargar los modelos, separar los equipos, seguir a jugadores y balón, sacar las jugadas, repasar la propuesta y escribir lo que sale. */
export type VideoAnalysisStage = 'models' | 'teams' | 'tracking' | 'plays' | 'review' | 'outputs';

/** Lo que está haciendo ahora el analizador; cada dato puede faltar según la etapa. */
export interface VideoAnalysisLive {
  stage: VideoAnalysisStage | string;
  /** El analizador ya se ha detenido de verdad (no solo se ha pedido la pausa). */
  paused: boolean;
  /** Segundo del vídeo por el que va, y el tramo que analiza. */
  videoSecond?: number | null;
  fromSecond?: number | null;
  toSecond?: number | null;
  frames?: number | null;
  framesTotal?: number | null;
  playersOnScreen?: number | null;
  playersTracked?: number | null;
  ballSeenPct?: number | null;
  calibratedPct?: number | null;
  /** Fotogramas por segundo que procesa y cuántas veces el tiempo real va. */
  fps?: number | null;
  speed?: number | null;
  remainingSeconds?: number | null;
  teamSamples?: number | null;
  teamSamplesTarget?: number | null;
  /** Colores medios de las dos equipaciones (#rrggbb) en cuanto se separan. */
  colors?: string[] | null;
  touches?: number | null;
  events?: number | null;
  pausedSeconds?: number | null;
}

export interface VideoAnalysisLogEntry {
  at: string;
  text: string;
}

/** Datos de equipo que salen del vídeo y se aceptan uno a uno. */
export type VideoTeamField = 'Possession' | 'Shots' | 'ShotsOnTarget' | 'Corners' | 'ThrowIns' | 'GoalKicks' | 'Fouls' | 'Offsides';

export interface VideoAnalysisQualityDto {
  frames: number;
  /** % de fotogramas analizados con el balón a la vista. */
  ballFramesPct: number;
  /** % de fotogramas con el campo calibrado (sin él no salen tercios, fueras, tiros ni córners). */
  calibratedFramesPct: number;
  analyzedSeconds: number;
  lowBall: boolean;
  lowCalibration: boolean;
  /** Medidas del campo con las que se calibró: las del club local o, si no las ha apuntado, las genéricas (120 × 70). */
  pitchLengthM: number | null;
  pitchWidthM: number | null;
  genericPitch: boolean;
  /** % de los fotogramas del tramo que se pudieron leer del archivo; null en análisis anteriores al dato. */
  readFramesPct: number | null;
  /** No se leyó al menos el 95 %: archivo dañado o cortado, la propuesta sale de menos. */
  lowRead: boolean;
}

/** Uno de los dos equipos que separa el analizador por su equipación: él no sabe cuál es el del club. */
/** Confianza de la posesión: el analizador la mide solo sobre el tiempo con balón. Con Low se enseña, pero no se vuelca al acta. */
export type VideoPossessionConfidence = 'Low' | 'Medium' | 'High';

export interface VideoAnalysisTeamDto {
  index: number;
  /** Lado del acta oficial que tiene este equipo según los dorsales; null si no se sabe. */
  side: 'Home' | 'Away' | null;
  /** Color medio de la equipación (#rrggbb). */
  color: string | null;
  players: number;
  possessionPct: number | null;
  /** null en análisis anteriores al dato. */
  possessionConfidence: VideoPossessionConfidence | null;
  /** % del tramo con balón visto o interpolado, sobre el que se midió la posesión. */
  possessionBallPct: number | null;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  throwIns: number;
  goalKicks: number;
  /** Con el acta oficial cerrada, como mucho los suyos. */
  goals: number;
  /** Faltas que comete: el juego se para con el balón en el campo y un jugador de este equipo estaba a menos de 5 m del que lo tenía. */
  fouls: number;
  /** Fueras de juego que le pitan. */
  offsides: number;
  /** Cuándo pasó cada uno en el vídeo; null en análisis anteriores a Ojeador 2.1.2. */
  moments: VideoTeamMoments | null;
}

export interface VideoPlayerActions {
  shots: number;
  shotsOnTarget: number;
  goals: number;
  saves: number;
  recoveries: number;
  ballLosses: number;
  passesCompleted: number;
  passesAttempted: number;
  touches: number;
  /** Faltas que comete (sí tienen casilla en el acta). */
  fouls: number;
  /** Faltas que recibe y fueras de juego: solo se enseñan. */
  foulsReceived: number;
  offsides: number;
}

/**
 * Segundo del vídeo (desde el principio del archivo, con una décima) de cada acción del jugador, en orden: los mismos
 * filtros que sus contadores, uno por acción. Llega desde Ojeador 2.1.2; null en análisis anteriores.
 */
export interface VideoPlayerMoments {
  shots: number[];
  /** Los tiros de shots que fueron a puerta. */
  shotsOnTarget: number[];
  goals: number[];
  saves: number[];
  recoveries: number[];
  /** Todas las pérdidas; las que fueron un pase al rival están también en passesFailed, con el mismo segundo. */
  ballLosses: number[];
  passesCompleted: number[];
  passesFailed: number[];
  fouls: number[];
  foulsReceived: number[];
  offsides: number[];
}

/** Lo mismo para un equipo: el segundo del vídeo de cada tiro, gol, córner, saque, falta y fuera de juego (Ojeador 2.1.2). */
export interface VideoTeamMoments {
  shots: number[];
  shotsOnTarget: number[];
  goals: number[];
  corners: number[];
  throwIns: number[];
  goalKicks: number[];
  fouls: number[];
  offsides: number[];
}

/** Jugador seguido por el analizador («tracklet»): se corta al perderlo de vista, así que un jugador puede tener varios. */
export interface VideoAnalysisPlayerDto {
  tracklet: number;
  team: number;
  goalkeeper: boolean;
  /** Recorte del jugador; hay que pedirlo con la sesión iniciada. */
  cropUrl: string | null;
  minutesVisible: number;
  from: string;
  to: string;
  distanceM: number;
  shirtNumber: number | null;
  proposal: VideoPlayerActions;
  /** Ficha a la que se asignó la última vez que se volcó. */
  squadPlayerId: string | null;
  /** Nombre del jugador con ese dorsal en el acta oficial. */
  sheetName: string | null;
  /** Parte de las lecturas que dicen ese dorsal (0-1). */
  shirtConfidence: number | null;
  /** Ficha que por el dorsal y el acta oficial es este jugador; null si no se sabe o es del rival. */
  suggestedSquadPlayerId: string | null;
  /** Minutos que jugó según el acta oficial cerrada (por descarte: sin cambio, el partido entero); null sin acta cerrada o sin identificar. */
  sheetMinutes: number | null;
  /** Cuándo pasó cada acción en el vídeo; null en análisis anteriores a Ojeador 2.1.2. */
  moments: VideoPlayerMoments | null;
}

export interface VideoAnalysisPartDto {
  videoId: string;
  part: VideoPart;
  title: string;
  videoStatus: VideoStatus;
  videoProgress: number;
  /** Duración del vídeo en segundos, cuando se conoce: el análisis tarda más o menos lo mismo. */
  durationSeconds: number | null;
  state: VideoAnalysisState;
  progress: number;
  error: string | null;
  requestedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** Nombre del analizador que analizó el vídeo (p. ej. «Ojeador»). */
  analyzerName: string | null;
  analyzerVersion: string | null;
  /** Modelos con los que se analizó (arquitectura, entrenamiento, motor y huella de cada uno, separados por « · »); solo para el administrador. */
  weights: string | null;
  quality: VideoAnalysisQualityDto | null;
  teams: VideoAnalysisTeamDto[];
  /** Cuál de los dos equipos (0 o 1) dijo el cuerpo técnico que era el suyo la última vez que volcó. */
  ourTeam: number | null;
  appliedAt: string | null;
  players: VideoAnalysisPlayerDto[];
  /** Lo que está haciendo ahora el analizador (Running o Paused); null si aún no ha contado nada. */
  live: VideoAnalysisLive | null;
  liveAt: string | null;
  /** Lo que ha ido sabiendo en esta pasada (últimas 40 líneas, de la más antigua a la más reciente). */
  log: VideoAnalysisLogEntry[] | null;
  pausedAt: string | null;
  /** Segundos en pausa en esta pasada (no cuentan en lo que tarda). */
  pausedSeconds: number;
  /** En pausa a medias (el analizador espera donde iba); false si se pausó en cola o el analizador se reinició: al reanudar empieza desde el principio. */
  pausedMidway: boolean;
  /** Cada jugador es una persona identificada por el dorsal leído en el vídeo y cruzado con el acta oficial; false: cada línea es un tramo seguido. */
  identified: boolean;
  /** El equipo (0 o 1) que por los dorsales es el de la plantilla; null si no se sabe. */
  suggestedOurTeam: number | null;
  /** Segundos con jugadores a la vista sin identificar, por equipo. */
  unidentifiedSeconds: Record<string, number> | null;
  /** Formato del archivo que se reproduce (para ver cada acción en su momento). */
  contentType: string | null;
}

export interface MatchVideoAnalysisDto {
  /** Se pueden pedir análisis en este servidor; los atiende el analizador que esté en marcha (si no hay ninguno, esperan en cola). */
  enabled: boolean;
  /** Club propietario o cuerpo técnico vigente; el administrador solo lo ve. */
  canManage: boolean;
  videos: VideoAnalysisPartDto[];
  /** Algún analizador ha dado señales en los últimos 2 minutos; si no, lo que está en cola no avanza. */
  analyzerOnline: boolean;
  /** Última señal de un analizador; null si nunca ha habido ninguno. */
  analyzerSeenAt: string | null;
  /** El acta oficial está cerrada: al volcar, los minutos (por descarte), la titularidad, los goles y las tarjetas salen de ella. */
  officialSheetClosed: boolean;
}

export interface ApplyVideoAnalysisRequest {
  videos: { videoId: string; ourTeam: number; players: { tracklet: number; squadPlayerId: string }[] }[];
  teamFields: VideoTeamField[];
  /** true para confirmar que se sobrescriben los datos del acta que el vídeo cambiaría. */
  overwrite: boolean;
  /** Con el acta oficial cerrada, completar minutos, titulares, goles y tarjetas con ella (también de los que no salen en el vídeo). */
  fillFromOfficialSheet: boolean;
}

export interface ApplyVideoAnalysisResultDto {
  sheet: MatchSheetDto;
  analysis: MatchVideoAnalysisDto;
  teamValuesWritten: number;
  linesWritten: number;
  playersWithoutChanges: number;
  /** Líneas creadas o cambiadas solo con el acta oficial: jugaron, pero el vídeo no los identificó o no se asignaron. */
  linesFromOfficialSheet: number;
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
  /** Solo para reanudar y por su extensión: el vídeo se llama como el partido. */
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface VideoTicketDto {
  videoId: string;
  ticket: string;
  expiresAt: string;
}

// --- Pases por partido: lo único que abre lo interno (acta interna y vídeo) a quien no es de la plantilla ---

export type MatchPassStatus = 'Pending' | 'Redeemed' | 'Revoked' | 'Expired';
export type MatchPassRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface MatchPassDto {
  id: string;
  code: string;
  includesSheet: boolean;
  includesVideo: boolean;
  allowsDownload: boolean;
  priceCents: number;
  currency: string;
  /** Para quién es, como nota del club. */
  recipient: string | null;
  status: MatchPassStatus;
  fromRequest: boolean;
  createdAt: string;
  /** Hasta cuándo se puede canjear. */
  expiresAt: string;
  redeemedAt: string | null;
  redeemedBy: string | null;
  canRevoke: boolean;
}

export interface MatchPassesDto {
  squadId: string;
  matchId: string;
  sheetPriceCents: number;
  videoPriceCents: number;
  currency: string;
  /** Lo que se queda el club de cada venta; el resto es de la plataforma. */
  clubSharePercent: number;
  hasSheet: boolean;
  hasVideo: boolean;
  openToRequests: boolean;
  passes: MatchPassDto[];
}

export interface CreateMatchPassRequest {
  includesSheet: boolean;
  includesVideo: boolean;
  allowsDownload: boolean;
  /** Céntimos; null = el precio del club para ese partido. */
  priceCents: number | null;
  recipient: string | null;
}

export interface PassPreviewDto {
  code: string;
  status: MatchPassStatus;
  squadId: string;
  teamId: string;
  teamName: string;
  clubName: string;
  match: MatchDto;
  includesSheet: boolean;
  includesVideo: boolean;
  allowsDownload: boolean;
  priceCents: number;
  currency: string;
  expiresAt: string;
  /** Ya lo canjeó esta cuenta. */
  mine: boolean;
  /** Es de una solicitud de otra persona: esta cuenta no puede canjearlo. */
  forSomeoneElse: boolean;
}

export interface MyPassDto {
  id: string;
  code: string;
  squadId: string;
  teamId: string;
  teamName: string;
  match: MatchDto;
  includesSheet: boolean;
  includesVideo: boolean;
  allowsDownload: boolean;
  priceCents: number;
  currency: string;
  redeemedAt: string;
}

export interface MyPassRequestDto {
  id: string;
  squadId: string;
  teamId: string;
  teamName: string;
  match: MatchDto;
  wantsSheet: boolean;
  wantsVideo: boolean;
  message: string | null;
  status: MatchPassRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  /** Código del pase aprobado (para canjearlo). */
  passCode: string | null;
  passPriceCents: number | null;
  passIncludesSheet: boolean;
  passIncludesVideo: boolean;
  passRedeemed: boolean;
}

export interface MyPassesDto {
  passes: MyPassDto[];
  requests: MyPassRequestDto[];
}

export interface PassAccessRequest {
  squadId: string;
  matchId: string;
  wantsSheet: boolean;
  wantsVideo: boolean;
  message: string | null;
}

export interface ClubPassRequestDto {
  id: string;
  squadId: string;
  teamId: string;
  teamName: string;
  match: MatchDto;
  requesterName: string;
  wantsSheet: boolean;
  wantsVideo: boolean;
  message: string | null;
  status: MatchPassRequestStatus;
  createdAt: string;
  decidedAt: string | null;
  hasVideo: boolean;
  sheetPriceCents: number;
  videoPriceCents: number;
  currency: string;
  passCode: string | null;
  passRedeemed: boolean;
}

export interface ApprovePassRequest {
  includesSheet: boolean;
  includesVideo: boolean;
  allowsDownload: boolean;
  priceCents: number | null;
}

export interface MatchPassPriceDto {
  squadId: string;
  matchId: string;
  teamId: string;
  teamName: string;
  match: MatchDto;
  hasSheet: boolean;
  hasVideo: boolean;
  openToRequests: boolean;
  /** Precio propio del partido; null = el del club. */
  sheetPriceCents: number | null;
  videoPriceCents: number | null;
  effectiveSheetPriceCents: number;
  effectiveVideoPriceCents: number;
}

export interface ClubPassPricesDto {
  sheetPriceCents: number;
  videoPriceCents: number;
  currency: string;
  /** Lo que se queda el club de cada venta (el resto es de la plataforma). */
  clubSharePercent: number;
  matches: MatchPassPriceDto[];
}

export interface PassSaleDto {
  id: string;
  paidAt: string;
  teamName: string;
  match: MatchDto | null;
  buyer: string | null;
  includesSheet: boolean;
  includesVideo: boolean;
  amountCents: number;
  clubShareCents: number;
  platformShareCents: number;
  currency: string;
  provider: string;
}

export interface PassEarningsDto {
  salesCount: number;
  grossCents: number;
  clubShareCents: number;
  platformShareCents: number;
  currency: string;
  clubSharePercent: number;
  recent: PassSaleDto[];
}

export interface ClubEarningsRowDto {
  clubId: string;
  clubName: string;
  salesCount: number;
  grossCents: number;
  clubShareCents: number;
  platformShareCents: number;
}

export interface PlatformPassEarningsDto {
  salesCount: number;
  grossCents: number;
  clubShareCents: number;
  platformShareCents: number;
  currency: string;
  clubs: ClubEarningsRowDto[];
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
  /** Entorno que la hizo (en las descargas, el que tenía el bloqueo). */
  environment?: string | null;
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
  /** Solo con la temporada completa: una temporada pasada («2025/2026») para los precedentes de la previa; null = la actual. */
  season?: string | null;
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

/** Una sesión abierta (un inicio de sesión: la misma cuenta en dos dispositivos son dos). */
export interface PresenceSessionDto {
  sessionId: string;
  userId: string;
  accountType: AccountType;
  name: string;
  email: string | null;
  /** El equipo del jugador, los de las plantillas del técnico o los del club. */
  teams: string | null;
  /** Página de la web en la que está. */
  path: string | null;
  /** «Chrome · Windows», «Safari · iPhone». */
  device: string;
  /** online: señales en los últimos 150 segundos; idle: en los últimos 30 minutos. */
  status: 'online' | 'idle';
  startedAt: string;
  lastSeenAt: string;
}

export interface PresenceOverviewDto {
  online: number;
  idle: number;
  clubs: number;
  coaches: number;
  players: number;
  /** Sesiones que cumplen la búsqueda (se devuelven como mucho 500, las más recientes). */
  matching: number;
  sessions: PresenceSessionDto[];
  generatedAt: string;
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
  /** Descarga de las webs a la base de datos reales: solo la hace el entorno que tiene el bloqueo. */
  realData?: boolean;
  /** Lo ejecuta otro proceso (el servicio de vídeo) cuando le llega trabajo: sin horario ni lanzamiento a mano. */
  external?: boolean;
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
  /** Quién descarga ahora los datos reales (la base que comparten todos los entornos); null si nadie. */
  ingester?: RealDataIngesterDto | null;
}

export interface RealDataIngesterDto {
  environment: string;
  machine: string;
  since: string;
  heartbeatAt: string;
  /** Es este mismo proceso. */
  thisProcess: boolean;
  /** Este entorno puede descargar cuando el otro pare. */
  thisEnvironmentCanIngest: boolean;
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

/** Lo que ve cualquiera: para qué sirve cada dato, sin su nombre técnico. */
export interface CookieDto {
  id: string;
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

/** Un tipo del catálogo de lesiones, como lo ve el administrador. */
export interface AdminInjuryTypeDto {
  code: string;
  label: string;
  /** Duración media orientativa en días; null si no hay referencia. */
  averageDays: number | null;
  sortOrder: number;
  /** false = retirado: no se ofrece para lesiones nuevas, pero sigue en las que ya lo tienen. */
  active: boolean;
  /** Lesiones guardadas con este tipo; con alguna no se puede borrar. */
  injuries: number;
  /** Clase de sitio que pregunta; null si tiene sitio fijo o no pregunta dónde fue. */
  siteKind: BodySiteKind | null;
  /** Sitio fijo; null si no tiene. */
  baseSite: string | null;
  /** Con sitio fijo, lo que lo precisa; con clase, solo esos (vacía: todos los de la clase). */
  sites: string[];
  graded: boolean;
  updatedAt: string;
}

export type SaveInjuryTypeRequest = Pick<
  AdminInjuryTypeDto,
  'label' | 'averageDays' | 'sortOrder' | 'active' | 'siteKind' | 'baseSite' | 'sites' | 'graded'
>;

/** Un sitio del catálogo del cuerpo, como lo ve el administrador. */
export interface AdminBodySiteDto extends BodySiteDto {
  sortOrder: number;
  /** Lesiones guardadas en este sitio. */
  injuries: number;
  /** Tipos de lesión que lo tienen como sitio fijo o en su lista. */
  types: number;
  /** Sitios de su grupo, si es un grupo. */
  children: number;
  updatedAt: string;
}

export type SaveBodySiteRequest = Pick<
  AdminBodySiteDto,
  'label' | 'kind' | 'region' | 'parent' | 'paired' | 'agreement' | 'sortOrder' | 'active'
>;

/** El catálogo del administrador: lo mismo más el nombre técnico de cada dato. */
export interface AdminCookieDto extends CookieDto {
  name: string;
}

export interface AdminCookiePolicyDto {
  version: string;
  updatedAt: string;
  cookies: AdminCookieDto[];
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

export type UpsertCookieRequest = Pick<AdminCookieDto, 'name' | 'category' | 'storage' | 'provider' | 'purpose' | 'duration' | 'sortOrder'>;

// --- Buscador ---

export type SearchType = 'competition' | 'team' | 'club' | 'player' | 'coach' | 'match' | 'squad' | 'referee';

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

export * from './trainings';
