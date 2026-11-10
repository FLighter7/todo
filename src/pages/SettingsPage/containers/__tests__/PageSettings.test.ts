// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import type { AppPage } from '@/types';
import PageSettings from '../PageSettings.vue';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

function mountFor(page: AppPage) {
	return mount(PageSettings, { props: { page }, global: { plugins: [vuetify, i18n] } });
}

// The page switch comes first, then confirmDone and confirmReopen.
function switches(wrapper: ReturnType<typeof mountFor>) {
	const [shown, confirmDone, confirmReopen] = wrapper.findAllComponents({ name: 'VSwitch' });
	return { shown, confirmDone, confirmReopen };
}

function rowsToggle(wrapper: ReturnType<typeof mountFor>) {
	return wrapper.findComponent({ name: 'VBtnToggle' });
}

describe('PageSettings page switch', () => {
	it('switches the page off and on through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountFor('goals');

		expect(switches(wrapper).shown.props('label')).toBe('Show this page');
		expect(switches(wrapper).shown.props('modelValue')).toBe(true);

		await switches(wrapper).shown.vm.$emit('update:modelValue', false);

		expect(settings.general.pages).toEqual({
			tasks: true,
			matrix: true,
			dreams: true,
			goals: false,
			groups: true,
		});
		expect(switches(wrapper).shown.props('modelValue')).toBe(false);

		await switches(wrapper).shown.vm.$emit('update:modelValue', true);

		expect(settings.general.pages.goals).toBe(true);
	});

	it('hands the start page back to Tasks when its page is switched off', async () => {
		const settings = useSettingsStore();
		settings.setStartPage('groups');

		await switches(mountFor('groups')).shown.vm.$emit('update:modelValue', false);

		expect(settings.general.startPage).toBe('tasks');
	});

	it('lets the last page be switched off too', async () => {
		const settings = useSettingsStore();
		for (const page of ['dreams', 'goals', 'groups', 'tasks'] as const) {
			settings.setPageVisible(page, false);
		}

		await switches(mountFor('matrix')).shown.vm.$emit('update:modelValue', false);

		expect(Object.values(settings.general.pages)).toEqual([false, false, false, false, false]);
		expect(settings.general.startPage).toBe('tasks');
	});
});

describe('PageSettings per page', () => {
	it('gives the matrix nothing but its page switch', () => {
		const wrapper = mountFor('matrix');

		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(1);
		expect(rowsToggle(wrapper).exists()).toBe(false);
	});

	it('gives groups the confirm switches but no rows toggle', () => {
		const wrapper = mountFor('groups');

		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(3);
		expect(rowsToggle(wrapper).exists()).toBe(false);
	});

	it.each(['tasks', 'goals', 'dreams'] as const)(
		'gives %s a rows toggle and both confirm switches',
		(page) => {
			const wrapper = mountFor(page);

			expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(3);
			expect(rowsToggle(wrapper).exists()).toBe(true);
		},
	);

	it('changes rows for its own page without touching the others', async () => {
		const settings = useSettingsStore();

		await rowsToggle(mountFor('dreams')).vm.$emit('update:modelValue', 2);

		expect(settings.dreams.rows).toBe(2);
		expect(settings.goals.rows).toBe(1);
		expect(settings.tasks.rows).toBe(1);
	});

	it('clamps an out-of-range rows value to 1 instead of storing it as-is', async () => {
		const settings = useSettingsStore();
		settings.updatePageSettings('dreams', { rows: 2 });

		await rowsToggle(mountFor('dreams')).vm.$emit('update:modelValue', undefined);

		expect(settings.dreams.rows).toBe(1);
	});

	it('changes confirmDone for its own page without touching the others', async () => {
		const settings = useSettingsStore();

		await switches(mountFor('dreams')).confirmDone.vm.$emit('update:modelValue', true);

		expect(settings.dreams.confirmDone).toBe(true);
		expect(settings.dreams.confirmReopen).toBe(false);
		expect(settings.goals.confirmDone).toBe(false);
	});

	it('changes confirmReopen for its own page without touching the others', async () => {
		const settings = useSettingsStore();

		await switches(mountFor('groups')).confirmReopen.vm.$emit('update:modelValue', true);

		expect(settings.groups.confirmReopen).toBe(true);
		expect(settings.groups.confirmDone).toBe(false);
		expect(settings.tasks.confirmReopen).toBe(false);
	});
});

describe('PageSettings of a page switched off', () => {
	it('keeps its settings in view with their values, out of reach', () => {
		const settings = useSettingsStore();
		settings.updatePageSettings('dreams', { rows: 2, confirmDone: true });
		settings.setPageVisible('dreams', false);
		const wrapper = mountFor('dreams');

		const { shown, confirmDone, confirmReopen } = switches(wrapper);
		expect(shown.props('disabled')).not.toBe(true);
		expect(rowsToggle(wrapper).props('disabled')).toBe(true);
		expect(rowsToggle(wrapper).props('modelValue')).toBe(2);
		expect(confirmDone.props('disabled')).toBe(true);
		expect(confirmDone.props('modelValue')).toBe(true);
		expect(confirmReopen.props('disabled')).toBe(true);
	});

	it('brings them back within reach once the page is switched on', async () => {
		const settings = useSettingsStore();
		settings.setPageVisible('goals', false);
		const wrapper = mountFor('goals');

		await switches(wrapper).shown.vm.$emit('update:modelValue', true);

		expect(rowsToggle(wrapper).props('disabled')).not.toBe(true);
		expect(switches(wrapper).confirmDone.props('disabled')).not.toBe(true);
	});

	it('keeps Tasks within reach with every page off, since Tasks is still open then', () => {
		const settings = useSettingsStore();
		for (const page of ['tasks', 'matrix', 'goals', 'dreams', 'groups'] as const) {
			settings.setPageVisible(page, false);
		}
		const wrapper = mountFor('tasks');

		expect(switches(wrapper).shown.props('modelValue')).toBe(false);
		expect(rowsToggle(wrapper).props('disabled')).not.toBe(true);
		expect(switches(wrapper).confirmDone.props('disabled')).not.toBe(true);
	});
});
