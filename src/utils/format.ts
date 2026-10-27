import type {
  AccountType,
  AppointmentStatus,
  BillingInterval,
  CompetitionDto,
  CompetitionLevel,
  LicenseItem,
  LicenseStatus,
  MatchDto,
  MatchStatus,
  OfficialEventType,
  Position,
  SheetDifferenceDto,
  SquadVisibility,
  StaffRole,
  SuggestionStatus,
  VideoAccessLevel,
  VideoPart,
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

export const staffRoleOptions = (Object.keys(staffRoleLabels) as StaffRole[]).map((value) => ({
  value,
  label: staffRoleLabels[value],
}));

export const visibilityLabels: Record<SquadVisibility, string> = {
  Private: 'Privada',
  Public: 'Pública',
};

export const matchStatusLabels: Record<MatchStatus, string> = {
  Scheduled: 'Programado',
  InProgress: 'En juego',
  Played: 'Finalizado',
  Postponed: 'Aplazado',
  Cancelled: 'Cancelado',
};

export const levelLabels: Record<CompetitionLevel, string> = {
  Professional: 'Profesional',
  National: 'Nacional',
  Regional: 'Regional · Asturias',
  Cup: 'Copas',
  Youth: 'Fútbol base',
  Other: 'Otras',
};

/** Orden de presentación de los niveles: primero donde juega el fútbol amateur asturiano. */
export const levelOrder: CompetitionLevel[] = ['National', 'Regional', 'Professional', 'Cup', 'Youth', 'Other'];

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

export const outcomeTone = (outcome: Outcome): Tone =>
  outcome === 'win' ? 'green' : outcome === 'draw' ? 'amber' : outcome === 'loss' ? 'red' : 'slate';

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
  Locked: 'De pago',
  Owner: 'Tu plantilla',
  Purchased: 'Comprado',
  Free: 'Gratis',
};

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

export const formatBytes = (bytes: number) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(0)} MB` : `${Math.ceil(bytes / 1024)} KB`;
