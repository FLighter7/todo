// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive, reactive } from 'vue';
import {
	ItemType,
	Status,
	type Dream,
	type Goal,
	type Group,
	type Item,
	type Schedule,
	type Task,
} from '@/types';
import { StorageUnavailableError, type ItemStorage } from '@/repositories/ItemStorage';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import { useItemsStore } from '../items';
import { useStorageStore } from '../storage';

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
		id: 'dream-1',
		name: 'Visit Japan',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		...overrides,
	};
}

function makeGroup(overrides: Partial<Group> = {}): Group {
	return {
		type: ItemType.Group,
		id: 'group-1',
		name: 'Errands',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		...overrides,
	};
}

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
		name: 'File the report',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

/**
 * Wraps a real `ItemMemoryRepository` so assertions can read back what the
 * store actually wrote (`getAll()` reflects it), while also recording every
 * record handed to `put` and `replaceAll` — the exact objects, to prove a
 * record was or was *not* rewritten and that nothing reactive reached storage.
 */
function spyingRepository(seed: Item[] = []): {
	storage: ItemStorage<Item>;
	put: Item[];
	replaced: Item[][];
} {
	const repo = new ItemMemoryRepository<Item>(seed);
	const put: Item[] = [];
	const replaced: Item[][] = [];
	const storage: ItemStorage<Item> = {
		getAll: () => repo.getAll(),
		put: async (record) => {
			put.push(record);
			await repo.put(record);
		},
		remove: (id) => repo.remove(id),
		clear: () => repo.clear(),
		replaceAll: async (records) => {
			replaced.push(records);
			await repo.replaceAll(records);
		},
	};

	return { storage, put, replaced };
}

function failingStorage(overrides: Partial<ItemStorage<Item>> = {}): ItemStorage<Item> {
	return {
		async getAll() {
			return [];
		},
		async put() {},
		async remove() {},
		async clear() {},
		async replaceAll() {},
		...overrides,
	};
}

