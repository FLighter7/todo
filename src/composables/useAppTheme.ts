import { computed, onScopeDispose, shallowRef, watch, watchEffect } from 'vue';
import { useTheme } from 'vuetify';
import { buildThemes, themeName, type ThemeMode } from '@/plugins/theme';
import { useSettingsStore } from '@/stores/settings';

/**
 * Keeps Vuetify's theme in step with the settings: the scheme, its light or
 * dark version -- the OS's own while the setting is "system" -- and the
 * accent. Reactive rather than driven by the controls that change them, so
 * every write path applies live: the theme menu, Settings, a backup restore.
 * Called once, from App.vue's setup, which runs before the first paint.
 */
export function useAppTheme(): void {
	const theme = useTheme();
	const settings = useSettingsStore();

	const media = window.matchMedia('(prefers-color-scheme: dark)');
	const systemDark = shallowRef(media.matches);
	function followSystem(event: MediaQueryListEvent): void {
		systemDark.value = event.matches;
	}
	media.addEventListener('change', followSystem);
	onScopeDispose(() => media.removeEventListener('change', followSystem));

	const mode = computed<ThemeMode>(() => {
		const preference = settings.general.theme;
		if (preference !== 'system') {
			return preference;
		}

		return systemDark.value ? 'dark' : 'light';
	});

	// Into every theme, not only the one on screen, so that switching the scheme
	// or the mode later finds the accent already fitted. Without one, each
	// palette gets its own primary colour back.
	watch(
		() => settings.general.accent,
		(accent) => {
			for (const [name, { colors }] of Object.entries(buildThemes(accent))) {
				Object.assign(theme.themes.value[name].colors, colors);
			}
		},
		{ immediate: true },
	);

	watchEffect(() => {
		theme.change(themeName(settings.general.scheme, mode.value));
	});

	// The <html> background shows through on iOS overscroll bounce and during
	// the brief window before Vuetify's own styles paint, and the theme-color
	// meta tints the browser's bar and an installed app's status bar: both
	// follow the theme rather than staying the light background index.html
	// starts them on. This app's palettes only ever use hex strings.
	watchEffect(() => {
		const background = theme.current.value.colors.background as string;
		document.documentElement.style.backgroundColor = background;
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
	});
}
