import type { InjuryOccasionDto, MatchDto, Position } from './api';

// --- Entrenamientos, ejercicios, asistencia y convocatorias (preparación semanal del cuerpo técnico) ---

export type TrainingKind = 'Season' | 'Preseason' | 'Recovery' | 'MatchPreparation' | 'Other';
export type ExerciseType = 'Warmup' | 'Technical' | 'Tactical' | 'Physical' | 'Goalkeeping' | 'SetPieces' | 'Game' | 'Cooldown' | 'Other';
/** Cuenta con venir, ha avisado de que falta, vino o faltó sin avisar. */
export type AttendanceStatus = 'Expected' | 'WillMiss' | 'Attended' | 'Missed';
/**
 * Lo que hay en la agenda de la plantilla: la citación a un entrenamiento (va toda la plantilla; el jugador solo avisa si
 * falta) o un partido, con su convocatoria (va quien convoca el cuerpo técnico; el jugador la firma).
 */
export type SquadEventKind = 'Training' | 'Match';
export type CallUpStatus = 'Draft' | 'Published';
/** El convocado firma la convocatoria; el que no va se da por enterado. No hay «no puedo» para los partidos. */
export type CallUpResponse = 'Pending' | 'Confirmed' | 'Acknowledged';
export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TrainingKindDto {
  kind: TrainingKind;
  label: string;
  description: string;
}

export interface ExerciseTypeDto {
  type: ExerciseType;
  label: string;
  description: string;
}

export interface TrainingCatalogDto {
  kinds: TrainingKindDto[];
  exerciseTypes: ExerciseTypeDto[];
  minDurationMinutes: number;
  maxDurationMinutes: number;
  maxItems: number;
  /** Sesiones como mucho al crear un entrenamiento con repetición semanal. */
  maxSeriesSessions: number;
}

export interface ExerciseDto {
  id: string;
  name: string;
  type: ExerciseType;
  typeLabel: string;
  durationMinutes: number;
  description: string | null;
  material: string | null;
  updatedAt: string;
}

export interface ExerciseRequest {
  name: string;
  type: ExerciseType;
  durationMinutes: number;
  description: string | null;
  material: string | null;
}

export interface TrainingItemDto {
  id: string;
  order: number;
  /** Ejercicio de la biblioteca del que se copió; null si se escribió suelto o se borró de la biblioteca. */
  exerciseId: string | null;
  name: string;
  type: ExerciseType;
  typeLabel: string;
  durationMinutes: number;
  notes: string | null;
  /** Quién lo hace; vacío = toda la plantilla. */
  positions: Position[];
}

export interface TrainingItemInput {
  exerciseId: string | null;
  name: string;
  type: ExerciseType;
  durationMinutes: number;
  notes: string | null;
  /** Quién lo hace; vacío = toda la plantilla. */
  positions: Position[];
}

export interface TrainingAttendanceDto {
  /** Ficha de la plantilla; null si la línea es de un jugador de prueba. */
  squadPlayerId: string | null;
  /** Jugador de prueba (sin ficha); null si la línea es de un jugador de la plantilla. */
  trialPlayerId: string | null;
  playerName: string;
  shirtNumber: number | null;
  /** Tiene cuenta vinculada: puede avisar de que falta desde la app. */
  linked: boolean;
  /** Viene a prueba, sin ficha en la plantilla. */
  trial: boolean;
  /** Acabada la sesión, lo que fue: Attended (vino) o Missed (faltó). */
  status: AttendanceStatus;
  reason: string | null;
  updatedAt: string;
  /** Faltó habiendo avisado antes (solo en sesiones acabadas). */
  warned: boolean;
  /** Lesionado el día de la sesión: no entrena ni se le pasa lista. */
  injured: boolean;
  /** Por qué (tipo, motivo y fechas); null si no lo está o si quien mira no puede verlo (un compañero). */
  injury: InjuryBriefDto | null;
  /** Causó baja en la plantilla después de esta sesión: su línea es historial. */
  left?: boolean;
  /** Se lesionó en esta sesión: entrenó hasta entonces, así que se le pasa lista como a los demás. */
  injuredHere?: boolean;
  /** La lesión que se hizo aquí; null si no se lesionó en ella o si quien mira no puede verla. */
  hereInjury?: InjuryBriefDto | null;
}