async function loaded(seed: Item[] = []) {
	const store = useItemsStore();
	await store.load(async () => new ItemMemoryRepository<Item>(seed));
	return store;
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('useItemsStore load', () => {
	it('loads existing records from storage', async () => {
		const store = await loaded([makeDream()]);

		expect(store.records).toHaveLength(1);
		expect(store.loading).toBe(false);
		expect(useStorageStore().persistent).toBe(true);
	});

	it('keeps loading live across an unawaited load()', async () => {
		const store = useItemsStore();
		expect(store.loading).toBe(false);

		const pending = store.load(async () => new ItemMemoryRepository<Item>());
		expect(store.loading).toBe(true);

		await pending;
		expect(store.loading).toBe(false);
	});

	it('falls back to memory when storage is unavailable', async () => {
		const store = useItemsStore();

		await store.load(async () => {
			throw new StorageUnavailableError();
		});

		expect(useStorageStore().persistent).toBe(false);
		expect(store.records).toEqual([]);
	});

	it('collects closed records of every type past the window on load', async () => {
		const storage = new ItemMemoryRepository<Item>([
			makeDream({ id: 'open-dream' }),
			makeDream({ id: 'stale-dream', status: Status.Done, updated: daysAgo(400) }),
			makeGoal({ id: 'stale-goal', status: Status.Cancelled, updated: daysAgo(400) }),
			makeTask({ id: 'stale-task', status: Status.Done, updated: daysAgo(400) }),
			makeTask({ id: 'fresh-task', status: Status.Done, updated: daysAgo(1) }),
		]);
		const store = useItemsStore();

		await store.load(async () => storage);

		expect(store.records.map((r) => r.id).sort()).toEqual(['fresh-task', 'open-dream']);
		await expect(storage.getAll()).resolves.toHaveLength(2);
	});
});

describe('useItemsStore load pruning', () => {
	it('drops a completion past the prune window and keeps a recent one', async () => {
		const task = makeTask({
			completions: [
				{ occurrence: daysAgo(400), done: true, at: daysAgo(400) },
				{ occurrence: daysAgo(1), done: true, at: daysAgo(1) },
			],
		});
		const store = await loaded([task]);

		expect(store.tasks.all[0].completions).toHaveLength(1);
		expect(store.tasks.all[0].completions?.[0].occurrence).toBe(task.completions![1].occurrence);
	});

	it('writes the pruned record back to storage, not just the in-memory store', async () => {
		const task = makeTask({
			completions: [
				{ occurrence: daysAgo(400), done: true, at: daysAgo(400) },
				{ occurrence: daysAgo(1), done: true, at: daysAgo(1) },
			],
		});
		const { storage, put } = spyingRepository([task]);
		const store = useItemsStore();

		await store.load(async () => storage);

		expect(put.map((record) => record.id)).toEqual(['task-1']);
		const [stored] = (await storage.getAll()) as Task[];
		expect(stored.completions).toHaveLength(1);
	});

	it('does not move updated when pruning completions on load', async () => {
		const task = makeTask({
			updated: daysAgo(200),
			completions: [{ occurrence: daysAgo(400), done: true, at: daysAgo(400) }],
		});
		const store = await loaded([task]);

		expect(store.records[0].updated).toBe(task.updated);
	});

	it('does not rewrite a task to storage when none of its completions are pruned', async () => {
		const task = makeTask({
			completions: [{ occurrence: daysAgo(1), done: true, at: daysAgo(1) }],
		});
		const { storage, put } = spyingRepository([task]);
		const store = useItemsStore();

		await store.load(async () => storage);

		expect(put).toEqual([]);
	});

	it('drops a stale exdate entry on load, alongside completions pruning', async () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: [daysAgo(400), daysAgo(1)],
			},
		});
		const store = await loaded([task]);

		expect(store.tasks.all[0].schedule?.exdate).toEqual([task.schedule!.exdate![1]]);
	});

	it('does not rewrite a task to storage when neither completions nor exdate were pruned', async () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: [daysAgo(1)],
			},
		});
		const { storage, put } = spyingRepository([task]);
		const store = useItemsStore();

		await store.load(async () => storage);

		expect(put).toEqual([]);
	});

	it('rewrites only the tasks that pruning changed, never another type', async () => {
		const { storage, put } = spyingRepository([
			makeDream(),
			makeGoal(),
			makeTask({
				id: 'pruned',
				completions: [{ occurrence: daysAgo(400), done: true, at: daysAgo(400) }],
			}),
			makeTask({ id: 'untouched' }),
		]);
		const store = useItemsStore();

		await store.load(async () => storage);

		expect(put.map((record) => record.id)).toEqual(['pruned']);
	});
});

describe('useItemsStore load skipped rows', () => {
	it('surfaces a load error when storage reports skipped rows', async () => {
		const store = useItemsStore();

		await store.load(async () => ({ ...failingStorage(), skipped: 2 }));

		expect(useStorageStore().lastError).toBe('storage.recordsSkipped');
	});

	it('does not surface a load error when storage cannot report a skipped count', async () => {
		await loaded();

		expect(useStorageStore().lastError).toBeNull();
	});

	it('does not surface a load error when the skipped count is zero', async () => {
		const store = useItemsStore();

		await store.load(async () => ({ ...failingStorage(), skipped: 0 }));

		expect(useStorageStore().lastError).toBeNull();
	});
});

