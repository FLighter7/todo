// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText, setEntityTab } from '@/vitestHelpers';
import { Status, type Dream, type Goal, type Task } from '@/types';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
import GoalList from '../GoalList.vue';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'dream-1',
		name: 'Visit Japan',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		...overrides,
	};
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'Do Duolingo',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

async function mountWithData(dreams: Dream[], goals: Goal[], tasks: Task[] = []) {
	const dreamsStore = useDreamsStore();
	const goalsStore = useGoalsStore();
	const tasksStore = useTasksStore();
	await dreamsStore.load(async () => new ItemMemoryRepository(dreams));
	await goalsStore.load(async () => new ItemMemoryRepository(goals));
	await tasksStore.load(async () => new ItemMemoryRepository(tasks));

	const wrapper = mount(GoalList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, dreamsStore, goalsStore, tasksStore };
}

describe('GoalList empty state', () => {
	it('shows the empty message when there are no goals', async () => {
		const { wrapper } = await mountWithData([], []);

		expect(wrapper.text()).toContain('No goals yet.');
	});
});

describe('GoalList grouping', () => {
	it('groups a goal under its dream, using the dream name as the group label', async () => {
		const { wrapper } = await mountWithData([makeDream()], [makeGoal({ dreamId: 'dream-1' })]);

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
	});

	it('still groups and shows the dream name when the dream itself is closed', async () => {
		const { wrapper } = await mountWithData(
			[makeDream({ status: Status.Done })],
			[makeGoal({ dreamId: 'dream-1' })],
		);

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
	});

	it('puts a dreamless goal in the ungrouped tail, with no group wrapper', async () => {
		const { wrapper } = await mountWithData([], [makeGoal({ id: 'g1', name: 'Read more' })]);

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Read more');
	});
});

describe('GoalList dream picker options', () => {
	it('offers only active dreams as new choices', async () => {
		const { wrapper } = await mountWithData(
			[
				makeDream({ id: 'active-dream', name: 'Active dream' }),
				makeDream({ id: 'closed-dream', name: 'Closed dream', status: Status.Done }),
			],
			[makeGoal({ dreamId: 'active-dream' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toEqual(['No dream', 'Active dream']);
	});

	it('keeps the currently-linked closed dream as an option when editing that goal', async () => {
		const { wrapper } = await mountWithData(
			[makeDream({ id: 'closed-dream', name: 'Closed dream', status: Status.Cancelled })],
			[makeGoal({ dreamId: 'closed-dream' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-dream');
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toContain('Closed dream');
	});
});

describe('GoalList done / reopen', () => {
	it('reopens a cancelled goal from the History tab when its checkbox is checked, not marks it done', async () => {
		const { wrapper, goalsStore } = await mountWithData(
			[],
			[makeGoal({ status: Status.Cancelled })],
		);
		useSettingsStore().updatePageSettings('goals', { confirmReopen: false });

		await setEntityTab('history');
		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(goalsStore.records[0].status).toBe(Status.Opened);
	});
});

describe('GoalList cancel', () => {
	it('cancels immediately when the goal has no active tasks', async () => {
		const { wrapper, goalsStore } = await mountWithData([], [makeGoal()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(goalsStore.records[0].status).toBe(Status.Cancelled);
	});

	it('shows the cascade choice and cancels tasks when the whole branch is chosen', async () => {
		const { wrapper, goalsStore, tasksStore } = await mountWithData(
			[],
			[makeGoal()],
			[makeTask({ goalId: 'goal-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.text()).toContain('Cancel the whole branch');

		await clickButtonByText(wrapper, 'Cancel the whole branch');

		expect(goalsStore.records[0].status).toBe(Status.Cancelled);
		expect(tasksStore.records[0].status).toBe(Status.Cancelled);
	});
});

describe('GoalList tabs', () => {
	it('switches between Active and History', async () => {
		const { wrapper } = await mountWithData(
			[],
			[
				makeGoal({ id: 'open', name: 'Open goal' }),
				makeGoal({ id: 'done', name: 'Done goal', status: Status.Done }),
			],
		);

		expect(wrapper.text()).toContain('Open goal');
		expect(wrapper.text()).not.toContain('Done goal');

		await setEntityTab('history');

		expect(wrapper.text()).not.toContain('Open goal');
		expect(wrapper.text()).toContain('Done goal');
	});
});

describe('GoalList sorting', () => {
	function orderedTexts(wrapper: Awaited<ReturnType<typeof mountWithData>>['wrapper']): string[] {
		const elements = wrapper.element.querySelectorAll('legend, .v-list-item-title');
		return Array.from(elements).map((el) => (el as HTMLElement).textContent ?? '');
	}

	it('orders goals newest-first by default', async () => {
		const older = makeGoal({ id: 'older', name: 'Older goal', updated: daysAgo(10) });
		const newer = makeGoal({ id: 'newer', name: 'Newer goal', updated: daysAgo(1) });
		const { wrapper } = await mountWithData([], [older, newer]);

		expect(orderedTexts(wrapper)).toEqual(['Newer goal', 'Older goal']);
	});

	it('respects a stored "oldest" sortOrder', async () => {
		const older = makeGoal({ id: 'older', name: 'Older goal', updated: daysAgo(10) });
		const newer = makeGoal({ id: 'newer', name: 'Newer goal', updated: daysAgo(1) });
		const { wrapper } = await mountWithData([], [older, newer]);
		useSettingsStore().updatePageSettings('goals', { sortOrder: 'oldest' });
		await wrapper.vm.$nextTick();

		expect(orderedTexts(wrapper)).toEqual(['Older goal', 'Newer goal']);
	});

	it("lifts a goal's dream group above a newer ungrouped goal once a goal inside the group is updated", async () => {
		const dream = makeDream({ id: 'dream-1', name: 'Visit Japan' });
		const groupedGoal = makeGoal({
			id: 'grouped',
			name: 'Grouped goal',
			dreamId: 'dream-1',
			updated: daysAgo(50),
		});
		const freshUngrouped = makeGoal({
			id: 'ungrouped',
			name: 'Ungrouped goal',
			updated: daysAgo(5),
		});
		const { wrapper, goalsStore } = await mountWithData([dream], [groupedGoal, freshUngrouped]);

		const before = orderedTexts(wrapper);
		expect(before.indexOf('Ungrouped goal')).toBeLessThan(before.indexOf('Visit Japan'));

		await goalsStore.update('grouped', { name: 'Grouped goal' });
		await wrapper.vm.$nextTick();

		const after = orderedTexts(wrapper);
		expect(after.indexOf('Visit Japan')).toBeLessThan(after.indexOf('Ungrouped goal'));
	});
});

describe('GoalList deadline', () => {
	it('shows the formatted deadline next to the goal', async () => {
		const { wrapper } = await mountWithData([], [makeGoal({ deadline: { year: 2027 } })]);

		expect(wrapper.text()).toContain('2027');
	});

	it('preserves an existing deadline when an unrelated field is edited', async () => {
		const { wrapper, goalsStore } = await mountWithData(
			[],
			[makeGoal({ deadline: { year: 2027 } })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Learn Japanese (updated)');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(goalsStore.records[0].deadline).toEqual({ year: 2027 });
	});
});
