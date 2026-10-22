<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, errorMessage } from '@/api/http';
import ClubPicker from '@/components/clubs/ClubPicker.vue';
import AuthPanel from '@/components/layout/AuthPanel.vue';
import Alert from '@/components/ui/Alert.vue';
import { useAuthStore } from '@/stores/auth';
import type { AccountType, SquadInviteDto } from '@/types/api';
import { positionLabels } from '@/utils/format';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive<{
  accountType: AccountType;
  email: string;
  password: string;
  displayName: string;
  accessCode: string;
}>({
  accountType: typeof route.query.invite === 'string' ? 'Player' : 'Coach',
  email: '',
  password: '',
  displayName: '',
  accessCode: typeof route.query.invite === 'string' ? route.query.invite.toUpperCase() : typeof route.query.code === 'string' ? route.query.code.toUpperCase() : '',
});

// Aceptación expresa de las condiciones y la política de privacidad: sin ella no se envía el formulario.
const acceptsTerms = ref(false);

const isPlayer = computed(() => form.accountType === 'Player');
const isCoach = computed(() => form.accountType === 'Coach');
const isClub = computed(() => form.accountType === 'Club');

const accountTypes: { value: AccountType; title: string; description: string }[] = [
  { value: 'Coach', title: 'Cuerpo técnico', description: 'Entrenador, ayudante, delegado… Con el código de acceso de tu club registras las actas de tu plantilla.' },
  { value: 'Player', title: 'Jugador', description: 'Entras con el código personal que te da tu club o entrenador: ya es tu ficha, sin escribir nada más.' },
  { value: 'Club', title: 'Club', description: 'Das de alta a los técnicos de tus equipos cada temporada con un código de acceso.' },
];

const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

// El jugador no escribe su nombre: el código personal identifica su ficha y la cuenta se llama como ella.
const invite = shallowRef<SquadInviteDto | null>(null);
const inviteError = ref<string | null>(null);
const checkingInvite = ref(false);
const inviteCode = computed(() => form.accessCode.trim());

watch(
  () => [form.accountType, inviteCode.value] as const,
  async ([type, code]) => {
    invite.value = null;
    inviteError.value = null;
    if (type !== 'Player' || code.length < 12) return;
    checkingInvite.value = true;
    try {
      const result = await api.auth.invite(code);
      if (inviteCode.value !== code) return;
      invite.value = result;
    } catch (e) {
      if (inviteCode.value === code) inviteError.value = errorMessage(e);
    } finally {
      if (inviteCode.value === code) checkingInvite.value = false;
    }
  },
  { immediate: true },
);

