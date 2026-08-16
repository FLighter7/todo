import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import type { EntityStorage } from '@/repositories/EntityStorage';
import { QUADRANT_KEYS, quadrantFlags, quadrantOf, useTasksStore } from './tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'File the report',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
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
 * Wraps a real `EntityMemoryRepository` so assertions can read back what
 * `load()` actually wrote (`getAll()` reflects it), while also recording
 * which ids were ever handed to `put`, to prove a record was *not* rewritten.
 */
function spyingRepository(seed: Task[]): { storage: EntityStorage<Task>; putIds: string[] } {
	const repo = new EntityMemoryRepository<Task>(seed);
	const putIds: string[] = [];
	const storage: EntityStorage<Task> = {
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

describe('quadrantOf', () => {
	it('maps important and urgent to do', () => {
		expect(quadrantOf(makeTask({ important: true, urgent: true }))).toBe('do');
	});

	it('maps important and not urgent to schedule', () => {
		expect(quadrantOf(makeTask({ important: true, urgent: false }))).toBe('schedule');
	});

	it('maps not important and urgent to delegate', () => {
		expect(quadrantOf(makeTask({ important: false, urgent: true }))).toBe('delegate');
	});

	it('maps not important and not urgent to eliminate', () => {
		expect(quadrantOf(makeTask({ important: false, urgent: false }))).toBe('eliminate');
	});
});

describe('quadrantFlags', () => {
	it('is the inverse of quadrantOf for every quadrant', () => {
		for (const key of QUADRANT_KEYS) {
			expect(quadrantOf(makeTask(quadrantFlags(key)))).toBe(key);
		}
	});
});

describe('useTasksStore quadrants', () => {
	it('exposes all four quadrants even when empty', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository<Task>());

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
				new EntityMemoryRepository([
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
				new EntityMemoryRepository([
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
				new EntityMemoryRepository([makeTask({ id: 'a', important: false, urgent: false })]),
		);

		await store.update('a', { important: true, urgent: true });

		expect(store.quadrants.eliminate).toEqual([]);
		expect(store.quadrants.do).toHaveLength(1);
	});

	it('builds a task from a draft with both flags', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository<Task>());

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

		const pending = store.load(async () => new EntityMemoryRepository<Task>());
		expect(store.loading).toBe(true);

		await pending;
		expect(store.loading).toBe(false);
	});

	it('keeps active live after an add()', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository<Task>());
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
});
