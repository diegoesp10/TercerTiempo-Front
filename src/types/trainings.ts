import type { MatchDto } from './api';

// --- Entrenamientos, ejercicios, asistencia y convocatorias (preparación semanal del cuerpo técnico) ---

export type TrainingKind = 'Season' | 'Preseason' | 'Recovery' | 'MatchPreparation' | 'Other';
export type ExerciseType = 'Warmup' | 'Technical' | 'Tactical' | 'Physical' | 'Goalkeeping' | 'SetPieces' | 'Game' | 'Cooldown' | 'Other';
/** Cuenta con venir, ha avisado de que falta, vino o faltó sin avisar. */
export type AttendanceStatus = 'Expected' | 'WillMiss' | 'Attended' | 'Missed';
export type CallUpStatus = 'Draft' | 'Published';
/** El convocado confirma o dice que no puede; el que no va se da por enterado. */
export type CallUpResponse = 'Pending' | 'Confirmed' | 'Declined' | 'Acknowledged';
export type Weekday = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export interface TrainingKindDto {
  kind: TrainingKind;
  label: string;
  description: string;
}

export interface ExerciseTypeDto {
  type: ExerciseType;
  label: string;
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
}

export interface TrainingItemInput {
  exerciseId: string | null;
  name: string;
  type: ExerciseType;
  durationMinutes: number;
  notes: string | null;
}

export interface TrainingAttendanceDto {
  squadPlayerId: string;
  playerName: string;
  shirtNumber: number | null;
  /** Tiene cuenta vinculada: puede avisar de que falta desde la app. */
  linked: boolean;
  status: AttendanceStatus;
  reason: string | null;
  updatedAt: string;
}

export interface AttendanceCountsDto {
  expected: number;
  willMiss: number;
  attended: number;
  missed: number;
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

export interface AttendanceInput {
  squadPlayerId: string;
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
  responseNote: string | null;
  respondedAt: string | null;
}

export interface CallUpCountsDto {
  called: number;
  confirmed: number;
  declined: number;
  pending: number;
  acknowledged: number;
}

export interface MatchCallUpDto {
  /** null si el cuerpo técnico aún no ha empezado la convocatoria de este partido. */
  id: string | null;
  squadId: string;
  match: MatchDto;
  status: CallUpStatus;
  meetAt: string | null;
  meetPlace: string | null;
  notes: string | null;
  publishedAt: string | null;
  /** El partido ya ha empezado: se ve pero ya no se cambia ni se contesta. */
  closed: boolean;
  entries: CallUpEntryDto[];
  counts: CallUpCountsDto;
  canEdit: boolean;
  mine: CallUpEntryDto | null;
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
  meetPlace: string | null;
  notes: string | null;
  /** true publica y avisa a la plantilla; false deja el borrador. */
  publish: boolean;
}

export interface MyCallUpDto {
  callUpId: string;
  squadId: string;
  teamName: string;
  match: MatchDto;
  meetAt: string | null;
  meetPlace: string | null;
  notes: string | null;
  publishedAt: string;
  closed: boolean;
  mine: CallUpEntryDto;
}
