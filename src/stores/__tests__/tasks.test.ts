// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Task } from '@/types';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import type { ItemStorage } from '@/repositories/ItemStorage';
import { useTasksStore } from '../tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'File the report',
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

/**
 * Wraps a real `ItemMemoryRepository` so assertions can read back what
 * `load()` actually wrote (`getAll()` reflects it), while also recording
 * which ids were ever handed to `put`, to prove a record was *not* rewritten.
 */
function spyingRepository(seed: Task[]): { storage: ItemStorage<Task>; putIds: string[] } {
	const repo = new ItemMemoryRepository<Task>(seed);
	const putIds: string[] = [];
	const storage: ItemStorage<Task> = {
		getAll: () => repo.getAll(),
		put: async (record) => {
			putIds.push(record.id);
			await repo.put(record);
		},
		remove: (id) => repo.remove(id),
		clear: () => repo.clear(),
	};

	return { storage, putIds };
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('useTasksStore quadrants', () => {
	it('exposes all four quadrants even when empty', async () => {
		const store = useTasksStore();
		await store.load(async () => new ItemMemoryRepository<Task>());

		expect(Object.keys(store.quadrants).sort()).toEqual([
			'delegate',
			'do',
			'eliminate',
			'schedule',
		]);
	});

	it('groups every open task into its quadrant', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([
					makeTask({ id: 'a', important: true, urgent: true }),
					makeTask({ id: 'b', important: true, urgent: false }),
					makeTask({ id: 'c', important: false, urgent: true }),
					makeTask({ id: 'd', important: false, urgent: false }),
					makeTask({ id: 'e', important: true, urgent: true }),
				]),
		);

		expect(store.quadrants.do.map((task) => task.id)).toEqual(['a', 'e']);
		expect(store.quadrants.schedule.map((task) => task.id)).toEqual(['b']);
		expect(store.quadrants.delegate.map((task) => task.id)).toEqual(['c']);
		expect(store.quadrants.eliminate.map((task) => task.id)).toEqual(['d']);
	});

	it('leaves closed tasks out of the matrix', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([
					makeTask({ id: 'open', important: true, urgent: true }),
					makeTask({ id: 'done', important: true, urgent: true, status: Status.Done }),
					makeTask({ id: 'gone', important: true, urgent: true, status: Status.Cancelled }),
				]),
		);

		expect(store.quadrants.do.map((task) => task.id)).toEqual(['open']);
	});

	it('moves a task between quadrants when its flags change', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([makeTask({ id: 'a', important: false, urgent: false })]),
		);

		await store.update('a', { important: true, urgent: true });

		expect(store.quadrants.eliminate).toEqual([]);
		expect(store.quadrants.do).toHaveLength(1);
	});

	it('builds a task from a draft with both flags', async () => {
		const store = useTasksStore();
		await store.load(async () => new ItemMemoryRepository<Task>());

		const created = await store.add({
			name: 'Ship the release',
			important: true,
			urgent: true,
		});

		expect(created.important).toBe(true);
		expect(created.urgent).toBe(true);
		expect(created.status).toBe(Status.Opened);
		expect(store.quadrants.do).toHaveLength(1);
	});
});

/**
 * `useTasksStore` composes `useBaseTasksStore` with `storeToRefs` rather
 * than a plain object spread, because a spread only copies each property's
 * value out once and nothing behind it stays connected to the source store
 * afterwards — see the comment on `useTasksStore` for why that bites both
 * scalars and arrays. These tests would pass against `quadrants` alone even
 * with a naive spread, since `quadrants` is a computed added directly in the
 * same setup call; they exist to catch a regression in the composition of
 * the *base* store's own state, which nothing above touches.
 */
