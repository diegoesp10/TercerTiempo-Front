import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { AccountDto, AuthResponse, LoginRequest, PlayerDto, RegisterRequest, SquadSummaryDto } from '@/types/api';

const TOKEN_KEY = 'tt.token';
const ACCOUNT_KEY = 'tt.account';

function readAccount(): AccountDto | null {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? 'null') as AccountDto | null;
  } catch {
    return null;
  }
}

/** Sesión: token JWT y cuenta (jugador con su plantilla, o técnico con sus plantillas), persistidos en localStorage. */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const account = ref<AccountDto | null>(readAccount());

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
    token.value = session.accessToken;
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    setAccount(session.account);
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

  function logout() {
    token.value = null;
    account.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ACCOUNT_KEY);
  }

  async function login(request: LoginRequest) {
    setSession(await api.auth.login(request));
  }

  async function register(request: RegisterRequest) {
    setSession(await api.auth.register(request));
  }

  /** Vuelve a pedir la cuenta a la API (plantillas nuevas, vínculos, visibilidad...). */
  async function refreshAccount() {
    if (!token.value) return;
    setAccount(await api.auth.me());
  }

  return {
    token,
    account,
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
    myTeamIds,
    myCompetitionIds,
    isMyTeam,
    isMySquad,
    isStaffOf,
    login,
    register,
    logout,
    setAccount,
    setPlayer,
    setCoachSquads,
    refreshAccount,
  };
});
