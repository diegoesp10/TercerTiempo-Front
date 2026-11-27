import type {
  AccountType,
  AppointmentStatus,
  BillingInterval,
  CompetitionDto,
  CompetitionLevel,
  LicenseItem,
  LicenseStatus,
  MatchDto,
  MatchPassRequestStatus,
  MatchPassStatus,
  MatchStatus,
  OfficialDuty,
  OfficialRole,
  OfficialStaffRole,
  RefereeRaterDto,
  OfficialEventType,
  Position,
  SheetDifferenceDto,
  SquadVisibility,
  StaffRole,
  InjuryDocumentKind,
  SuggestionStatus,
  VideoAccessLevel,
  VideoPart,
  VideoStatus,
  AttendanceStatus,
  CallUpResponse,
  ExerciseType,
  TrainingKind,
  Weekday,
} from '@/types/api';

export const accountTypeLabels: Record<AccountType, string> = {
  Player: 'Jugador',
  Coach: 'Cuerpo técnico',
  Club: 'Club',
};

export const positionLabels: Record<Position, string> = {
  Goalkeeper: 'Portero',
  Defender: 'Defensa',
  Midfielder: 'Centrocampista',
  Forward: 'Delantero',
};

export const positionShortLabels: Record<Position, string> = {
  Goalkeeper: 'POR',
  Defender: 'DEF',
  Midfielder: 'MED',
  Forward: 'DEL',
};

export const positionOptions = (Object.keys(positionLabels) as Position[]).map((value) => ({
  value,
  label: positionLabels[value],
}));

export const staffRoleLabels: Record<StaffRole, string> = {
  HeadCoach: 'Primer entrenador',
  AssistantCoach: 'Segundo entrenador',
  Delegate: 'Delegado',
  Physio: 'Fisio',
  Analyst: 'Analista',
  Other: 'Otro',
};

const officialStaffRoleLabels: Record<OfficialStaffRole, string> = {
  HeadCoach: 'Entrenador',
  AssistantCoach: 'Segundo entrenador',
  GoalkeeperCoach: 'Entrenador de porteros',
  FitnessCoach: 'Preparador físico',
  TeamDelegate: 'Delegado',
  FieldDelegate: 'Delegado de campo',
  Physio: 'Fisioterapeuta',
  Medical: 'Servicio médico',
  KitManager: 'Encargado de material',
  Other: 'Cuerpo técnico',
};

const asSentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

/** Función del cuerpo técnico en las actas sin las abreviaturas de la federación («2ºEntrenador», «DEL. Campo»). */
export function officialStaffLabel(role: OfficialStaffRole, label: string | null): string {
  const text = (label ?? '').trim();
  if (role === 'AssistantCoach' && /pr[aá]ctica/i.test(text)) return 'Entrenador en prácticas';
  if (role === 'AssistantCoach' && text && !/^2/.test(text)) return asSentence(text);
  if (role === 'Other' && text) return asSentence(text);
  return officialStaffRoleLabels[role];
}

export const injuryDocumentKindLabels: Record<InjuryDocumentKind, string> = {
  Imaging: 'Radiografía o prueba de imagen',
  MedicalReport: 'Informe médico',
  Other: 'Otro documento',
};

export const staffRoleOptions = (Object.keys(staffRoleLabels) as StaffRole[]).map((value) => ({
  value,
  label: staffRoleLabels[value],
}));

export const visibilityLabels: Record<SquadVisibility, string> = {
  Private: 'Privada',
  Public: 'Abierta a solicitudes',
};

export const officialRoleLabels: Record<OfficialRole, string> = {
  Referee: 'Árbitro',
  AssistantReferee1: 'Asistente 1',
  AssistantReferee2: 'Asistente 2',
  FourthOfficial: 'Cuarto árbitro',
};

export const officialDutyLabels: Record<OfficialDuty, string> = {
  Main: 'Árbitro principal',
  Assistant: 'Asistente',
};

/** Quién puso una nota: «CD Vallobín (club)» o «Pepe Rivero, segundo entrenador». */
export const raterLabel = (rater: RefereeRaterDto) =>
  rater.club ? `${rater.name} (club)` : `${rater.name}, ${rater.staffRole ? staffRoleLabels[rater.staffRole].toLowerCase() : 'cuerpo técnico'}`;

