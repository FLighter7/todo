// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { DEFAULT_SETTINGS } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { useSettingsStore } from '@/stores/settings';
import ThemeMenu from '../ThemeMenu.vue';

function openMenu(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Choose theme"]').trigger('click');
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
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
		settingsService.save({
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, theme: 'dark' },
		});
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const dark = items.find((item) => item.text().includes('Dark'));
		const light = items.find((item) => item.text().includes('Light'));

		expect(dark?.props('appendIcon')).toBeTruthy();
		expect(light?.props('appendIcon')).toBeFalsy();
	});

	it('persists the chosen theme', async () => {
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);
		await clickButtonByText(wrapper, 'Dark');

		expect(useSettingsStore().general.theme).toBe('dark');
	});
});
