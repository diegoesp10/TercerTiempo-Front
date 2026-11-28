import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { busy } from './directives/busy';
import { Icon } from './icons';
import router from './router';
import { useAuthStore } from './stores/auth';
import { useConsentStore } from './stores/consent';
import { useSeasonStore } from './stores/season';
import { installSessionSync } from './stores/sessionSync';
import { installAnalytics } from './utils/analytics';
import { installFormValidation } from './utils/formValidation';
import '@fontsource-variable/archivo/wdth.css';
import './style.css';

const pinia = createPinia();
const app = createApp(App).use(pinia);
// Con una sesión guardada, la API dice ya si aún vale, mientras baja el código de la ruta: la primera navegación lo
// espera (router) y nada que necesite la sesión sale antes.
void useAuthStore(pinia).sessionChecked();
app.use(router).component('Icon', Icon).directive('busy', busy);
// La analítica propia se instala siempre pero no hace nada sin el consentimiento del visitante.
installAnalytics(router);
installSessionSync(router);
installFormValidation();
// Lo que necesita cualquier página (temporadas y política de cookies) se pide ya, mientras baja el código de la ruta, y
// no al montar. Nada de esto bloquea la vista.
void useSeasonStore(pinia).load();
void useConsentStore(pinia).load();
// Montar sobre la ruta inicial resuelta evita una vista vacía al entrar directamente por un enlace compartido.
void router.isReady().then(() => app.mount('#app'));