describe('useItemsStore views', () => {
	it('splits the collection by type, and each type by status', async () => {
		const store = await loaded([
			makeDream({ id: 'd-open' }),
			makeDream({ id: 'd-done', status: Status.Done }),
			makeGroup({ id: 'g-open' }),
			makeGoal({ id: 'goal-open' }),
			makeGoal({ id: 'goal-cancelled', status: Status.Cancelled }),
			makeTask({ id: 't-open' }),
			makeTask({ id: 't-done', status: Status.Done }),
		]);

		expect(store.dreams.active.map((r) => r.id)).toEqual(['d-open']);
		expect(store.dreams.closed.map((r) => r.id)).toEqual(['d-done']);
		expect(store.groups.all.map((r) => r.id)).toEqual(['g-open']);
		expect(store.goals.active.map((r) => r.id)).toEqual(['goal-open']);
		expect(store.goals.closed.map((r) => r.id)).toEqual(['goal-cancelled']);
		expect(store.tasks.active.map((r) => r.id)).toEqual(['t-open']);
		expect(store.tasks.closed.map((r) => r.id)).toEqual(['t-done']);
	});

	it('looks any record up by id through byId', async () => {
		const store = await loaded([makeDream(), makeTask()]);

		expect(store.byId.get('dream-1')?.type).toBe(ItemType.Dream);
		expect(store.byId.get('task-1')?.type).toBe(ItemType.Task);
		expect(store.byId.get('missing')).toBeUndefined();
	});

	it('keeps a view live after an add()', async () => {
		const store = await loaded();
		expect(store.tasks.active).toEqual([]);

		await store.add(ItemType.Task, { name: 'Ship the release', important: true, urgent: true });

		expect(store.tasks.active).toHaveLength(1);
	});
});

describe('useItemsStore quadrants', () => {
	it('exposes all four quadrants even when empty', async () => {
		const store = await loaded();

		expect(Object.keys(store.quadrants).sort()).toEqual([
			'delegate',
			'do',
			'eliminate',
			'schedule',
		]);
	});

	it('splits every open task into its quadrant, and nothing that is not a task', async () => {
		const store = await loaded([
			makeTask({ id: 'a', important: true, urgent: true }),
			makeTask({ id: 'b', important: true, urgent: false }),
			makeTask({ id: 'c', important: false, urgent: true }),
			makeTask({ id: 'd', important: false, urgent: false }),
			makeTask({ id: 'e', important: true, urgent: true }),
			makeGoal(),
			makeDream(),
		]);

		expect(store.quadrants.do.map((task) => task.id)).toEqual(['a', 'e']);
		expect(store.quadrants.schedule.map((task) => task.id)).toEqual(['b']);
		expect(store.quadrants.delegate.map((task) => task.id)).toEqual(['c']);
		expect(store.quadrants.eliminate.map((task) => task.id)).toEqual(['d']);
	});

	it('leaves closed tasks out of the matrix', async () => {
		const store = await loaded([
			makeTask({ id: 'open', important: true, urgent: true }),
			makeTask({ id: 'done', important: true, urgent: true, status: Status.Done }),
			makeTask({ id: 'gone', important: true, urgent: true, status: Status.Cancelled }),
		]);

		expect(store.quadrants.do.map((task) => task.id)).toEqual(['open']);
	});

	it('moves a task between quadrants when its flags change', async () => {
		const store = await loaded([makeTask({ id: 'a', important: false, urgent: false })]);

		await store.update(ItemType.Task, 'a', { important: true, urgent: true });

		expect(store.quadrants.eliminate).toEqual([]);
		expect(store.quadrants.do).toHaveLength(1);
	});
});

