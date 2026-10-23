// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ItemType, Status, type Goal, type Task } from '@/types';
import { useItemsStore } from '@/stores/items';
import { loadItems } from '@/vitestHelpers';
import { useCascadeCancel } from '../useCascadeCancel';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		type: ItemType.Goal,
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
		type: ItemType.Task,
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
	setActivePinia(createPinia());
});

function statusOf(id: string): Status | undefined {
	return useItemsStore().byId.get(id)?.status;
}

describe('useCascadeCancel counting', () => {
	it('counts zero when a goal has no active tasks', async () => {
		await loadItems();
		const cascade = useCascadeCancel();

		expect(cascade.countGoalTasks('goal-1')).toBe(0);
	});

	it("counts only active tasks under a goal, not closed ones or another goal's", async () => {
		await loadItems([
			makeTask({ id: 'a', goalId: 'goal-1' }),
			makeTask({ id: 'b', goalId: 'goal-1' }),
			makeTask({ id: 'c', goalId: 'goal-1', status: Status.Done }),
			makeTask({ id: 'd', goalId: 'other-goal' }),
		]);
		const cascade = useCascadeCancel();

		expect(cascade.countGoalTasks('goal-1')).toBe(2);
	});

	it('counts active goals under a dream and their active tasks transitively', async () => {
		await loadItems([
			makeGoal({ id: 'g1', dreamId: 'dream-1' }),
			makeGoal({ id: 'g2', dreamId: 'dream-1' }),
			makeGoal({ id: 'g3', dreamId: 'dream-1', status: Status.Done }),
			makeGoal({ id: 'g4', dreamId: 'other-dream' }),
			makeTask({ id: 't1', goalId: 'g1' }),
			makeTask({ id: 't2', goalId: 'g2' }),
			makeTask({ id: 't3', goalId: 'g2', status: Status.Cancelled }),
			makeTask({ id: 't4', goalId: 'g3' }), // under a closed goal -- must not count
		]);
		const cascade = useCascadeCancel();

		expect(cascade.countDreamDescendants('dream-1')).toEqual({ goals: 2, tasks: 2 });
	});
});

describe('useCascadeCancel execution', () => {
	it('cancelGoalTasks cancels every active task under the goal and leaves the rest alone', async () => {
		await loadItems([
			makeTask({ id: 'a', goalId: 'goal-1' }),
			makeTask({ id: 'b', goalId: 'goal-1', status: Status.Done }),
			makeTask({ id: 'c', goalId: 'other-goal' }),
		]);
		const cascade = useCascadeCancel();

		await cascade.cancelGoalTasks('goal-1');

		expect(statusOf('a')).toBe(Status.Cancelled);
		expect(statusOf('b')).toBe(Status.Done);
		expect(statusOf('c')).toBe(Status.Opened);
	});

	it('cancelDreamGoals cancels every active goal under the dream and their active tasks', async () => {
		await loadItems([
			makeGoal({ id: 'g1', dreamId: 'dream-1' }),
			makeGoal({ id: 'g2', dreamId: 'dream-1', status: Status.Cancelled }),
			makeGoal({ id: 'g3', dreamId: 'other-dream' }),
			makeTask({ id: 't1', goalId: 'g1' }),
			makeTask({ id: 't2', goalId: 'g2' }), // under an already-cancelled goal
		]);
		const cascade = useCascadeCancel();

		await cascade.cancelDreamGoals('dream-1');

		expect(statusOf('g1')).toBe(Status.Cancelled);
		expect(statusOf('g2')).toBe(Status.Cancelled); // untouched, already cancelled
		expect(statusOf('g3')).toBe(Status.Opened);
		expect(statusOf('t1')).toBe(Status.Cancelled);
		expect(statusOf('t2')).toBe(Status.Opened); // g2's branch was never processed
	});
});
