// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { PAGE_ICONS } from '@/router';
import { useSettingsStore } from '@/stores/settings';
import type { AppPage } from '@/types';
import GeneralSettings from '../GeneralSettings.vue';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

function mountGeneral() {
	return mount(GeneralSettings, { global: { plugins: [vuetify, i18n] } });
}

function selects(wrapper: ReturnType<typeof mountGeneral>) {
	const [startPage, cleanupDays] = wrapper.findAllComponents({ name: 'VSelect' });
	return { startPage, cleanupDays };
}

function startPageItems(wrapper: ReturnType<typeof mountGeneral>) {
	return selects(wrapper).startPage.props('items') as Array<{ value: string; icon: string }>;
}

describe('GeneralSettings text size', () => {
	function stepButton(wrapper: ReturnType<typeof mountGeneral>, label: string) {
		return wrapper.get(`button[aria-label="${label}"]`);
	}

	it('steps the text size up and down through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountGeneral();

		await stepButton(wrapper, 'Larger text').trigger('click');
		expect(settings.general.fontScale).toBe(1.125);
		expect(wrapper.text()).toContain('112.5%');

		await stepButton(wrapper, 'Smaller text').trigger('click');
		await stepButton(wrapper, 'Smaller text').trigger('click');
		expect(settings.general.fontScale).toBe(0.875);
		expect(wrapper.text()).toContain('87.5%');
	});

	it('disables the step that would leave the range', async () => {
		const settings = useSettingsStore();
		settings.setFontScale(0.875);
		const wrapper = mountGeneral();

		expect(stepButton(wrapper, 'Smaller text').attributes('disabled')).toBeDefined();
		expect(stepButton(wrapper, 'Larger text').attributes('disabled')).toBeUndefined();

		settings.setFontScale(1.5);
		await wrapper.vm.$nextTick();

		expect(stepButton(wrapper, 'Larger text').attributes('disabled')).toBeDefined();
		expect(stepButton(wrapper, 'Smaller text').attributes('disabled')).toBeUndefined();
	});
});

describe('GeneralSettings start page', () => {
	it('changes the start page through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountGeneral();

		await selects(wrapper).startPage.vm.$emit('update:modelValue', 'matrix');

		expect(settings.general.startPage).toBe('matrix');
	});

	it("shows each page with the bottom bar's icon", () => {
		const items = startPageItems(mountGeneral());

		expect(items.map((item) => item.value)).toEqual([
			'tasks',
			'matrix',
			'dreams',
			'goals',
			'groups',
		]);
		for (const item of items) {
			expect(item.icon).toBe(PAGE_ICONS[item.value as AppPage]);
		}
	});

	it('offers no hidden page as the start page', () => {
		const settings = useSettingsStore();
		settings.setPageVisible('dreams', false);
		settings.setPageVisible('groups', false);

		expect(startPageItems(mountGeneral()).map((item) => item.value)).toEqual([
			'tasks',
			'matrix',
			'goals',
		]);
	});

	it('leaves Tasks as the only start page with every page off', () => {
		const settings = useSettingsStore();
		for (const page of ['dreams', 'goals', 'groups', 'tasks', 'matrix'] as const) {
			settings.setPageVisible(page, false);
		}
		const wrapper = mountGeneral();

		expect(startPageItems(wrapper).map((item) => item.value)).toEqual(['tasks']);
		expect(selects(wrapper).startPage.props('modelValue')).toBe('tasks');
	});

	it('has no page switches of its own', () => {
		const wrapper = mountGeneral();

		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(0);
		expect(wrapper.findAllComponents({ name: 'VCheckbox' })).toHaveLength(0);
	});
});

describe('GeneralSettings cleanup window', () => {
	it('changes cleanupDays through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountGeneral();

		await selects(wrapper).cleanupDays.vm.$emit('update:modelValue', 90);

		expect(settings.general.cleanupDays).toBe(90);
	});

	it('warns that shortening the window deletes older items sooner', () => {
		const wrapper = mountGeneral();

		expect(selects(wrapper).cleanupDays.props('hint')).toBe(
			'Shortening this deletes older closed items and completion history sooner.',
		);
		expect(wrapper.text()).toContain(
			'Shortening this deletes older closed items and completion history sooner.',
		);
	});
});