describe('useItemsStore sections', () => {
	it('puts a goalless task and a dreamless goal in the loose tail', async () => {
		const store = await loaded([makeTask({ id: 't' }), makeGoal({ id: 'g' })]);

		expect(store.tasksByGoal.active.sections).toEqual([]);
		expect(store.tasksByGoal.active.loose.map((t) => t.id)).toEqual(['t']);
		expect(store.goalsByDream.active.sections).toEqual([]);
		expect(store.goalsByDream.active.loose.map((g) => g.id)).toEqual(['g']);
	});

	it('gathers tasks under the same goal and goals under the same dream', async () => {
		const store = await loaded([
			makeTask({ id: 'a', goalId: 'goal-1' }),
			makeTask({ id: 'b', goalId: 'goal-1' }),
			makeTask({ id: 'c', goalId: 'goal-2' }),
			makeGoal({ id: 'x', dreamId: 'dream-1' }),
			makeGoal({ id: 'y', dreamId: 'dream-1' }),
		]);

		const taskSections = store.tasksByGoal.active.sections;
		expect(taskSections).toHaveLength(2);
		expect(taskSections.find((s) => s.parentId === 'goal-1')?.items.map((t) => t.id)).toEqual([
			'a',
			'b',
		]);
		expect(store.goalsByDream.active.sections).toEqual([
			{ parentId: 'dream-1', items: [store.byId.get('x'), store.byId.get('y')] },
		]);
	});

	it('sections by the link alone, even when the parent record is missing', async () => {
		const store = await loaded([makeTask({ id: 'a', goalId: 'gone-goal' })]);

		expect(store.tasksByGoal.active.sections).toEqual([
			{ parentId: 'gone-goal', items: [store.records[0]] },
		]);
	});

	it('sections active and closed records separately, for the Active and History tabs', async () => {
		const store = await loaded([
			makeTask({ id: 'a', goalId: 'goal-1', status: Status.Opened }),
			makeTask({ id: 'b', goalId: 'goal-1', status: Status.Done }),
			makeGoal({ id: 'x', dreamId: 'dream-1', status: Status.Opened }),
			makeGoal({ id: 'y', dreamId: 'dream-1', status: Status.Done }),
		]);

		expect(store.tasksByGoal.active.sections[0].items.map((t) => t.id)).toEqual(['a']);
		expect(store.tasksByGoal.closed.sections[0].items.map((t) => t.id)).toEqual(['b']);
		expect(store.goalsByDream.active.sections[0].items.map((g) => g.id)).toEqual(['x']);
		expect(store.goalsByDream.closed.sections[0].items.map((g) => g.id)).toEqual(['y']);
	});
});

describe('useItemsStore add', () => {
	it('adds a record with a generated id, matching timestamps and the given type', async () => {
		const store = await loaded();

		const created = await store.add(ItemType.Dream, { name: 'Learn to sail' });

		expect(created.id).not.toBe('');
		expect(created.type).toBe(ItemType.Dream);
		expect(created.created).toBe(created.updated);
		expect(created.status).toBe(Status.Opened);
		expect(store.records).toHaveLength(1);
	});

	it('builds each type from its own draft', async () => {
		const store = await loaded();

		const task = await store.add(ItemType.Task, {
			name: 'Ship the release',
			goalId: 'goal-1',
			groupId: 'group-1',
			important: true,
			urgent: true,
		});
		const group = await store.add(ItemType.Group, { name: 'Errands' });
		const goal = await store.add(ItemType.Goal, {
			name: 'Learn Japanese',
			dreamId: 'dream-1',
			deadline: { year: 2027 },
		});

		expect(task).toMatchObject({
			type: ItemType.Task,
			goalId: 'goal-1',
			groupId: 'group-1',
			important: true,
			urgent: true,
		});
		// A group carries a name only.
		expect(group).toEqual({
			id: group.id,
			type: ItemType.Group,
			name: 'Errands',
			created: group.created,
			updated: group.created,
			status: Status.Opened,
		});
		expect(goal).toMatchObject({
			type: ItemType.Goal,
			dreamId: 'dream-1',
			deadline: { year: 2027 },
		});
		expect(store.quadrants.do).toHaveLength(1);
	});

	it('writes an added record through to storage', async () => {
		const storage = new ItemMemoryRepository<Item>();
		const store = useItemsStore();
		await store.load(async () => storage);

		await store.add(ItemType.Dream, { name: 'Learn to sail' });

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});

	it('reports a write failure without losing the in-memory change', async () => {
		const store = useItemsStore();
		await store.load(async () =>
			failingStorage({
				async put() {
					throw new Error('quota exceeded');
				},
			}),
		);

		await store.add(ItemType.Dream, { name: 'Learn to sail' });

		expect(useStorageStore().lastError).toBe('storage.writeFailed');
		expect(store.records).toHaveLength(1);
	});
});

