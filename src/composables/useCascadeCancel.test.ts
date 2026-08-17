// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useCascadeCancel } from './useCascadeCancel';

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
	setActivePinia(createPinia());
});

describe('useCascadeCancel counting', () => {
	it('counts zero when a goal has no active tasks', async () => {
		const tasks = useTasksStore();
		await tasks.load(async () => new EntityMemoryRepository<Task>());
		const cascade = useCascadeCancel();

		expect(cascade.countGoalTasks('goal-1')).toBe(0);
	});

	it('counts only active tasks under a goal, not closed ones or another goal\'s', async () => {
		const tasks = useTasksStore();
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1' }),
					makeTask({ id: 'b', goalId: 'goal-1' }),
					makeTask({ id: 'c', goalId: 'goal-1', status: Status.Done }),
					makeTask({ id: 'd', goalId: 'other-goal' }),
				]),
		);
		const cascade = useCascadeCancel();

		expect(cascade.countGoalTasks('goal-1')).toBe(2);
	});

	it('counts active goals under a dream and their active tasks transitively', async () => {
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await goals.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'g1', dreamId: 'dream-1' }),
					makeGoal({ id: 'g2', dreamId: 'dream-1' }),
					makeGoal({ id: 'g3', dreamId: 'dream-1', status: Status.Done }),
					makeGoal({ id: 'g4', dreamId: 'other-dream' }),
				]),
		);
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 't1', goalId: 'g1' }),
					makeTask({ id: 't2', goalId: 'g2' }),
					makeTask({ id: 't3', goalId: 'g2', status: Status.Cancelled }),
					makeTask({ id: 't4', goalId: 'g3' }), // under a closed goal -- must not count
				]),
		);
		const cascade = useCascadeCancel();

		expect(cascade.countDreamDescendants('dream-1')).toEqual({ goals: 2, tasks: 2 });
	});
});

describe('useCascadeCancel execution', () => {
	it('cancelGoalTasks cancels every active task under the goal and leaves the rest alone', async () => {
		const tasks = useTasksStore();
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1' }),
					makeTask({ id: 'b', goalId: 'goal-1', status: Status.Done }),
					makeTask({ id: 'c', goalId: 'other-goal' }),
				]),
		);
		const cascade = useCascadeCancel();

		await cascade.cancelGoalTasks('goal-1');

		expect(tasks.records.find((t) => t.id === 'a')?.status).toBe(Status.Cancelled);
		expect(tasks.records.find((t) => t.id === 'b')?.status).toBe(Status.Done);
		expect(tasks.records.find((t) => t.id === 'c')?.status).toBe(Status.Opened);
	});

	it('cancelDreamGoals cancels every active goal under the dream and their active tasks', async () => {
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await goals.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'g1', dreamId: 'dream-1' }),
					makeGoal({ id: 'g2', dreamId: 'dream-1', status: Status.Cancelled }),
					makeGoal({ id: 'g3', dreamId: 'other-dream' }),
				]),
		);
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 't1', goalId: 'g1' }),
					makeTask({ id: 't2', goalId: 'g2' }), // under an already-cancelled goal
				]),
		);
		const cascade = useCascadeCancel();

		await cascade.cancelDreamGoals('dream-1');

		expect(goals.records.find((g) => g.id === 'g1')?.status).toBe(Status.Cancelled);
		expect(goals.records.find((g) => g.id === 'g2')?.status).toBe(Status.Cancelled); // untouched, already cancelled
		expect(goals.records.find((g) => g.id === 'g3')?.status).toBe(Status.Opened);
		expect(tasks.records.find((t) => t.id === 't1')?.status).toBe(Status.Cancelled);
		expect(tasks.records.find((t) => t.id === 't2')?.status).toBe(Status.Opened); // g2's branch was never processed
	});
});
