import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { RouteLocationRaw } from 'vue-router';
import { api } from '@/api';
import type { AccountDto, AuthResponse, ChangePasswordRequest, CoachDto, LoginRequest, PlayerDto, RegisterRequest, SquadSummaryDto } from '@/types/api';
import { useAdminSessionStore } from './adminSession';
import { markActiveSession } from './sessionSync';

export const TOKEN_KEY = 'tt.token';
export const ACCOUNT_KEY = 'tt.account';
export const TOKEN_UNTIL_KEY = 'tt.token-until';
// Un token se deja de usar medio minuto antes de que caduque: ninguna petición sale con uno que la API ya no acepta.
const EXPIRY_MARGIN_MS = 30_000;
const CHECK_WAIT_MS = 3_000;

function readAccount(): AccountDto | null {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as AccountDto | null;
  } catch {
    return null;
  }
}

/** Cuándo se emitió y cuándo caduca un token (segundos), según su contenido: es el nuestro, no hace falta la firma. */
function tokenTimes(token: string): { iat?: number; exp?: number } {
  try {
    const base64 = (token.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as { iat?: number; exp?: number };
  } catch {
    return {};
  }
}

/**
 * Hasta cuándo vale un token recién recibido, con el reloj de este dispositivo: su duración (exp − iat) a partir de
 * ahora, así da igual que el reloj vaya adelantado o atrasado respecto al del servidor. Si no se sabe, no caduca aquí:
 * ya lo dirá la API.
 */
function untilOf(token: string, expiresAt: string): number {
  const { iat, exp } = tokenTimes(token);
  if (iat && exp) return Date.now() + (exp - iat) * 1000;
  const until = exp ? exp * 1000 : Date.parse(expiresAt);
  return Number.isFinite(until) ? until : Number.POSITIVE_INFINITY;
}

/** La caducidad apuntada al entrar; la de un token guardado antes de apuntarla, la suya con el reloj de este dispositivo. */
function readUntil(token: string): number {
  const stored = Number(localStorage.getItem(TOKEN_UNTIL_KEY));
  if (stored > 0) return stored;
  const { exp } = tokenTimes(token);
  return exp ? exp * 1000 : Number.POSITIVE_INFINITY;
}

/**
 * Sesión: token JWT y cuenta (jugador con su plantilla, técnico con sus plantillas o club), persistidos en localStorage.
 * Entrar con una cuenta cierra la sesión de administrador (ver sessionSync).
 *
 * Nada que necesite la sesión se pide sin una que valga: la guardada se comprueba al abrir la web (sessionChecked, que
 * espera la primera navegación), un token caducado no llega a salir (http.ts lo mira antes de cada petición) y, si la API
 * deja de aceptar la sesión (otra contraseña, cuenta borrada), se olvida (expire) y no se le vuelve a pedir nada con ella.
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const account = ref<AccountDto | null>(null);
  let until = Number.POSITIVE_INFINITY;
  /** La sesión caducó o dejó de valer sin pulsar «Salir»: «Entrar» lo explica. */
  const expired = ref(false);

  const isAuthenticated = computed(() => token.value !== null);
  const isCoach = computed(() => account.value?.type === 'Coach');
  const isPlayer = computed(() => account.value?.type === 'Player');
  const isClub = computed(() => account.value?.type === 'Club');

  const player = computed(() => account.value?.player ?? null);
  const coach = computed(() => account.value?.coach ?? null);
  const club = computed(() => account.value?.club ?? null);
  const displayName = computed(() => player.value?.displayName ?? coach.value?.displayName ?? club.value?.name ?? '');
  /** Insignia del club: el escudo de su primer equipo con escudo (los filiales comparten el del club). */
  const clubCrestUrl = computed(() => club.value?.teams.find((t) => t.teamCrestUrl)?.teamCrestUrl ?? null);

  /** Plantilla a la que está vinculado el jugador (null si todavía no se ha vinculado). */
  const playerSquad = computed(() => player.value?.squad ?? null);
  /** Plantillas en cuyo cuerpo técnico está el técnico. */
  const coachSquads = computed<SquadSummaryDto[]>(() => coach.value?.squads ?? []);

  /**
   * «Mi perfil»: el del técnico (su página pública) o el del jugador (su cuenta: foto, quién ve su perfil, ajustes y su
   * plantilla; también sin plantilla); null para el club, que tiene los ajustes.
   */
  const profileRoute = computed<RouteLocationRaw | null>(() => {
    if (coach.value) return { name: 'coach', params: { coachId: coach.value.id } };
    return player.value ? { name: 'my-profile' } : null;
  });

  /** Equipos propios: los de las plantillas del técnico, el del jugador y los del club. */
  const myTeamIds = computed(() => {
    const ids = coachSquads.value.map((s) => s.teamId);
    if (playerSquad.value) ids.push(playerSquad.value.teamId);
    for (const team of club.value?.teams ?? []) ids.push(team.teamId);
    return [...new Set(ids)];
  });

  /** Competiciones de esos equipos, la principal primero: es la que se abre por defecto en buscadores y clasificaciones. */
  const myCompetitionIds = computed(() => {
    const ids: string[] = [];
    if (playerSquad.value) ids.push(playerSquad.value.competitionId);
    ids.push(...coachSquads.value.map((s) => s.competitionId));
    ids.push(...(club.value?.teams ?? []).map((t) => t.competitionId).filter((id): id is string => !!id));
    return [...new Set(ids)];
  });

  const mySquadIds = computed(() => {
    const ids = coachSquads.value.map((s) => s.id);
    if (playerSquad.value) ids.push(playerSquad.value.squadId);
    return ids;
  });

  const isMyTeam = (teamId: string) => myTeamIds.value.includes(teamId);
  const isMySquad = (squadId: string) => mySquadIds.value.includes(squadId);
  /** ¿Forma parte del cuerpo técnico de esta plantilla? */
  const isStaffOf = (squadId: string) => coachSquads.value.some((s) => s.id === squadId);

  function setSession(session: AuthResponse) {
    useAdminSessionStore().end();
    markActiveSession('user');
    until = untilOf(session.accessToken, session.expiresAt);
    // La caducidad antes que el token: otra pestaña que oiga el cambio la encuentra ya al leerlo.
    localStorage.setItem(TOKEN_UNTIL_KEY, String(until));
    token.value = session.accessToken;
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    expired.value = false;
    setAccount(session.account);
  }

  /** ¿El token ya no se puede usar? (o está a punto de caducar). */
  function isExpired() {
    return token.value !== null && Date.now() >= until - EXPIRY_MARGIN_MS;
  }

  function restore() {
    token.value = localStorage.getItem(TOKEN_KEY);
    until = token.value ? readUntil(token.value) : Number.POSITIVE_INFINITY;
    account.value = token.value ? readAccount() : null;
  }

  function clear() {
    token.value = null;
    account.value = null;
    until = Number.POSITIVE_INFINITY;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_UNTIL_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  }

  function setAccount(value: AccountDto) {
    account.value = value;
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(value));
  }

  function setPlayer(value: PlayerDto) {
    if (!account.value) return;
    setAccount({ ...account.value, player: value });
  }

  function setCoachSquads(squads: SquadSummaryDto[]) {
    if (!account.value?.coach) return;
    setAccount({ ...account.value, coach: { ...account.value.coach, squads } });
  }

  function setCoach(value: CoachDto) {
    if (!account.value) return;
    setAccount({ ...account.value, coach: value });
  }

  /** «Salir»: con un token que aún vale, la sesión sale al momento de la lista de gente en sesión de la administración. */
  function logout() {
    if (token.value && !isExpired()) void api.presence.end(token.value).catch(() => undefined);
    clear();
    expired.value = false;
  }

  /**
   * La sesión ha caducado o la API ya no la acepta (la contraseña se cambió en otro sitio, la cuenta ya no existe): se
   * olvida sin pedirle nada más a la API. Con `found`, solo si es esa: una respuesta tardía no cierra la que se abrió después.
   */
  function expire(found?: string | null) {
    if (!token.value || (found !== undefined && found !== token.value)) return;
    clear();
    expired.value = true;
  }

  /** Otra pestaña ha entrado o salido: se toma lo que haya guardado. */
  function reloadFromStorage() {
    restore();
    if (token.value) expired.value = false;
  }

  async function login(request: LoginRequest) {
    setSession(await api.auth.login(request));
  }

  /** Cambia la contraseña: la API cierra las demás sesiones y devuelve un token nuevo para esta. */
  async function changePassword(request: ChangePasswordRequest) {
    setSession(await api.auth.changePassword(request));
  }

  async function register(request: RegisterRequest) {
    setSession(await api.auth.register(request));
  }

  /** Vuelve a pedir la cuenta a la API (plantillas nuevas, vínculos, visibilidad...); sin cuenta (204), la sesión ya no vale. */
  async function refreshAccount() {
    const current = token.value;
    if (!current) return;
    const value = await api.auth.me();
    if (token.value !== current) return;
    if (value) setAccount(value);
    else expire(current);
  }

  let check: Promise<void> | null = null;

  /**
   * Al abrir la web con una sesión guardada, la API dice si aún vale antes de que se pida nada con ella: la primera
   * navegación lo espera (router). Sin conexión se sigue con la guardada, y ya lo dirá la siguiente petición; con la API
   * colgada, como mucho unos segundos, y la comprobación sigue por detrás.
   */
  function sessionChecked(): Promise<void> {
    check ??= Promise.race([
      refreshAccount().catch(() => undefined),
      new Promise<void>((resolve) => setTimeout(resolve, CHECK_WAIT_MS)),
    ]);
    return check;
  }

  restore();
  // Una sesión guardada que ya ha caducado se olvida sin pedir nada con ella.
  if (isExpired()) expire();

  return {
    token,
    account,
    expired,
    isAuthenticated,
    isCoach,
    isPlayer,
    isClub,
    player,
    coach,
    club,
    clubCrestUrl,
    displayName,
    playerSquad,
    coachSquads,
    profileRoute,
    myTeamIds,
    myCompetitionIds,
    isMyTeam,
    isMySquad,
    isStaffOf,
    login,
    register,
    changePassword,
    logout,
    expire,
    isExpired,
    sessionChecked,
    reloadFromStorage,
    setAccount,
    setPlayer,
    setCoachSquads,
    setCoach,
    refreshAccount,
  };
});
