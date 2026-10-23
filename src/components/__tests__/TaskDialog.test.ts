// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { ItemType, Status, type Task } from '@/types';
import { listOccurrences } from '@/utils/schedule';
import TaskCompletions from '../TaskCompletions.vue';
import TaskDialog from '../TaskDialog.vue';

const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		type: ItemType.Task,
		id: 'task-1',
		name: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

describe('TaskDialog add mode', () => {
	it('emits a draft including flags and the picked goal', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});

	it('emits goalId undefined when "no goal" stays selected', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: false, urgent: false, goalId: undefined }],
		]);
	});

	it('pre-flags the important switch from initialFlags when there is no record', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'add',
				initialFlags: { important: true, urgent: false },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		const checkboxes = wrapper.findAll('input[type="checkbox"]');
		expect((checkboxes[0].element as HTMLInputElement).checked).toBe(true);
		expect((checkboxes[1].element as HTMLInputElement).checked).toBe(false);
	});
});

describe('TaskDialog goal picker', () => {
	it('offers "no goal" plus every option passed in', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('items')).toEqual([
			{ value: '', title: 'No goal' },
			{ value: 'goal-1', title: 'Learn Japanese' },
		]);
	});

	it('preserves a closed goal that is present only because it is the current selection', async () => {
		const closedOptions = [{ value: 'closed-goal', title: 'Old goal' }];
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ goalId: 'closed-goal' }),
				goalOptions: closedOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-goal');
	});
});

describe('TaskDialog edit mode', () => {
	it('shows the linked goal name and important/urgent chips in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ important: true, goalId: 'goal-1' }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Important');
		expect(wrapper.text()).not.toContain('Urgent');
	});

	it('omits the important/urgent chips entirely when both flags are false', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'edit', record: makeTask(), goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent({ name: 'VChip' }).exists()).toBe(false);
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'edit', record: makeTask(), goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});

describe('TaskDialog schedule', () => {
	it('round-trips an existing one-time schedule back out unchanged', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ name: 'Water plants', schedule: { start: '2026-08-21T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
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

	it('emits schedule undefined after the schedule switch is turned off', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ name: 'Water plants', schedule: { start: '2026-08-21T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.findAll('input[type="checkbox"]')[2].setValue(false);
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[
				{
					name: 'Water plants',
					note: undefined,
					important: false,
					urgent: false,
					goalId: undefined,
					schedule: undefined,
				},
			],
		]);
	});

	it('shows the recurrence description in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					name: 'File the report',
					schedule: { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Every week, on Fri');
	});

	it('shows the formatted start time for a non-recurring schedule in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ name: 'Water plants', schedule: { start: '2026-08-21T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Aug 21, 2026');
	});
});

describe('TaskDialog completions', () => {
	it('shows the completions section for a periodic record', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent(TaskCompletions).exists()).toBe(true);
	});

	it('hides the completions section for a non-periodic record', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ schedule: { start: '2026-08-07T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent(TaskCompletions).exists()).toBe(false);
	});

	it('hides the completions section when there is no record', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent(TaskCompletions).exists()).toBe(false);
	});

	it("computes the occurrence window from the record's schedule and completions", () => {
		const schedule = { start: '2020-01-03T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const completions = [
			{ occurrence: '2020-01-03T09:00', done: true, at: '2020-01-03T10:00:00.000Z' },
		];
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ schedule, completions }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		const expected = listOccurrences(schedule, completions, new Date(), 5, 5);
		expect(wrapper.findComponent(TaskCompletions).props('occurrences')).toEqual(expected);
	});

	it('re-emits toggle-completion-done with the record id attached', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					id: 'task-9',
					schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.findComponent(TaskCompletions).vm.$emit('toggle-done', '2026-08-07T09:00', true);

		expect(wrapper.emitted('toggle-completion-done')).toEqual([
			['task-9', '2026-08-07T09:00', true],
		]);
	});

	it('re-emits toggle-completion-skip with the record id attached', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					id: 'task-9',
					schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.findComponent(TaskCompletions).vm.$emit('toggle-skip', '2026-08-07T09:00', true);

		expect(wrapper.emitted('toggle-completion-skip')).toEqual([
			['task-9', '2026-08-07T09:00', true],
		]);
	});

	it('re-seeds the draft schedule on entering edit mode, so a skip applied while reading survives a save', async () => {
		const schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const record = makeTask({ id: 'task-9', name: 'File the report', schedule });
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'edit', record, goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		// User skips an occurrence from the read view -- TaskDialog only
		// re-emits the toggle, it doesn't mutate anything itself.
		await wrapper.findComponent(TaskCompletions).vm.$emit('toggle-skip', '2026-08-07T09:00', true);

		// Simulate the store round-trip: `TaskList`'s live `editingTask` now
		// supplies a task whose `schedule` carries the freshly added exdate.
		const recordWithSkipApplied = makeTask({
			id: 'task-9',
			name: 'File the report',
			schedule: { ...schedule, exdate: ['2026-08-07T09:00'] },
		});
		await wrapper.setProps({ record: recordWithSkipApplied });

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('File the report (updated)');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		const emitted = wrapper.emitted('save');
		expect(emitted).toHaveLength(1);
		const [draft] = emitted![0] as [{ schedule?: { exdate?: string[] } }];
		expect(draft.schedule?.exdate).toEqual(['2026-08-07T09:00']);
	});
});
