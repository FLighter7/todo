// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, nextTick } from 'vue';
import vuetify from '@/plugins/vuetify';
import { SCHEMES, paletteFor } from '@/plugins/theme';
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { useSettingsStore } from '@/stores/settings';
import { useAppTheme } from '../useAppTheme';

const Host = defineComponent({
	setup() {
		useAppTheme();
		return () => null;
	},
});

let wrappers: VueWrapper[] = [];

function mountHost(): VueWrapper {
	const wrapper = mount(Host, { global: { plugins: [vuetify] } });
	wrappers.push(wrapper);
	return wrapper;
}

function saveGeneral(general: Partial<AppSettings['general']>): void {
	settingsService.save({
		...DEFAULT_SETTINGS,
		general: { ...DEFAULT_SETTINGS.general, ...general },
	});
}

function themeName(): string {
	return vuetify.theme.global.name.value;
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

afterEach(() => {
	for (const wrapper of wrappers) {
		wrapper.unmount();
	}
	wrappers = [];
});

describe('useAppTheme', () => {
	it('applies the saved scheme in the saved mode', () => {
		saveGeneral({ theme: 'dark', scheme: 'cool' });

		mountHost();

		expect(themeName()).toBe('cool-dark');
	});

	it('applies a change of mode or scheme made through the store', async () => {
		saveGeneral({ theme: 'light' });
		mountHost();
		const settings = useSettingsStore();

		settings.setTheme('dark');
		await nextTick();
		expect(themeName()).toBe('standard-dark');

		settings.setScheme('contrast');
		await nextTick();
		expect(themeName()).toBe('contrast-dark');
	});

	it('fits the accent into every theme, and gives each its own back without one', async () => {
		mountHost();
		const settings = useSettingsStore();

		settings.setAccent('#D81B60');
		await nextTick();
		for (const [scheme, mode] of [
			['standard', 'light'],
			['contrast', 'dark'],
		] as const) {
			expect(vuetify.theme.themes.value[`${scheme}-${mode}`].colors.primary).toBe(
				paletteFor(scheme, mode, '#D81B60').colors.primary,
			);
		}

		settings.setAccent(null);
		await nextTick();
		expect(vuetify.theme.themes.value['standard-light'].colors.primary).toBe(
			SCHEMES.standard.light.colors.primary,
		);
	});

	it('leaves the schemes themselves untouched by an accent', async () => {
		mountHost();

		useSettingsStore().setAccent('#D81B60');
		await nextTick();

		expect(SCHEMES.standard.light.colors.primary).toBe('#2F5D50');
	});

	it('tints the page background and the browser bar with the theme', async () => {
		const meta = document.createElement('meta');
		meta.name = 'theme-color';
		document.head.append(meta);
		saveGeneral({ theme: 'light' });
		mountHost();

		expect(meta.content.toUpperCase()).toBe(SCHEMES.standard.light.colors.background);

		useSettingsStore().setTheme('dark');
		await nextTick();
		expect(meta.content.toUpperCase()).toBe(SCHEMES.standard.dark.colors.background);
		expect(document.documentElement.style.backgroundColor).not.toBe('');

		meta.remove();
	});

	describe('system preference tracking', () => {
		let listeners: Array<(event: MediaQueryListEvent) => void>;
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			listeners = [];
			originalMatchMedia = window.matchMedia;
			window.matchMedia = ((query: string) =>
				({
					matches: false,
					media: query,
					onchange: null,
					addListener: () => {},
					removeListener: () => {},
					addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
						listeners.push(listener);
					},
					removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
						listeners = listeners.filter((candidate) => candidate !== listener);
					},
					dispatchEvent: () => false,
				}) as MediaQueryList) as typeof window.matchMedia;
		});

		afterEach(() => {
			window.matchMedia = originalMatchMedia;
		});

		it('follows OS theme changes while "system" is selected', async () => {
			saveGeneral({ theme: 'system', scheme: 'neutral' });
			mountHost();
			expect(themeName()).toBe('neutral-light');

			for (const listener of listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}
			await nextTick();

			expect(themeName()).toBe('neutral-dark');
		});

		it('ignores OS theme changes when a manual preference is selected', async () => {
			saveGeneral({ theme: 'light' });
			mountHost();

			for (const listener of listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}
			await nextTick();

			expect(themeName()).toBe('standard-light');
		});

		it('stops listening once unmounted', () => {
			mountHost().unmount();
			wrappers = [];

			expect(listeners).toEqual([]);
		});
	});
});
