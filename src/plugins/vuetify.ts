import 'vuetify/styles';
import '@/assets/fonts/fonts.scss';
import '@/assets/styles/touch-hover.scss';
import '@/assets/styles/font-scale.scss';
import '@/assets/styles/contrast.scss';
import '@/assets/styles/focus.scss';
import '@/assets/styles/text-wrap.scss';
import '@/assets/styles/fields.scss';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, ru, pl } from 'vuetify/locale';
import type { AppTheme } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { initialLocale } from '@/i18n';
import { buildThemes, themeName, type ThemeMode } from './theme';

// 'system' isn't a mode of any registered Vuetify theme -- it has to resolve to
// whichever of 'light'/'dark' the OS currently prefers before the theme's name
// can be handed to createVuetify().
function resolveTheme(preference: AppTheme): ThemeMode {
	if (preference !== 'system') {
		return preference;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The saved scheme and accent from the start, so they never flash in after the
// standard one; from then on, useAppTheme keeps the theme in step.
const { general } = settingsService.load();

export default createVuetify({
	theme: {
		defaultTheme: themeName(general.scheme, resolveTheme(general.theme)),
		themes: buildThemes(general.accent),
	},
	defaults: {
		VAppBar: { elevation: 0, color: 'background' },
		VBtn: { variant: 'tonal' },
		VCard: { variant: 'outlined' },
		// Messages render only once there are some: an empty area under a field is
		// still a role="alert", and a screen reader says "alert" for each one when
		// a dialog opens. fields.scss keeps the space it took.
		VTextField: { variant: 'outlined', hideDetails: 'auto' },
		VSelect: { variant: 'outlined', hideDetails: 'auto' },
		VTextarea: { variant: 'outlined', hideDetails: 'auto' },
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