/** Nota media con un decimal («7,5») o una raya si no hay notas. */
export const formatScore = (score: number | null) => (score === null ? '—' : score.toFixed(1).replace('.', ','));

export const matchStatusLabels: Record<MatchStatus, string> = {
  Scheduled: 'Programado',
  InProgress: 'En juego',
  Played: 'Finalizado',
  Postponed: 'Aplazado',
  Cancelled: 'Cancelado',
};

/**
 * Estado que se enseña de un partido. Uno «Programado» cuya hora ya pasó (o «En juego» desde hace más de tres horas) ya
 * se ha jugado: no está pendiente, solo falta que llegue su resultado de futbolasturiano.es.
 */
export type MatchDisplayStatus = MatchStatus | 'AwaitingResult';

const MATCH_LENGTH_MS = 3 * 60 * 60 * 1000;

export function matchDisplayStatus(match: Pick<MatchDto, 'status' | 'kickoffAt'>, now = Date.now()): MatchDisplayStatus {
  const kickoff = new Date(match.kickoffAt).getTime();
  if (match.status === 'Scheduled' && kickoff <= now) return 'AwaitingResult';
  if (match.status === 'InProgress' && kickoff + MATCH_LENGTH_MS <= now) return 'AwaitingResult';
  return match.status;
}

export const matchDisplayLabels: Record<MatchDisplayStatus, string> = { ...matchStatusLabels, AwaitingResult: 'Sin resultado' };

export const awaitingResultHint = 'Ya se ha jugado: el resultado aparecerá en cuanto llegue de futbolasturiano.es.';

/**
 * El partido que toca: el que se está jugando o, si no, el siguiente por fecha (no por jornada: un aplazado de una
 * jornada anterior puede jugarse más tarde). Los aplazados sin fecha nueva no cuentan.
 */
export function nextMatchOf<T>(items: T[], matchOf: (item: T) => Pick<MatchDto, 'status' | 'kickoffAt'>): T | null {
  return items
    .filter((item) => ['Scheduled', 'InProgress'].includes(matchDisplayStatus(matchOf(item))))
    .sort((a, b) => new Date(matchOf(a).kickoffAt).getTime() - new Date(matchOf(b).kickoffAt).getTime())[0] ?? null;
}

export const levelLabels: Record<CompetitionLevel, string> = {
  Professional: 'Profesional',
  National: 'Nacional',
  Regional: 'Regional',
  Cup: 'Copas',
  Youth: 'Fútbol base',
  Other: 'Otras',
};

/** El nivel de una liga para leer; las regionales, con su comunidad cuando se sabe: «Regional · Asturias». */
export function levelLabel(level: CompetitionLevel, territory?: string | null): string {
  return level === 'Regional' && territory ? `Regional · ${territory}` : levelLabels[level];
}

/**
 * Orden de presentación de los niveles: primero donde juega el fútbol amateur asturiano. Por ahora la app es solo para
 * equipos de categoría absoluta, así que las ligas de fútbol base no se enseñan aunque llegaran a cargarse.
 */
export const levelOrder: CompetitionLevel[] = ['National', 'Regional', 'Professional', 'Cup', 'Other'];

