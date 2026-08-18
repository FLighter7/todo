// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import AddEntityDialog from './AddEntityDialog.vue';

const dreamOptions = [{ value: 'dream-1', title: 'Visit Japan' }];
const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];

function mountDialog(defaultTab: 'dream' | 'goal' | 'task' = 'task') {
	return mount(AddEntityDialog, {
		props: { modelValue: true, defaultTab, dreamOptions, goalOptions },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('AddEntityDialog default tab', () => {
	it('starts on the tab passed in as defaultTab', () => {
		const wrapper = mountDialog('goal');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('goal');
	});
});

describe('AddEntityDialog saving a dream', () => {
	it('emits save-dream with a trimmed draft and closes', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('  Visit Japan  ');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-dream')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the dream name is empty', async () => {
		const wrapper = mountDialog('dream');

		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-dream')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('AddEntityDialog saving a goal', () => {
	it('emits save-goal with the picked dream', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('emits save-goal with a deadline when one is set', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: { year: 2027 } }],
		]);
	});
});

describe('AddEntityDialog saving a task', () => {
	it('emits save-task with flags and the picked goal', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Do Duolingo');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-task')).toEqual([
			[{ name: 'Do Duolingo', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
	});
});

describe('AddEntityDialog tab switching', () => {
	it("preserves a tab's typed name after switching away and back", async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');

		await clickButtonByText(wrapper, 'Task');
		await clickButtonByText(wrapper, 'Dream');

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Visit Japan');
	});

	it("validates only the active tab's name", async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');
		await clickButtonByText(wrapper, 'Task');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.text()).toContain('Name is required');
		expect(wrapper.emitted('save-task')).toBeUndefined();
	});
});