describe('useItemsStore update', () => {
	it('updates a record and moves updated', async () => {
		const store = await loaded([makeDream({ updated: daysAgo(2) })]);
		const before = store.records[0].updated;

		await store.update(ItemType.Dream, 'dream-1', { name: 'Renamed' });

		expect(store.records[0].name).toBe('Renamed');
		expect(Date.parse(store.records[0].updated)).toBeGreaterThan(Date.parse(before));
	});

	it('ignores an update for an unknown id', async () => {
		const store = await loaded([makeDream()]);

		await store.update(ItemType.Dream, 'missing', { name: 'Renamed' });

		expect(store.records[0].name).toBe('Visit Japan');
	});

	it('ignores an update naming another type than the record has', async () => {
		const store = await loaded([makeDream()]);
		const before = store.records[0];

		await store.update(ItemType.Task, 'dream-1', { name: 'Renamed', important: true });

		expect(store.records[0]).toBe(before);
	});

	it('never lets a patch change id, type or created', async () => {
		const store = await loaded([makeDream()]);
		const created = store.records[0].created;
		// A draft held in a variable escapes the excess-property check, so the
		// store has to hold the line at runtime too.
		const smuggled = {
			name: 'Renamed',
			id: 'other',
			type: ItemType.Task,
			created: daysAgo(50),
		} as unknown as { name: string };

		await store.update(ItemType.Dream, 'dream-1', smuggled);

		expect(store.records[0]).toMatchObject({
			id: 'dream-1',
			type: ItemType.Dream,
			name: 'Renamed',
			created,
		});
	});

	it('assigns a new records array rather than changing the old one', async () => {
		const store = await loaded([makeDream(), makeTask()]);
		const before = store.records;
		const untouched = store.records[1];

		await store.update(ItemType.Dream, 'dream-1', { name: 'Renamed' });

		expect(store.records).not.toBe(before);
		expect(before[0].name).toBe('Visit Japan');
		expect(store.records[1]).toBe(untouched);
	});
});

describe('useItemsStore close and reopen', () => {
	it('closes a record of any type as done and as cancelled', async () => {
		const store = await loaded([makeDream(), makeTask()]);

		await store.close('dream-1', Status.Done);
		await store.close('task-1', Status.Cancelled);

		expect(store.byId.get('dream-1')?.status).toBe(Status.Done);
		expect(store.byId.get('task-1')?.status).toBe(Status.Cancelled);
	});

	it('reopens a closed record', async () => {
		const store = await loaded([makeDream({ status: Status.Done })]);

		await store.reopen('dream-1');

		expect(store.records[0].status).toBe(Status.Opened);
		expect(store.dreams.active).toHaveLength(1);
	});

	it('keeps a closed record in storage instead of erasing it', async () => {
		const storage = new ItemMemoryRepository<Item>([makeDream()]);
		const store = useItemsStore();
		await store.load(async () => storage);

		await store.close('dream-1', Status.Cancelled);

		const stored = await storage.getAll();
		expect(stored).toHaveLength(1);
		expect(stored[0].status).toBe(Status.Cancelled);
	});
});

describe('useItemsStore replaceAll', () => {
	it('replaces the whole collection in memory and in storage, in one call', async () => {
		const { storage, replaced } = spyingRepository([makeDream({ id: 'old' })]);
		const store = useItemsStore();
		await store.load(async () => storage);

		await store.replaceAll([makeTask({ id: 'new-task' }), makeGoal({ id: 'new-goal' })]);

		expect(store.records.map((r) => r.id)).toEqual(['new-task', 'new-goal']);
		expect(replaced).toHaveLength(1);
		const stored = await storage.getAll();
		expect(stored.map((r) => r.id).sort()).toEqual(['new-goal', 'new-task']);
	});

	it('can replace the collection with nothing', async () => {
		const storage = new ItemMemoryRepository<Item>([makeDream()]);
		const store = useItemsStore();
		await store.load(async () => storage);

		await store.replaceAll([]);

		expect(store.records).toEqual([]);
		await expect(storage.getAll()).resolves.toEqual([]);
	});
});

/**
 * Regression coverage for the `toRaw` correction: a Dream has no nested
 * fields, so it cannot detect a reactive proxy leaking into storage. A Task's
 * `schedule` and `completions` can. These tests capture the exact objects
 * handed to storage and assert none of it — top level or nested — is still a
 * Vue reactive proxy.
 */