/** Lo justo de una lesión para explicar por qué un jugador no entrena o no va convocado. */
export interface InjuryBriefDto {
  id: string;
  type: string;
  typeLabel: string;
  reason: string | null;
  startedOn: string;
  /** Vuelta prevista; null si no se sabe. */
  expectedReturnOn: string | null;
  /** Día del alta; null si sigue lesionado. */
  returnedOn: string | null;
  /** Días de baja contados desde el parte: hasta hoy si sigue lesionado, hasta el alta si ya la tiene. */
  daysOut?: number;
  /** El partido o el entrenamiento en que se lesionó; null si fue en otro sitio o no se sabe. */
  occasion?: InjuryOccasionDto | null;
  /** Dónde fue: «Rodilla izquierda», «Bíceps femoral derecho»; null si no lo dice. */
  location?: string | null;
}

/** Alguien que viene a entrenar a prueba, sin ficha: se le pasa lista y, si le hacen ficha, pasa a la plantilla. */
export interface TrialPlayerDto {
  id: string;
  fullName: string;
  notes: string | null;
  createdAt: string;
  /** Entrenamientos en los que se le ha apuntado. */
  sessions: number;
  /** Entrenamientos a los que vino. */
  attended: number;
  /** Ficha de la plantilla que se le hizo; null mientras siga a prueba. */
  promotedSquadPlayerId: string | null;
  promotedAt: string | null;
}

export interface TrialPlayerRequest {
  fullName: string;
  notes: string | null;
}

export interface PromoteTrialPlayerRequest {
  position: Position | null;
  shirtNumber: number | null;
}

/** Apuntar a un jugador de prueba a una sesión: uno conocido (trialPlayerId) o uno nuevo por su nombre. */
export interface TrainingTrialPlayerRequest {
  trialPlayerId: string | null;
  fullName: string | null;
  notes: string | null;
}

export interface AttendanceCountsDto {
  expected: number;
  willMiss: number;
  attended: number;
  missed: number;
  /** Lesionados ese día: no cuentan en los demás. */
  injured: number;
}

export interface TrainingSummaryDto {
  id: string;
  squadId: string;
  /** Las sesiones creadas juntas con repetición semanal comparten seriesId. */
  seriesId: string | null;
  kind: TrainingKind;
  kindLabel: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  location: string | null;
  itemsCount: number;
  plannedMinutes: number;
  started: boolean;
  /** Ya ha acabado: no se cambia; solo se pasa lista. */
  finished: boolean;
  counts: AttendanceCountsDto;
  /** La línea de quien mira, si es un jugador de la plantilla. */
  mine: TrainingAttendanceDto | null;
}

export interface TrainingSessionDto {
  id: string;
  squadId: string;
  seriesId: string | null;
  kind: TrainingKind;
  kindLabel: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  /** Minutos que suman los ejercicios preparados. */
  plannedMinutes: number;
  started: boolean;
  /** Ya ha acabado: no se cambia; solo se pasa lista de quién vino y quién faltó. */
  finished: boolean;
  items: TrainingItemDto[];
  attendance: TrainingAttendanceDto[];
  counts: AttendanceCountsDto;
  canEdit: boolean;
  mine: TrainingAttendanceDto | null;
}

export interface TrainingRequest {
  kind: TrainingKind;
  title: string | null;
  startsAt: string;
  durationMinutes: number;
  location: string | null;
  notes: string | null;
  items: TrainingItemInput[];
  /** Solo al crear: días en los que se repite hasta repeatUntil; vacío = una sola sesión. */
  repeatWeekdays: Weekday[];
  repeatUntil: string | null;
}

/** Una línea por jugador de la plantilla (squadPlayerId) o de prueba (trialPlayerId). */
export interface AttendanceInput {
  squadPlayerId: string | null;
  trialPlayerId: string | null;
  status: AttendanceStatus;
  reason: string | null;
}

export interface MyTrainingDto {
  session: TrainingSummaryDto;
  teamName: string;
  squadId: string;
}

