import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';
import App from '@/App.vue';
import router from '@/router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';

createApp(App).use(createPinia()).use(router).use(vuetify).use(i18n).mount('#app');

registerSW({ immediate: true });
