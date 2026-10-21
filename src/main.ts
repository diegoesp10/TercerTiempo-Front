import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { Icon } from './icons';
import router from './router';
import './style.css';

createApp(App).use(createPinia()).use(router).component('Icon', Icon).mount('#app');
