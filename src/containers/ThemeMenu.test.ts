// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import vuetify, { readStoredTheme } from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import ThemeMenu from './ThemeMenu.vue';

function openMenu(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Choose theme"]').trigger('click');
}

beforeEach(() => {
	window.localStorage.clear();
	vuetify.theme.change('light');
});

describe('ThemeMenu', () => {
	it('lists the options in order: system, light, dark', async () => {
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const labels = wrapper
			.findAll('.v-list-item')
			.map((item) => item.text())
			.filter((text) => text.length > 0);

		expect(labels).toEqual(['System', 'Light', 'Dark']);
	});

	it('marks the currently stored preference with a checkmark', async () => {
		window.localStorage.setItem('todo.theme', 'dark');
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const dark = items.find((item) => item.text().includes('Dark'));
		const light = items.find((item) => item.text().includes('Light'));

		expect(dark?.props('appendIcon')).toBeTruthy();
		expect(light?.props('appendIcon')).toBeFalsy();
	});

	it('applies and persists the chosen theme', async () => {
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);
		await clickButtonByText(wrapper, 'Dark');

		expect(readStoredTheme()).toBe('dark');
		expect(vuetify.theme.global.name.value).toBe('dark');
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

		it('follows OS theme changes while "system" is selected', () => {
			window.localStorage.setItem('todo.theme', 'system');
			mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

			for (const listener of listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}

			expect(vuetify.theme.global.name.value).toBe('dark');
		});

		it('ignores OS theme changes when a manual preference is selected', () => {
			window.localStorage.setItem('todo.theme', 'light');
			mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

			for (const listener of listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}

			expect(vuetify.theme.global.name.value).toBe('light');
		});
	});
});
