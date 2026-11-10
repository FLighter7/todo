import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';
import App from '@/App.vue';
import router from '@/router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';

const app = createApp(App).use(createPinia()).use(router).use(vuetify).use(i18n);

// Wait for the initial route to resolve so the app bar's extension slot
// (Active/History tabs) has the right visibility on the very first paint —
// otherwise it appears a moment later and Vuetify animates the resulting
// app-bar height change, producing a visible layout jump on load.
void router.isReady().then(() => {
	app.mount('#app');
});

registerSW({
	immediate: true,
	onRegisterError(error) {
		// No service worker means no offline mode and, on iOS, no exemption from
		// Safari's seven-day deletion of site data. Never swallow this.
		console.error('Service worker registration failed', error);
	},
});