describe('useTasksStore composition reactivity', () => {
	it('keeps loading live across an unawaited load()', async () => {
		const store = useTasksStore();
		expect(store.loading).toBe(false);

		const pending = store.load(async () => new ItemMemoryRepository<Task>());
		expect(store.loading).toBe(true);

		await pending;
		expect(store.loading).toBe(false);
	});

	it('keeps active live after an add()', async () => {
		const store = useTasksStore();
		await store.load(async () => new ItemMemoryRepository<Task>());
		expect(store.active).toEqual([]);

		await store.add({ name: 'Ship the release', important: true, urgent: true });

		expect(store.active).toHaveLength(1);
	});
});

/**
 * `createEntityStore.load()` calls the `prune` hook the task store supplies
 * on every kept record, right after the closed-record sweep, and rewrites to
 * storage only the records that hook actually changed. Without this, a
 * recurring task's `completions` grows without bound — the exact thing
 * `pruneCompletions` exists to prevent (see `src/utils/collectGarbage.ts`).
 */
describe('useTasksStore load pruning', () => {
	it('drops a completion past the prune window and keeps a recent one', async () => {
		const task = makeTask({
			completions: [
				{ occurrence: daysAgo(400), done: true, at: daysAgo(400) },
				{ occurrence: daysAgo(1), done: true, at: daysAgo(1) },
			],
		});
		const { storage } = spyingRepository([task]);
		const store = useTasksStore();

		await store.load(async () => storage);

		expect(store.records[0].completions).toHaveLength(1);
		expect(store.records[0].completions?.[0].occurrence).toBe(task.completions![1].occurrence);
	});

	it('writes the pruned record back to storage, not just the in-memory store', async () => {
		const task = makeTask({
			completions: [
				{ occurrence: daysAgo(400), done: true, at: daysAgo(400) },
				{ occurrence: daysAgo(1), done: true, at: daysAgo(1) },
			],
		});
		const { storage, putIds } = spyingRepository([task]);
		const store = useTasksStore();

		await store.load(async () => storage);

		expect(putIds).toEqual(['task-1']);
		const stored = await storage.getAll();
		expect(stored[0].completions).toHaveLength(1);
	});

	it('does not move updated when pruning completions on load', async () => {
		const task = makeTask({
			updated: daysAgo(200),
			completions: [{ occurrence: daysAgo(400), done: true, at: daysAgo(400) }],
		});
		const { storage } = spyingRepository([task]);
		const store = useTasksStore();

		await store.load(async () => storage);

		expect(store.records[0].updated).toBe(task.updated);
	});

	it('does not rewrite a task to storage when none of its completions are pruned', async () => {
		const task = makeTask({
			completions: [{ occurrence: daysAgo(1), done: true, at: daysAgo(1) }],
		});
		const { storage, putIds } = spyingRepository([task]);
		const store = useTasksStore();

		await store.load(async () => storage);

		expect(putIds).toEqual([]);
	});

	it('drops a stale exdate entry on load, alongside completions pruning', async () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: [daysAgo(400), daysAgo(1)],
			},
		});
		const { storage } = spyingRepository([task]);
		const store = useTasksStore();

		await store.load(async () => storage);

		expect(store.records[0].schedule?.exdate).toEqual([task.schedule!.exdate![1]]);
	});

	it('does not rewrite a task to storage when neither completions nor exdate were pruned', async () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: [daysAgo(1)],
			},
		});
		const { storage, putIds } = spyingRepository([task]);
		const store = useTasksStore();

		await store.load(async () => storage);

		expect(putIds).toEqual([]);
	});
});

