import { computed, type ComputedRef } from 'vue';
import { useTheme } from 'vuetify';
import { parseThemeName, type ThemeMode } from '@/plugins/theme';
import type { ColorScheme } from '@/types';

/**
 * The scheme and mode on screen, read off Vuetify's theme rather than the
 * settings store, so that a presentational component can draw a colour for
 * the palette it sits on.
 */
export function useThemeOnScreen(): ComputedRef<{ scheme: ColorScheme; mode: ThemeMode }> {
	const theme = useTheme();

	return computed(
		() =>
			parseThemeName(theme.global.name.value) ?? {
				scheme: 'standard',
				mode: theme.current.value.dark ? 'dark' : 'light',
			},
	);
}