describe('useItemsStore reactive proxy regression', () => {
	// Recent enough that load() has nothing to prune, so the only write a test
	// sees is the one it caused.
	const yesterday = daysAgo(1).slice(0, 16);
	const scheduled = (): Task =>
		makeTask({
			schedule: { start: yesterday },
			completions: [{ occurrence: yesterday, done: true, at: daysAgo(1) }],
		});

	it('writes a plain object to storage on update, not a reactive proxy', async () => {
		const { storage, put } = spyingRepository([scheduled()]);
		const store = useItemsStore();
		await store.load(async () => storage);

		await store.update(ItemType.Task, 'task-1', { name: 'Renamed' });

		expect(put).toHaveLength(1);
		const [record] = put as Task[];
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.completions)).toBe(false);
	});

	it('writes plain objects to storage on replaceAll, not reactive proxies', async () => {
		const { storage, replaced } = spyingRepository();
		const store = useItemsStore();
		await store.load(async () => storage);

		// A caller can hand replaceAll a list read out of something reactive —
		// e.g. a sync or restore path. `reactive()` here stands in for that: a
		// genuine Vue proxy, nested fields included.
		const incoming = reactive(scheduled()) as Task;

		await store.replaceAll([incoming]);

		const [record] = replaced[0] as Task[];
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.completions)).toBe(false);
	});

	it('writes a plain object to storage on add, not a reactive proxy in a nested field', async () => {
		const { storage, put } = spyingRepository();
		const store = useItemsStore();
		await store.load(async () => storage);

		// A draft field bound to a Vuetify form is exactly this: a `reactive()`
		// object handed in as one field of an otherwise plain draft, not the
		// whole draft wrapped at once.
		const schedule = reactive<Schedule>({
			start: '2026-08-06T10:00',
			exdate: ['2026-08-07T10:00'],
		});

		await store.add(ItemType.Task, {
			name: 'Water the plants',
			important: false,
			urgent: false,
			schedule,
		});

		expect(put).toHaveLength(1);
		const [record] = put as Task[];
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.schedule?.exdate)).toBe(false);
	});

	it('keeps the in-memory record plain too, not tied to the form that handed it in', async () => {
		const store = await loaded([scheduled()]);
		const schedule = reactive<Schedule>({ start: '2026-08-06T10:00', exdate: [] });

		await store.update(ItemType.Task, 'task-1', { schedule });
		schedule.exdate!.push('2026-08-07T10:00');

		expect(isReactive(store.tasks.all[0].schedule)).toBe(false);
		expect(store.tasks.all[0].schedule?.exdate).toEqual([]);
	});
});

describe('useItemsStore setOccurrenceDone / setOccurrenceSkipped', () => {
	async function loadWithTask(overrides: Partial<Task> = {}) {
		return loaded([
			makeTask({
				schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3' },
				...overrides,
			}),
		]);
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

		const record = store.tasks.all[0];
		expect(record.completions).toEqual([
			expect.objectContaining({ occurrence: '2026-08-14T09:00', done: true }),
		]);
		expect(record.schedule?.exdate).toBeUndefined();
	});

	it('writes an explicit done: false completion, not a deletion, when unmarking', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', false);

		expect(store.tasks.all[0].completions).toEqual([
			expect.objectContaining({ occurrence: '2026-08-07T09:00', done: false }),
		]);
	});

	it('adds the occurrence to exdate and clears any completion when skipping', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		await store.setOccurrenceSkipped('task-1', '2026-08-07T09:00', true);

		const record = store.tasks.all[0];
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

		const record = store.tasks.all[0];
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
		const store = await loadWithTask({ status: Status.Cancelled, updated: daysAgo(1) });

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Cancelled);
	});

	it('moves updated once per call', async () => {
		const store = await loadWithTask({ updated: daysAgo(2) });
		const before = store.records[0].updated;

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		expect(store.records[0].updated).not.toBe(before);
	});

	it('does nothing for an id that is not a task', async () => {
		const store = await loaded([makeGoal()]);
		const before = store.records[0];

		await store.setOccurrenceDone('goal-1', '2026-08-07T09:00', true);

		expect(store.records[0]).toBe(before);
	});
});
