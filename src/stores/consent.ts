import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { ConsentAction, CookiePolicyDto } from '@/types/api';

const CONSENT_KEY = 'tt.consent';
// Datos de analítica: se crean solo al aceptarla y se borran al retirarla.
export const ANALYTICS_VISITOR_KEY = 'tt.aid';
export const ANALYTICS_SESSION_KEY = 'tt.sid';

interface SavedConsent {
  visitorId: string;
  version: string;
  analytics: boolean;
  at: string;
}

function read(): SavedConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    return raw ? (JSON.parse(raw) as SavedConsent) : null;
  } catch {
    return null;
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.floor(Math.random() * 16);
      return (c === 'x' ? r : (r % 4) + 8).toString(16);
    });
}

/**
 * Elección de cookies del visitante. Las necesarias y las de preferencias van siempre (están exentas); la analítica
 * propia solo si se acepta con la versión vigente de la política. Si la política cambia, se vuelve a preguntar.
 */
export const useConsentStore = defineStore('consent', () => {
  const saved = ref<SavedConsent | null>(read());
  const policy = ref<CookiePolicyDto | null>(null);
  const settingsOpen = ref(false);

  const needsBanner = computed(() => !!policy.value && (!saved.value || saved.value.version !== policy.value.version));
  const analyticsAllowed = computed(() => !!policy.value && !!saved.value && saved.value.version === policy.value.version && saved.value.analytics);
  const consentId = computed(() => saved.value?.visitorId ?? null);

  async function load() {
    try {
      policy.value = await api.privacy.cookies();
    } catch {
      /* sin respuesta: no se pregunta ni se mide nada */
    }
  }

  async function choose(action: ConsentAction, analytics = false) {
    const visitorId = saved.value?.visitorId ?? newId();
    const result = await api.privacy.consent(visitorId, action, analytics);
    saved.value = { visitorId, version: result.policyVersion, analytics: result.analytics, at: result.createdAt };
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(saved.value));
      if (!result.analytics) {
        localStorage.removeItem(ANALYTICS_VISITOR_KEY);
        sessionStorage.removeItem(ANALYTICS_SESSION_KEY);
      }
    } catch {
      /* sin almacenamiento: la elección vale para esta visita */
    }
    settingsOpen.value = false;
  }

  return { saved, policy, settingsOpen, needsBanner, analyticsAllowed, consentId, load, choose };
});