async function submit() {
  loading.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    await auth.register({
      email: form.email,
      password: form.password,
      displayName: isPlayer.value ? null : form.displayName,
      accountType: form.accountType,
      position: null,
      birthDate: null,
      accessCode: isPlayer.value || isCoach.value ? inviteCode.value : null,
    });
    await router.push({ name: 'home' });
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthPanel title="Tu equipo, con datos de verdad" subtitle="Para clubes, cuerpos técnicos y jugadores.">
    <div>
      <h1 class="text-3xl font-bold text-slate-900">Darme de alta</h1>
      <p class="mt-1 text-sm text-slate-500">Elige qué papel tienes: la cuenta no se puede cambiar después.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <Alert v-if="error" kind="error">{{ error }}</Alert>

        <div class="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tipo de cuenta">
          <button
            v-for="type in accountTypes"
            :key="type.value"
            type="button"
            role="radio"
            :aria-checked="form.accountType === type.value"
            class="rounded-xl border p-3 text-left transition"
            :class="form.accountType === type.value ? 'border-brand-400 bg-brand-500/15 ring-2 ring-brand-500/30' : 'border-slate-200 bg-surface hover:border-brand-400/60'"
            @click="form.accountType = type.value"
          >
            <p class="font-medium text-slate-900">{{ type.title }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ type.description }}</p>
          </button>
        </div>

        <div v-if="isCoach">
          <label class="label" for="accessCode">Código de acceso de tu club</label>
          <input
            id="accessCode"
            v-model="form.accessCode"
            type="text"
            required
            maxlength="12"
            autocomplete="off"
            spellcheck="false"
            placeholder="ABCD234567"
            class="input font-mono uppercase tracking-widest"
            @input="form.accessCode = form.accessCode.toUpperCase()"
          />
          <p class="mt-1 text-xs text-slate-400">
            Te lo entrega tu club al nombrarte para un equipo y una temporada. Al crear la cuenta quedas en el cuerpo técnico de esa plantilla.
          </p>
          <p v-if="fieldErrors.accessCode" class="field-error">{{ fieldErrors.accessCode[0] }}</p>
        </div>

        <div v-if="isPlayer">
          <label class="label" for="inviteCode">Tu código personal de invitación</label>
          <input
            id="inviteCode"
            v-model="form.accessCode"
            type="text"
            required
            maxlength="20"
            autocomplete="off"
            spellcheck="false"
            placeholder="ABCD2345EFGH"
            class="input font-mono uppercase tracking-widest"
            @input="form.accessCode = form.accessCode.toUpperCase()"
          />
          <p v-if="fieldErrors.accessCode" class="field-error">{{ fieldErrors.accessCode[0] }}</p>
          <p v-else-if="inviteError" class="field-error">{{ inviteError }}</p>
          <p v-else-if="checkingInvite" class="mt-1 flex items-center gap-2 text-xs text-slate-400"><span class="busy-spinner"></span>Comprobando el código…</p>
          <p v-else-if="!invite" class="mt-1 text-xs text-slate-400">
            Te lo genera tu club o tu entrenador para tu ficha. No tienes que escribir tu nombre: la cuenta se crea con el de la ficha.
          </p>
          <div v-if="invite" class="mt-3 rounded-xl border border-accent-400/40 bg-brand-500/10 p-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tu ficha de jugador</p>
            <p class="mt-1 text-lg font-semibold text-slate-900">{{ invite.player.fullName }}</p>
            <p class="mt-1 text-sm text-slate-500">
              {{ invite.teamName }} · {{ invite.competitionName }} · {{ invite.seasonLabel }}
              <template v-if="invite.player.position"> · {{ positionLabels[invite.player.position] }}</template>
              <template v-if="invite.player.shirtNumber"> · dorsal {{ invite.player.shirtNumber }}</template>
            </p>
            <p class="mt-2 text-xs text-slate-500">Si esta no es tu ficha, no sigas: avisa a quien te dio el código.</p>
          </div>
        </div>

        <div v-if="isClub">
          <label class="label" for="displayName">Club</label>
          <ClubPicker id="displayName" v-model="form.displayName" />
          <p class="mt-1 text-xs text-slate-400">
            Elige tu club de la lista: solo puede haber una cuenta por club y al crearla quedan vinculados todos sus equipos (primero y filiales).
          </p>
          <p v-if="fieldErrors.displayName" class="field-error">{{ fieldErrors.displayName[0] }}</p>
        </div>
        <div v-else-if="isCoach">
          <label class="label" for="displayName">Nombre y apellidos</label>
          <input id="displayName" v-model="form.displayName" type="text" required maxlength="120" class="input" />
          <p v-if="fieldErrors.displayName" class="field-error">{{ fieldErrors.displayName[0] }}</p>
        </div>

        <div>
          <label class="label" for="email">Email</label>
          <input id="email" v-model="form.email" type="email" autocomplete="email" required class="input" />
          <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email[0] }}</p>
        </div>

        <div>
          <label class="label" for="password">Contraseña</label>
          <input id="password" v-model="form.password" type="password" autocomplete="new-password" required minlength="8" class="input" />
          <p class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres con al menos un número.</p>
          <p v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password[0] }}</p>
        </div>

        <label class="flex items-start gap-3 text-sm text-slate-600">
          <input v-model="acceptsTerms" type="checkbox" required class="mt-1 h-4 w-4 shrink-0 accent-brand-500" />
          <span>
            He leído y acepto las
            <RouterLink to="/condiciones" target="_blank" class="font-semibold text-accent-400 hover:underline">condiciones de uso</RouterLink>
            y la
            <RouterLink to="/privacidad" target="_blank" class="font-semibold text-accent-400 hover:underline">política de privacidad</RouterLink>.
            <template v-if="isPlayer">Si tienes entre 14 y 17 años, confirmas que cuentas con la autorización de tus padres o tutores.</template>
            <template v-else>Confirmas que eres mayor de edad{{ isClub ? ' y que puedes actuar en nombre del club' : '' }}.</template>
          </span>
        </label>

        <button type="submit" class="btn-primary w-full" v-busy="loading" :disabled="loading || !acceptsTerms || (isClub && !form.displayName) || (isPlayer && !invite)">
          {{ loading ? 'Creando cuenta…' : isPlayer ? 'Crear mi cuenta y vincular mi ficha' : isClub ? 'Crear cuenta de club' : 'Crear cuenta y canjear el código' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?
        <RouterLink to="/login" class="font-semibold text-accent-400 hover:underline">Entra</RouterLink>
      </p>
    </div>
  </AuthPanel>
</template>
