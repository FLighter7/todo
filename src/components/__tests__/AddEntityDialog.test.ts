// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import AddEntityDialog from '../AddEntityDialog.vue';

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

function clickSave(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Save"]').trigger('click');
}

function clickSaveAndNew(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Save & New"]').trigger('click');
}

describe('AddEntityDialog saving a dream', () => {
	it('emits save-dream with a trimmed draft and closes', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('  Visit Japan  ');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-dream')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the dream name is empty', async () => {
		const wrapper = mountDialog('dream');

		await clickSave(wrapper);

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
		await clickSave(wrapper);

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('emits save-goal with a deadline when one is set', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');
		await clickSave(wrapper);

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
		await clickSave(wrapper);

		expect(wrapper.emitted('save-task')).toEqual([
			[{ name: 'Do Duolingo', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
	});

	it('emits save-task with a schedule when one is set', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Water plants');
		await wrapper.findAll('input[type="checkbox"]')[2].setValue(true); // has a schedule
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-task')).toEqual([
			[
				{
					name: 'Water plants',
					note: undefined,
					important: false,
					urgent: false,
					goalId: undefined,
					schedule: {
						start: '2026-08-21T09:00',
						tzid: undefined,
						duration: undefined,
						rrule: undefined,
					},
				},
			],
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
		await clickSave(wrapper);

		expect(wrapper.text()).toContain('Name is required');
		expect(wrapper.emitted('save-task')).toBeUndefined();
	});
});

describe('AddEntityDialog saving and starting a new one', () => {
	it('emits the save event without closing the dialog', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');
		await clickSaveAndNew(wrapper);

		expect(wrapper.emitted('save-dream')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('clears the name and note but keeps the other fields for the next entry', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('textarea').setValue('Start with hiragana');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await clickSaveAndNew(wrapper);

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');

		await wrapper.get('input').setValue('Pass JLPT N2');
		await clickSave(wrapper);

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: 'Start with hiragana', dreamId: 'dream-1' }],
			[{ name: 'Pass JLPT N2', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('blocks and shows an error when the name is empty, without clearing note', async () => {
		const wrapper = mountDialog('task');

		await clickSaveAndNew(wrapper);

		expect(wrapper.emitted('save-task')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});
