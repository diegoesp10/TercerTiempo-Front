import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { busy } from './directives/busy';
import { Icon } from './icons';
import router from './router';
import { installAnalytics } from './utils/analytics';
import './style.css';

const app = createApp(App).use(createPinia()).use(router).component('Icon', Icon).directive('busy', busy);
// La analítica propia se instala siempre pero no hace nada sin el consentimiento del visitante.
installAnalytics(router);
// Montar sobre la ruta inicial resuelta evita una vista vacía al entrar directamente por un enlace compartido.
void router.isReady().then(() => app.mount('#app'));
