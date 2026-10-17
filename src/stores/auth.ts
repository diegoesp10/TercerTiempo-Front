import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { AuthResponse, LoginRequest, PlayerDto, RegisterRequest } from '@/types/api';

const TOKEN_KEY = 'tt.token';
const PLAYER_KEY = 'tt.player';

function readPlayer(): PlayerDto | null {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_KEY) ?? 'null') as PlayerDto | null;
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const player = ref<PlayerDto | null>(readPlayer());

  const isAuthenticated = computed(() => token.value !== null);
  const membership = computed(() => player.value?.membership ?? null);
  const hasTeam = computed(() => membership.value !== null);
  const canLogPerformance = computed(() => membership.value?.status === 'Active');

  function setSession(session: AuthResponse) {
    token.value = session.accessToken;
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    setPlayer(session.player);
  }

  function setPlayer(value: PlayerDto) {
    player.value = value;
    localStorage.setItem(PLAYER_KEY, JSON.stringify(value));
  }

  function logout() {
    token.value = null;
    player.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(PLAYER_KEY);
  }

  async function login(request: LoginRequest) {
    setSession(await api.auth.login(request));
  }

  async function register(request: RegisterRequest) {
    setSession(await api.auth.register(request));
  }

  async function refreshPlayer() {
    if (!token.value) return;
    setPlayer(await api.players.me());
  }

  return { token, player, isAuthenticated, membership, hasTeam, canLogPerformance, login, register, logout, setPlayer, refreshPlayer };
});