export interface CallUpEntryDto {
  id: string;
  squadPlayerId: string;
  playerName: string;
  shirtNumber: number | null;
  linked: boolean;
  called: boolean;
  response: CallUpResponse;
  respondedAt: string | null;
  /** Cuándo le llegó el aviso (un check); null si no se ha enviado o no tiene cuenta. */
  sentAt: string | null;
  /** Cuándo la abrió por primera vez (doble check verde); firmarla también cuenta como vista. */
  seenAt: string | null;
  /** Lesionado el día del partido: no puede ir convocado. */
  injured: boolean;
  /** Por qué; null si no lo está o si quien mira no puede verlo. */
  injury: InjuryBriefDto | null;
  /** Sancionado para este partido (5.ª amarilla o expulsión en uno anterior): no puede ir convocado. */
  suspended: boolean;
  suspension: SuspensionBriefDto | null;
  /** Amarillas del ciclo que lleva al empezar el partido (de 0 a 4): con 4 está apercibido. */
  cycleYellows: number;
  /** Apercibido para este partido: cuatro amarillas del ciclo y ninguna sanción (la misma regla que en la plantilla). */
  warned: boolean;
  /** Causó baja en la plantilla después del partido: la línea es historial. */
  left?: boolean;
}

/**
 * Por qué está sancionado: el ciclo de cinco amarillas, una doble amarilla, una roja directa o lo que ha publicado el
 * comité de competición (que manda sobre lo de las tarjetas).
 */
export type SuspensionCause = 'YellowCards' | 'SecondYellow' | 'RedCard' | 'Committee';

export interface SuspensionBriefDto {
  cause: SuspensionCause;
  /** Para leer: «5.ª amarilla en la jornada 7», «Sanción del comité por la jornada 8: agredir a otro (2.º de 4 partidos)»… */
  reason: string;
  fromMatchId: string;
  fromMatchday: number;
  /** De cuántos partidos es la sanción (las de las tarjetas, de uno). */
  matches: number;
  /** Cuál de esos partidos se cumple en este. */
  nth: number;
  /** En una inhabilitación por días del comité (solo al cuerpo técnico), su último día. */
  until?: string | null;
}

export interface CallUpCountsDto {
  called: number;
  confirmed: number;
  pending: number;
  acknowledged: number;
  /** Jugadores con cuenta a los que les ha llegado. */
  sent: number;
  /** Jugadores que la han abierto. */
  seen: number;
}

/** Un campo de fútbol de la liga (dato público): dirección y punto exacto de OpenStreetMap si se ha encontrado. */
export interface GroundDto {
  id: string;
  name: string;
  address: string | null;
  locality: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Hay punto exacto en el mapa; sin él, mapsUrl abre la búsqueda del campo por su nombre. */
  located: boolean;
  mapsUrl: string;
  /** Equipos de la liga que juegan ahí como locales. */
  homeTeams: string[];
}

export interface SquadGroundsDto {
  /** El campo habitual del equipo como local; null si sus partidos no traen campo. */
  homeGroundId: string | null;
  /** Primero el de casa y luego por nombre. */
  grounds: GroundDto[];
}

export interface MatchCallUpDto {
  /** null si el cuerpo técnico aún no ha empezado la convocatoria de este partido. */
  id: string | null;
  squadId: string;
  match: MatchDto;
  status: CallUpStatus;
  meetAt: string | null;
  /** Campo de la liga donde se cita; null si no se ha elegido o se ha escrito otro sitio. */
  meetGround: GroundDto | null;
  /** Sitio escrito a mano cuando no es un campo de la liga (obras, campo alternativo…). */
  meetPlace: string | null;
  notes: string | null;
  publishedAt: string | null;
  /** El partido ya ha empezado: se ve pero ya no se cambia ni se contesta. */
  closed: boolean;
  entries: CallUpEntryDto[];
  counts: CallUpCountsDto;
  canEdit: boolean;
  mine: CallUpEntryDto | null;
  /** El campo del partido (el que trae o el habitual del local): el que se propone para la cita. */
  matchGround: GroundDto | null;
  /** A cuántos se convoca (exacto: nunca más; con menos se avisa). null: aún no se ha dicho. */
  size?: number | null;
  /** La plantilla tiene un número fijo: manda ese y no se pregunta. */
  sizeFixed?: boolean;
  /** Sin número todavía: el de la última convocatoria, para proponerlo al preguntar. */
  suggestedSize?: number | null;
  /** Huella de lo que se ve: si la de `callUpStamp` no coincide, alguien ha firmado o algo ha cambiado. */
  stamp: string;
}

export interface CallUpStampDto {
  stamp: string;
}

export interface CallUpSummaryDto {
  callUpId: string;
  matchId: string;
  status: CallUpStatus;
  publishedAt: string | null;
  counts: CallUpCountsDto;
  mine: CallUpEntryDto | null;
}