/** Agrupa las competiciones por nivel respetando levelOrder y el sortOrder de cada liga. */
export function groupByLevel(competitions: CompetitionDto[]): { level: CompetitionLevel; competitions: CompetitionDto[] }[] {
  return levelOrder
    .map((level) => ({
      level,
      competitions: competitions.filter((c) => c.level === level).sort((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((group) => group.competitions.length > 0);
}

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

const timeOnly = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });
const dayHeading = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const dayMonth = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

export const formatKickoff = (iso: string) => dateTime.format(new Date(iso));
export const formatTime = (iso: string) => timeOnly.format(new Date(iso));
/** "sábado, 17 de octubre" (con mayúscula inicial). */
export const formatDayHeading = (iso: string) => {
  const text = dayHeading.format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
};
/** «Hoy», «Mañana» o «Dentro de 5 días», contando días del calendario (no horas). */
export const formatDaysUntil = (iso: string, now = new Date()) => {
  const day = new Date(iso);
  const days = Math.round(
    (new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000,
  );
  return days <= 0 ? 'Hoy' : days === 1 ? 'Mañana' : `Dentro de ${days} días`;
};
/** Fecha local "yyyy-mm-dd" para agrupar partidos por día. */
export const localDayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Rango de fechas de una jornada: "17 oct" o "17 oct – 18 oct". */
export const formatDayRange = (startIso: string, endIso: string) => {
  const start = dayMonth.format(new Date(startIso));
  const end = dayMonth.format(new Date(endIso));
  return start === end ? start : `${start} – ${end}`;
};
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

/** «Lesionado · 12 días · hasta 30 nov 2026»: los días de baja reales contados desde el parte y la vuelta prevista. */
export function injuredLabel(injury: { daysOut?: number; expectedReturnOn: string | null }) {
  const parts = ['Lesionado'];
  if (injury.daysOut !== undefined) parts.push(injury.daysOut === 0 ? 'desde hoy' : injury.daysOut === 1 ? '1 día' : `${injury.daysOut} días`);
  if (injury.expectedReturnOn) parts.push(`hasta ${formatDate(injury.expectedReturnOn)}`);
  return parts.join(' · ');
}

/** El detalle de una lesión abierta para un title: tipo con dónde fue y motivo, día del parte y vuelta prevista. */
export function injuryTitle(injury: { typeLabel: string; location?: string | null; reason: string | null; startedOn: string; expectedReturnOn: string | null }) {
  const what = injury.location ? `${injury.typeLabel} (${injury.location.charAt(0).toLocaleLowerCase('es-ES')}${injury.location.slice(1)})` : injury.typeLabel;
  return [
    injury.reason ? `${what}: ${injury.reason}` : what,
    `parte del ${formatDate(injury.startedOn)}`,
    injury.expectedReturnOn ? `vuelta prevista el ${formatDate(injury.expectedReturnOn)}` : 'sin fecha de vuelta',
  ].join(' · ');
}

export const formatNumber = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: digits });

export const formatPct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${formatNumber(value, 0)}%`;

export type Outcome = 'win' | 'draw' | 'loss' | null;

/** Resultado del partido desde el punto de vista de un equipo. */
export function outcomeFor(match: MatchDto, teamId: string): Outcome {
  if (match.status !== 'Played' || match.homeGoals === null || match.awayGoals === null) return null;
  const isHome = match.homeTeam.id === teamId;
  const goalsFor = isHome ? match.homeGoals : match.awayGoals;
  const goalsAgainst = isHome ? match.awayGoals : match.homeGoals;
  return goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss';
}

export const outcomeLabels: Record<Exclude<Outcome, null>, string> = { win: 'V', draw: 'E', loss: 'D' };

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'slate';

/** Tono de la etiqueta V/E/D: los colores del resultado (win, draw y loss), gris si aún no se ha jugado. */
export type OutcomeTone = Exclude<Outcome, null> | 'slate';

export const outcomeTone = (outcome: Outcome): OutcomeTone => outcome ?? 'slate';

/** Rival de un partido para un equipo; siempre "vs Rival" (la localía se indica aparte). */
export function opponentLabel(match: MatchDto, teamId: string): string {
  return `vs ${match.homeTeam.id === teamId ? match.awayTeam.name : match.homeTeam.name}`;
}

export const scoreLabel = (match: MatchDto) =>
  match.homeGoals === null || match.awayGoals === null ? null : `${match.homeGoals} - ${match.awayGoals}`;

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  Pending: 'Pendiente de canjear',
  Active: 'Vigente',
  Expired: 'Caducado',
  Revoked: 'Revocado',
};

export const licenseStatusLabels: Record<LicenseStatus, string> = {
  Trial: 'En prueba',
  Active: 'Vigente',
  Expired: 'Caducada',
};

export const licenseStatusTone: Record<LicenseStatus, Tone> = { Trial: 'blue', Active: 'green', Expired: 'red' };

export const licenseItemLabels: Record<LicenseItem, string> = { Club: 'Licencia de club', StaffSeat: 'Licencia de técnico' };

export const billingIntervalLabels: Record<BillingInterval, string> = { Monthly: 'Mensual', Yearly: 'Anual' };

/** «/mes» o «/año» detrás de un precio. */
export const billingIntervalSuffix: Record<BillingInterval, string> = { Monthly: '/mes', Yearly: '/año' };

export const staffCountLabel = (count: number) => (count === 1 ? '1 técnico' : `${count} técnicos`);

export const suggestionStatusLabels: Record<SuggestionStatus, string> = {
  Pending: 'Pendiente',
  Approved: 'Aprobada',
  Declined: 'Rechazada',
};

export const suggestionStatusTone: Record<SuggestionStatus, Tone> = { Pending: 'amber', Approved: 'green', Declined: 'red' };

export const appointmentStatusTone = (status: AppointmentStatus): Tone =>
  status === 'Active' ? 'green' : status === 'Pending' ? 'amber' : status === 'Revoked' ? 'red' : 'slate';

export const officialEventLabels: Record<OfficialEventType, string> = {
  Goal: 'Gol',
  PenaltyGoal: 'Gol de penalti',
  OwnGoal: 'Gol en propia puerta',
  YellowCard: 'Amarilla',
  SecondYellow: 'Segunda amarilla',
  RedCard: 'Roja',
  Substitution: 'Cambio',
};

/** Web de la que sale el acta pública (hoy solo la federación). */
export const sheetSourceLabel = (provider: string | null | undefined) =>
  provider === 'asturfutbol' ? 'asturfutbol.es (federación)' : provider ?? 'web de actas';

const nameParticles = new Set(['de', 'del', 'la', 'las', 'los', 'y']);
const lowerEs = (text: string) => text.toLocaleLowerCase('es-ES');

/**
 * Una persona tal y como la escribe el acta de la federación («QUINTANA TORRES, DIEGO») en la forma de la app («Diego
 * Quintana Torres»): primero el nombre, mayúscula inicial si venía todo en mayúsculas y las partículas de los apellidos en
 * minúscula («David del Valle Prieto»). Es lo mismo que hace la API con los árbitros (`Referee.DisplayName`).
 */
export function sheetPersonName(name: string): string {
  let clean = name.trim().split(/\s+/).join(' ');
  const comma = clean.indexOf(',');
  if (comma > 0) clean = `${clean.slice(comma + 1).trim()} ${clean.slice(0, comma).trim()}`.trim();
  if (clean.toLocaleUpperCase('es-ES') === clean) {
    clean = lowerEs(clean).replace(/(^|[\s'.-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toLocaleUpperCase('es-ES'));
  }
  const words = clean.split(' ');
  return words.map((word, i) => (i > 0 && i < words.length - 1 && nameParticles.has(lowerEs(word)) ? lowerEs(word) : word)).join(' ');
}

export const sheetFieldLabels: Record<SheetDifferenceDto['field'], string> = {
  played: 'Jugó',
  started: 'Titular',
  minutes: 'Minutos',
  goals: 'Goles',
  yellowCards: 'Amarillas',
  redCard: 'Roja',
};

export const videoAccessLabels: Record<VideoAccessLevel, string> = {
  None: 'Sin acceso',
  Locked: 'Privado',
  Owner: 'Tu plantilla',
  Pass: 'Con tu pase',
  Admin: 'Administración',
};

export const passStatusLabels: Record<MatchPassStatus, string> = {
  Pending: 'Sin canjear',
  Redeemed: 'Canjeado',
  Revoked: 'Revocado',
  Expired: 'Caducado',
};

export const passRequestStatusLabels: Record<MatchPassRequestStatus, string> = {
  Pending: 'Pendiente',
  Approved: 'Aprobada',
  Rejected: 'Rechazada',
  Cancelled: 'Retirada',
};

/** Qué abre un pase: «Acta interna», «Vídeo» o «Acta interna y vídeo» (+ descarga). */
export const passContents = (sheet: boolean, video: boolean, download = false) =>
  [sheet && video ? 'Acta interna y vídeo' : sheet ? 'Acta interna' : video ? 'Vídeo' : '', download ? 'con descarga' : '']
    .filter(Boolean)
    .join(' ');

/** Precio de un pase: «Gratis» o el importe. */
export const passPrice = (cents: number, currency = 'EUR') => (cents === 0 ? 'Gratis' : formatPrice(cents, currency));

/** "5,00 €" a partir de céntimos. */
export const formatMoney = (cents: number, currency = 'EUR') =>
  (cents / 100).toLocaleString('es-ES', { style: 'currency', currency });

/** Precio para mostrar: sin decimales cuando son cero ("99 €", "9,90 €"). */
export const formatPrice = (cents: number, currency = 'EUR') =>
  (cents / 100).toLocaleString('es-ES', { style: 'currency', currency, minimumFractionDigits: cents % 100 === 0 ? 0 : 2 });

export const videoPartLabels: Record<VideoPart, string> = {
  Full: 'Partido completo',
  FirstHalf: '1ª parte',
  SecondHalf: '2ª parte',
};

export const videoStatusLabels: Record<VideoStatus, string> = {
  Uploaded: 'En cola para comprimir',
  Processing: 'Comprimiendo',
  Ready: 'Listo',
  Failed: 'Sin comprimir',
};

export const formatMinutes = (seconds: number) => `${Math.round(seconds / 60)} min`;

/** Momento del vídeo como lo escribe el analizador: «03:26» y, pasada la hora, «1:01:35». */
export function formatVideoClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0');
  const rest = String(total % 60).padStart(2, '0');
  return hours ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`;
}

export const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(0)} MB` : `${Math.ceil(bytes / 1024)} KB`;

// --- Entrenamientos y convocatorias ---
export const trainingKindLabels: Record<TrainingKind, string> = {
  Season: 'Entrenamiento de la semana',
  Preseason: 'Pretemporada',
  Recovery: 'Recuperación',
  MatchPreparation: 'Preparación del partido',
  Other: 'Otro',
};

export const exerciseTypeLabels: Record<ExerciseType, string> = {
  Warmup: 'Calentamiento',
  Technical: 'Técnico',
  Tactical: 'Táctico',
  Physical: 'Físico',
  Goalkeeping: 'Porteros',
  SetPieces: 'Balón parado',
  Game: 'Partidillo',
  Cooldown: 'Vuelta a la calma',
  Other: 'Otro',
};

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  Expected: 'Cuenta con venir',
  WillMiss: 'Va a faltar',
  Attended: 'Vino',
  Missed: 'Faltó',
};

/** La asistencia del propio jugador, dicha a él («Asistencia realizada» con su check), nunca «Vino». */
export const myAttendanceLabels: Record<AttendanceStatus, string> = {
  Expected: 'Asistencia pendiente',
  WillMiss: 'Falta avisada',
  Attended: 'Asistencia realizada',
  Missed: 'No asististe',
};

export const myAttendanceIcons: Record<AttendanceStatus, string> = {
  Expected: 'clock',
  WillMiss: 'triangle-exclamation',
  Attended: 'circle-check',
  Missed: 'circle-xmark',
};

export const attendanceStatusTone: Record<AttendanceStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  Expected: 'blue',
  WillMiss: 'amber',
  Attended: 'green',
  Missed: 'red',
};

export const callUpResponseLabels: Record<CallUpResponse, string> = {
  Pending: 'Sin firmar',
  Confirmed: 'Firmada',
  Acknowledged: 'Enterado',
};

export const callUpResponseTone: Record<CallUpResponse, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  Pending: 'amber',
  Confirmed: 'green',
  Acknowledged: 'slate',
};

export const weekdayLabels: Record<Weekday, string> = {
  Monday: 'Lunes',
  Tuesday: 'Martes',
  Wednesday: 'Miércoles',
  Thursday: 'Jueves',
  Friday: 'Viernes',
  Saturday: 'Sábado',
  Sunday: 'Domingo',
};

export const weekdays: Weekday[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Día local en formato YYYY-MM-DD (el calendario y las fechas de la API van por días). */
export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const formatDurationMinutes = (minutes: number) =>
  minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
