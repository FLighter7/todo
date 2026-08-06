import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, ru } from 'vuetify/locale';
import { initialLocale } from '@/i18n';

const THEME_STORAGE_KEY = 'todo.theme';

export type AppTheme = 'light' | 'dark' | 'system';

function readStoredTheme(): AppTheme {
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function persistTheme(theme: AppTheme): void {
	localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export default createVuetify({
	theme: {
		defaultTheme: readStoredTheme(),
	},
	icons: {
		defaultSet: 'mdi',
		aliases,
		sets: { mdi },
	},
	// Vuetify's own strings (pagination, sorting, "Items per page") stay in its
	// locale system rather than vue-i18n: routing them through vue-i18n would
	// need the runtime message compiler, which precompiled messages drop.
	locale: {
		locale: initialLocale,
		fallback: 'en',
		messages: { en, ru },
	},
});
