// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import SettingsPage from '../SettingsPage.vue';
import GeneralSettings from '../containers/GeneralSettings.vue';
import PageSettings from '../containers/PageSettings.vue';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

function mountPage() {
	return mount(SettingsPage, { global: { plugins: [vuetify, i18n] } });
}

function tabs(wrapper: ReturnType<typeof mountPage>) {
	return wrapper.findAllComponents({ name: 'VTab' });
}

async function openTab(wrapper: ReturnType<typeof mountPage>, label: string): Promise<void> {
	const tab = tabs(wrapper).find((candidate) => candidate.text() === label);
	await tab?.trigger('click');
}

describe('SettingsPage tabs', () => {
	it('runs General, Tasks, Matrix, Goals, Dreams, Groups, and opens on General', () => {
		const wrapper = mountPage();

		expect(tabs(wrapper).map((tab) => tab.text())).toEqual([
			'General',
			'Tasks',
			'Matrix',
			'Goals',
			'Dreams',
			'Groups',
		]);
		expect(wrapper.findComponent(GeneralSettings).exists()).toBe(true);
		expect(wrapper.findComponent(PageSettings).exists()).toBe(false);
	});

	it("shows a page's own settings under its tab", async () => {
		const wrapper = mountPage();

		await openTab(wrapper, 'Goals');

		expect(wrapper.findComponent(GeneralSettings).exists()).toBe(false);
		expect(wrapper.findComponent(PageSettings).props('page')).toBe('goals');

		await openTab(wrapper, 'General');

		expect(wrapper.findComponent(GeneralSettings).exists()).toBe(true);
	});

	it('keeps the tab of a page that is switched off', () => {
		const settings = useSettingsStore();
		for (const page of ['tasks', 'matrix', 'goals', 'dreams', 'groups'] as const) {
			settings.setPageVisible(page, false);
		}

		expect(tabs(mountPage())).toHaveLength(6);
	});
});
