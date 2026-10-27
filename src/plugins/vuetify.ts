import 'vuetify/styles';
import '@/assets/fonts/fonts.scss';
import '@/assets/styles/touch-hover.scss';
import '@/assets/styles/font-scale.scss';
import '@/assets/styles/contrast.scss';
import '@/assets/styles/focus.scss';
import '@/assets/styles/text-wrap.scss';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, ru, pl } from 'vuetify/locale';
import type { AppTheme } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { initialLocale } from '@/i18n';
import { THEMES } from './theme';

export type ResolvedTheme = 'light' | 'dark';

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
		defaultTheme: resolveTheme(settingsService.load().general.theme),
		themes: THEMES,
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
