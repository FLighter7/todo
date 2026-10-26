// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import SettingsPage from '../SettingsPage.vue';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

function mountPage() {
	return mount(SettingsPage, { global: { plugins: [vuetify, i18n] } });
}

describe('SettingsPage text size', () => {
	function stepButton(wrapper: ReturnType<typeof mountPage>, label: string) {
		return wrapper.get(`button[aria-label="${label}"]`);
	}

	it('steps the text size up and down through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

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
		const wrapper = mountPage();

		expect(stepButton(wrapper, 'Smaller text').attributes('disabled')).toBeDefined();
		expect(stepButton(wrapper, 'Larger text').attributes('disabled')).toBeUndefined();

		settings.setFontScale(1.5);
		await wrapper.vm.$nextTick();

		expect(stepButton(wrapper, 'Larger text').attributes('disabled')).toBeDefined();
		expect(stepButton(wrapper, 'Smaller text').attributes('disabled')).toBeUndefined();
	});
});

describe('SettingsPage pages', () => {
	function checkboxes(wrapper: ReturnType<typeof mountPage>) {
		return wrapper.findAllComponents({ name: 'VCheckbox' });
	}

	it("lists every page in the bottom bar's order, all ticked and all free to untick", () => {
		const boxes = checkboxes(mountPage());

		expect(boxes.map((box) => box.props('label'))).toEqual([
			'Dreams',
			'Goals',
			'Groups',
			'Tasks',
			'Matrix',
		]);
		expect(boxes.map((box) => box.props('modelValue'))).toEqual([true, true, true, true, true]);
		expect(boxes.every((box) => box.props('disabled') !== true)).toBe(true);
	});

	it('disables Tasks only while it is the one page left', async () => {
		const settings = useSettingsStore();
		for (const page of ['dreams', 'goals', 'groups', 'matrix'] as const) {
			settings.setPageVisible(page, false);
		}
		const wrapper = mountPage();

		const disabled = () => checkboxes(wrapper).map((box) => box.props('disabled') === true);
		expect(disabled()).toEqual([false, false, false, true, false]);

		settings.setPageVisible('matrix', true);
		await wrapper.vm.$nextTick();
		expect(disabled()).toEqual([false, false, false, false, false]);
	});

	it('ticks Tasks again when the last other page is unticked', async () => {
		const settings = useSettingsStore();
		for (const page of ['dreams', 'goals', 'groups', 'tasks'] as const) {
			settings.setPageVisible(page, false);
		}
		const wrapper = mountPage();

		await checkboxes(wrapper)[4].vm.$emit('update:modelValue', false);

		expect(checkboxes(wrapper).map((box) => box.props('modelValue'))).toEqual([
			false,
			false,
			false,
			true,
			false,
		]);
	});

	it('switches a page off through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		await checkboxes(wrapper)[1].vm.$emit('update:modelValue', false);

		expect(settings.general.pages).toEqual({
			tasks: true,
			matrix: true,
			dreams: true,
			goals: false,
			groups: true,
		});
	});

	it('offers no hidden page as the start page', () => {
		const settings = useSettingsStore();
		settings.setPageVisible('dreams', false);
		settings.setPageVisible('groups', false);
		const wrapper = mountPage();

		const [startPageSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		const values = (startPageSelect.props('items') as Array<{ value: string }>).map(
			(item) => item.value,
		);

		expect(values).toEqual(['tasks', 'matrix', 'goals']);
	});

	it('hands the start page back to Tasks when its page is switched off', async () => {
		const settings = useSettingsStore();
		settings.setStartPage('groups');
		const wrapper = mountPage();

		await checkboxes(wrapper)[2].vm.$emit('update:modelValue', false);

		expect(settings.general.startPage).toBe('tasks');
	});

	it("leaves out a hidden page's own block, and keeps its values", async () => {
		const settings = useSettingsStore();
		settings.updatePageSettings('dreams', { confirmDone: true });
		settings.setPageVisible('dreams', false);
		settings.setPageVisible('groups', false);
		settings.setPageVisible('tasks', false);
		const wrapper = mountPage();

		// Goals alone is left: its rows toggle and its two switches.
		expect(wrapper.findAllComponents({ name: 'VBtnToggle' })).toHaveLength(1);
		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(2);
		expect(settings.dreams.confirmDone).toBe(true);
	});
});

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

	it('warns that shortening the window deletes older items sooner', () => {
		const wrapper = mountPage();

		const [, cleanupSelect] = wrapper.findAllComponents({ name: 'VSelect' });

		expect(cleanupSelect.props('hint')).toBe(
			'Shortening this deletes older closed items and completion history sooner.',
		);
		expect(wrapper.text()).toContain(
			'Shortening this deletes older closed items and completion history sooner.',
		);
	});
});

describe('SettingsPage per-entity sections', () => {
	it('shows one section per entity with two switches, and a rows toggle for all but groups', () => {
		const wrapper = mountPage();

		expect(wrapper.text()).toContain('Groups');
		expect(wrapper.findAllComponents({ name: 'VBtnToggle' })).toHaveLength(3);
		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(8);
	});

	it('changes the groups confirm switches without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		// dreams, goals, groups, tasks -- two switches each.
		const switches = wrapper.findAllComponents({ name: 'VSwitch' });
		await switches[4].vm.$emit('update:modelValue', true);
		await switches[5].vm.$emit('update:modelValue', true);

		expect(settings.groups.confirmDone).toBe(true);
		expect(settings.groups.confirmReopen).toBe(true);
		expect(settings.goals.confirmDone).toBe(false);
		expect(settings.tasks.confirmDone).toBe(false);
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

	it('clamps an out-of-range rows value to 1 instead of storing it as-is', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [dreamsRows] = wrapper.findAllComponents({ name: 'VBtnToggle' });
		await dreamsRows.vm.$emit('update:modelValue', undefined);

		expect(settings.dreams.rows).toBe(1);
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