describe('useTasksStore setOccurrenceDone / setOccurrenceSkipped', () => {
	async function loadWithTask(overrides: Partial<Task> = {}) {
		const task = makeTask({
			schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3' },
			...overrides,
		});
		const store = useTasksStore();
		await store.load(async () => new ItemMemoryRepository([task]));
		return store;
	}

	it('writes a done completion and clears any exdate entry for that occurrence', async () => {
		const store = await loadWithTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3',
				exdate: ['2026-08-14T09:00'],
			},
		});

		await store.setOccurrenceDone('task-1', '2026-08-14T09:00', true);

		const record = store.records[0];
		expect(record.completions).toEqual([
			expect.objectContaining({ occurrence: '2026-08-14T09:00', done: true }),
		]);
		expect(record.schedule?.exdate).toBeUndefined();
	});

	it('writes an explicit done: false completion, not a deletion, when unmarking', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', false);

		expect(store.records[0].completions).toEqual([
			expect.objectContaining({ occurrence: '2026-08-07T09:00', done: false }),
		]);
	});

	it('adds the occurrence to exdate and clears any completion when skipping', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		await store.setOccurrenceSkipped('task-1', '2026-08-07T09:00', true);

		const record = store.records[0];
		expect(record.schedule?.exdate).toEqual(['2026-08-07T09:00']);
		expect(record.completions).toEqual([]);
	});

	it('removes the occurrence from exdate when un-skipping, writing no completion', async () => {
		const store = await loadWithTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3',
				exdate: ['2026-08-07T09:00'],
			},
		});

		await store.setOccurrenceSkipped('task-1', '2026-08-07T09:00', false);

		const record = store.records[0];
		expect(record.schedule?.exdate).toBeUndefined();
		expect(record.completions ?? []).toEqual([]);
	});

	it('closes the task when the last occurrence of a bounded series is marked done', async () => {
		const store = await loadWithTask();

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Done);
	});

	it('reopens the task when the last occurrence is unmarked', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', false);

		expect(store.records[0].status).toBe(Status.Opened);
	});

	it('closes the task when the last occurrence is skipped', async () => {
		const store = await loadWithTask();

		await store.setOccurrenceSkipped('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Done);
	});

	it('does not touch status when a non-last occurrence is marked done', async () => {
		const store = await loadWithTask();

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		expect(store.records[0].status).toBe(Status.Opened);
	});

	it('never touches a Cancelled task, even on its last occurrence', async () => {
		const store = await loadWithTask({ status: Status.Cancelled });

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Cancelled);
	});

	it('moves updated once per call', async () => {
		const store = await loadWithTask({ updated: '2026-08-06T10:00:00.000Z' });

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		expect(store.records[0].updated).not.toBe('2026-08-06T10:00:00.000Z');
	});
});

describe('useTasksStore tasksByGoal', () => {
	it('puts a goalless task in the loose tail', async () => {
		const store = useTasksStore();
		await store.load(async () => new ItemMemoryRepository([makeTask({ id: 'a' })]));

		expect(store.tasksByGoal.active.sections).toEqual([]);
		expect(store.tasksByGoal.active.loose.map((t) => t.id)).toEqual(['a']);
	});

	it('groups multiple tasks under the same goal together', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1' }),
					makeTask({ id: 'b', goalId: 'goal-1' }),
					makeTask({ id: 'c', goalId: 'goal-2' }),
				]),
		);

		const groups = store.tasksByGoal.active.sections;
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.parentId === 'goal-1')?.items.map((t) => t.id)).toEqual(['a', 'b']);
		expect(groups.find((g) => g.parentId === 'goal-2')?.items.map((t) => t.id)).toEqual(['c']);
	});

	it('groups a task by goalId regardless of the goal record itself -- the getter never reads Goal data', async () => {
		const store = useTasksStore();
		await store.load(
			async () => new ItemMemoryRepository([makeTask({ id: 'a', goalId: 'closed-goal' })]),
		);

		expect(store.tasksByGoal.active.sections).toEqual([
			{ parentId: 'closed-goal', items: [store.records[0]] },
		]);
	});

	it('groups active and closed tasks separately, for the Active and History tabs', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1', status: Status.Opened }),
					makeTask({ id: 'b', goalId: 'goal-1', status: Status.Done }),
				]),
		);

		expect(store.tasksByGoal.active.sections[0].items.map((t) => t.id)).toEqual(['a']);
		expect(store.tasksByGoal.closed.sections[0].items.map((t) => t.id)).toEqual(['b']);
	});
});
