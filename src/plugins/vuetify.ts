import 'vuetify/styles';
import '@/assets/fonts/fonts.scss';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, ru, pl } from 'vuetify/locale';
import { initialLocale } from '@/i18n';

const THEME_STORAGE_KEY = 'todo.theme';

export type AppTheme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export function readStoredTheme(): AppTheme {
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function persistTheme(theme: AppTheme): void {
	localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// 'system' isn't a registered Vuetify theme name -- it has to resolve to
// whichever of 'light'/'dark' the OS currently prefers before it can be
// handed to createVuetify() or theme.change().
export function resolveTheme(preference: AppTheme): ResolvedTheme {
	if (preference !== 'system') {
		return preference;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default createVuetify({
	theme: {
		defaultTheme: resolveTheme(readStoredTheme()),
		themes: {
			light: {
				colors: {
					background: '#F6F4EF',
					surface: '#FBFAF6',
					'surface-variant': '#EAE5D8',
					'on-surface-variant': '#6E6A5D',
					outline: '#D6D0C0',
					primary: '#2F5D50',
					'on-primary': '#F6F4EF',
					'on-background': '#2B2A26',
					'on-surface': '#2B2A26',
				},
			},
			dark: {
				colors: {
					background: '#1B1A17',
					surface: '#221F1A',
					'surface-variant': '#332E27',
					'on-surface-variant': '#B3AC9C',
					outline: '#4A453B',
					primary: '#74AC90',
					'on-primary': '#12241D',
					'on-background': '#EFEBE0',
					'on-surface': '#EFEBE0',
				},
			},
		},
	},
	defaults: {
		VAppBar: { elevation: 0, color: 'background' },
		VBtn: { variant: 'tonal' },
		VCard: { variant: 'outlined' },
		VTextField: { variant: 'outlined' },
		VSelect: { variant: 'outlined' },
		VTextarea: { variant: 'outlined' },
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
		messages: { en, ru, pl },
	},
});