export interface CallUpRequest {
  calledSquadPlayerIds: string[];
  meetAt: string | null;
  /** Un campo de la liga (de /grounds); si va, meetPlace se ignora. */
  meetGroundId: string | null;
  meetPlace: string | null;
  notes: string | null;
  /** true publica y avisa a la plantilla; false deja el borrador. */
  publish: boolean;
  /** A cuántos se convoca; con número fijo en la plantilla, manda ese. */
  size?: number | null;
}

/** Un día del calendario de la plantilla: un entrenamiento o un partido. */
export interface SquadAgendaItemDto {
  kind: SquadEventKind;
  startsAt: string;
  /** Ya realizado: el entrenamiento ha terminado o el partido ya se ha jugado. */
  done: boolean;
  /** Solo en Training. */
  training: TrainingSummaryDto | null;
  /** Solo en Match. */
  match: MatchDto | null;
  /** Solo en Match: estado de la convocatoria; null si no hay (o es un borrador que quien mira no ve). */
  callUp: CallUpSummaryDto | null;
  /** Solo en Match y mientras no se ha jugado: quién no puede jugar (sancionados y lesionados), haya convocatoria o no. */
  unavailable?: UnavailablePlayerDto[] | null;
}

export type UnavailabilityKind = 'Suspended' | 'Injured';

export interface UnavailablePlayerDto {
  squadPlayerId: string;
  playerName: string;
  kind: UnavailabilityKind;
  /** Sancionado: el porqué («5.ª amarilla en la jornada 7»…). Lesionado: «Lesionado» y, para quien puede verla, la lesión. */
  reason: string;
}

export interface MyCallUpDto {
  callUpId: string;
  squadId: string;
  teamName: string;
  match: MatchDto;
  meetAt: string | null;
  meetGround: GroundDto | null;
  meetPlace: string | null;
  notes: string | null;
  publishedAt: string;
  closed: boolean;
  mine: CallUpEntryDto;
}

/** Entrenamientos de un jugador en un periodo: los que le tocaban, a cuántos vino y los minutos entrenados. */
export interface PlayerTrainingTallyDto {
  squadPlayerId: string;
  playerName: string;
  shirtNumber: number | null;
  /** Sigue en la plantilla. */
  active: boolean;
  sessions: number;
  attended: number;
  missed: number;
  /** De los que faltó, en cuántos avisó antes. */
  warned: number;
  attendedMinutes: number;
  /** 0-100; null si no le tocaba ninguno. */
  attendanceRate: number | null;
  /** Entrenamientos que se perdió por estar lesionado: no cuentan en sessions ni como faltas. */
  injured: number;
  /** Lesiones que tocan el periodo (la más reciente primero). */
  injuries: InjuryBriefDto[] | null;
  /** Lo que fue de cada entrenamiento de `days`, en el mismo orden; null si no le tocaba. */
  outcomes: (TrainingDayOutcome | null)[] | null;
  /** Motivos de sus faltas: id de la sesión → motivo. */
  reasons: Record<string, string> | null;
}

/** Vino, faltó, faltó avisando o estaba lesionado (no cuenta como falta). */
export type TrainingDayOutcome = 'Attended' | 'Missed' | 'Warned' | 'Injured';

export interface TrainingAttendanceDayDto {
  sessionId: string;
  startsAt: string;
  durationMinutes: number;
  kind: TrainingKind;
  kindLabel: string;
  title: string;
}

export interface SquadTrainingAttendanceDto {
  squadId: string;
  from: string | null;
  to: string | null;
  /** Entrenamientos acabados de la plantilla en el periodo y los minutos que suman. */
  sessions: number;
  minutes: number;
  players: PlayerTrainingTallyDto[];
  /** Los entrenamientos acabados del periodo, del más antiguo al más reciente. */
  days: TrainingAttendanceDayDto[] | null;
}

export interface TrainingSeasonOptionDto {
  squadId: string;
  seasonId: string;
  label: string;
  teamName: string;
  startsOn: string;
  endsOn: string;
}

export interface MyTrainingAttendanceDto {
  seasons: TrainingSeasonOptionDto[];
  /** Temporada (plantilla) contada; null = todas. */
  squadId: string | null;
  from: string | null;
  to: string | null;
  sessions: number;
  attended: number;
  missed: number;
  warned: number;
  attendedMinutes: number;
  attendanceRate: number | null;
  /** Entrenamientos que se perdió por estar lesionado. */
  injured: number;
  injuries: InjuryBriefDto[] | null;
}
