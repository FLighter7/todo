// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Goal, type Schedule, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
import TaskList from '../TaskList.vue';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'Do Duolingo',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

async function mountWithData(goals: Goal[], tasks: Task[]) {
	const goalsStore = useGoalsStore();
	const tasksStore = useTasksStore();
	await goalsStore.load(async () => new EntityMemoryRepository(goals));
	await tasksStore.load(async () => new EntityMemoryRepository(tasks));

	const wrapper = mount(TaskList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, goalsStore, tasksStore };
}

describe('TaskList empty state', () => {
	it('shows the empty message when there are no tasks', async () => {
		const { wrapper } = await mountWithData([], []);

		expect(wrapper.text()).toContain('No tasks yet');
	});
});

describe('TaskList grouping', () => {
	it('groups a task under its goal, using the goal name as the group label', async () => {
		const { wrapper } = await mountWithData([makeGoal()], [makeTask({ goalId: 'goal-1' })]);

		expect(wrapper.find('legend').text()).toBe('Learn Japanese');
		expect(wrapper.text()).toContain('Do Duolingo');
	});

	it('still groups and shows the goal name when the goal itself is closed', async () => {
		const { wrapper } = await mountWithData(
			[makeGoal({ status: Status.Done })],
			[makeTask({ goalId: 'goal-1' })],
		);

		expect(wrapper.find('legend').text()).toBe('Learn Japanese');
	});

	it('puts a goalless task in the ungrouped tail, with no group wrapper', async () => {
		const { wrapper } = await mountWithData([], [makeTask({ id: 't1', name: 'Read more' })]);

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Read more');
	});
});

describe('TaskList goal picker options', () => {
	it('offers only active goals as new choices', async () => {
		const { wrapper } = await mountWithData(
			[
				makeGoal({ id: 'active-goal', name: 'Active goal' }),
				makeGoal({ id: 'closed-goal', name: 'Closed goal', status: Status.Done }),
			],
			[makeTask({ goalId: 'active-goal' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toEqual(['No goal', 'Active goal']);
	});

	it('keeps the currently-linked closed goal as an option when editing that task', async () => {
		const { wrapper } = await mountWithData(
			[makeGoal({ id: 'closed-goal', name: 'Closed goal', status: Status.Cancelled })],
			[makeTask({ goalId: 'closed-goal' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-goal');
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toContain('Closed goal');
	});
});

describe('TaskList cancel', () => {
	it('cancels immediately with no confirm dialog, since tasks have no descendants', async () => {
		const { wrapper, tasksStore } = await mountWithData([], [makeTask()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(tasksStore.records[0].status).toBe(Status.Cancelled);
	});
});

describe('TaskList done / reopen', () => {
	it('marks a task done immediately when confirmDone is off', async () => {
		const { wrapper, tasksStore } = await mountWithData([], [makeTask()]);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: false });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(tasksStore.records[0].status).toBe(Status.Done);
	});

	it('asks for confirmation before marking done when confirmDone is on', async () => {
		const { wrapper, tasksStore } = await mountWithData([], [makeTask()]);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(tasksStore.records[0].status).toBe(Status.Opened);

		await clickButtonByText(wrapper, 'Confirm');

		expect(tasksStore.records[0].status).toBe(Status.Done);
	});
});

describe('TaskList tabs', () => {
	it('switches between Active and History', async () => {
		const { wrapper } = await mountWithData(
			[],
			[
				makeTask({ id: 'open', name: 'Open task' }),
				makeTask({ id: 'done', name: 'Done task', status: Status.Done }),
			],
		);

		expect(wrapper.text()).toContain('Open task');
		expect(wrapper.text()).not.toContain('Done task');

		await clickButtonByText(wrapper, 'History');

		expect(wrapper.text()).not.toContain('Open task');
		expect(wrapper.text()).toContain('Done task');
	});
});

describe('TaskList schedule', () => {
	it('preserves an existing schedule when an unrelated field is edited', async () => {
		const schedule: Schedule = { start: '2026-08-21T09:00' };
		const { wrapper, tasksStore } = await mountWithData([], [makeTask({ schedule })]);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Do Duolingo (updated)');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(tasksStore.records[0].schedule).toEqual(schedule);
	});
});

describe('TaskList completions', () => {
	it('marking an occurrence done from the open dialog calls the store action and updates the dialog live', async () => {
		const schedule: Schedule = { start: '2020-01-03T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const { wrapper, tasksStore } = await mountWithData([], [makeTask({ schedule })]);

		await wrapper.get('.v-list-item').trigger('click');
		expect(wrapper.text()).not.toContain('time done');

		await wrapper.get('button[aria-label="Mark done"]').trigger('click');

		expect(tasksStore.records[0].completions).toHaveLength(1);
		expect(tasksStore.records[0].completions?.[0].done).toBe(true);
		expect(wrapper.text()).toContain('1 time done');
	});

	it('skipping an occurrence from the open dialog calls the store action', async () => {
		const schedule: Schedule = { start: '2020-01-03T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const { wrapper, tasksStore } = await mountWithData([], [makeTask({ schedule })]);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Skip"]').trigger('click');

		expect(tasksStore.records[0].schedule?.exdate).toHaveLength(1);
	});
});
