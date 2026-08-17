// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import SettingsPage from './SettingsPage.vue';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

function mountPage() {
	return mount(SettingsPage, { global: { plugins: [vuetify, i18n] } });
}

describe('SettingsPage start page', () => {
	it('changes the start page through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [startPageSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await startPageSelect.vm.$emit('update:modelValue', 'matrix');

		expect(settings.general.startPage).toBe('matrix');
	});
});

describe('SettingsPage cleanup window', () => {
	it('changes cleanupDays through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [, cleanupSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await cleanupSelect.vm.$emit('update:modelValue', 90);

		expect(settings.general.cleanupDays).toBe(90);
	});
});

describe('SettingsPage per-entity sections', () => {
	it('shows one section per entity with a rows toggle and two switches', () => {
		const wrapper = mountPage();

		expect(wrapper.findAllComponents({ name: 'VBtnToggle' })).toHaveLength(3);
		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(6);
	});

	it('changes rows for one entity without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [dreamsRows] = wrapper.findAllComponents({ name: 'VBtnToggle' });
		await dreamsRows.vm.$emit('update:modelValue', 2);

		expect(settings.dreams.rows).toBe(2);
		expect(settings.goals.rows).toBe(1);
		expect(settings.tasks.rows).toBe(1);
	});

	it('changes confirmDone for one entity without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const switches = wrapper.findAllComponents({ name: 'VSwitch' });
		await switches[0].vm.$emit('update:modelValue', true);

		expect(settings.dreams.confirmDone).toBe(true);
		expect(settings.dreams.confirmReopen).toBe(false);
		expect(settings.goals.confirmDone).toBe(false);
	});

	it('changes confirmReopen for one entity without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const switches = wrapper.findAllComponents({ name: 'VSwitch' });
		await switches[1].vm.$emit('update:modelValue', true);

		expect(settings.dreams.confirmReopen).toBe(true);
		expect(settings.dreams.confirmDone).toBe(false);
		expect(settings.goals.confirmReopen).toBe(false);
	});
});
