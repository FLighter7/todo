// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive, reactive } from 'vue';
import { Status, type Dream, type Schedule, type Task } from '@/types';
import { StorageUnavailableError, type EntityStorage } from '@/repositories/EntityStorage';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { defineEntityStore } from './createEntityStore';
import { useStorageStore } from './storage';

interface DreamDraft {
	name: string;
	note?: string;
}

const useTestStore = defineEntityStore<Dream, DreamDraft>({
	id: 'test-dreams',
	createRepository: async () => new EntityMemoryRepository<Dream>(),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
	}),
});

interface TaskDraft {
	name: string;
	schedule?: Schedule;
}

const useTestTaskStore = defineEntityStore<Task, TaskDraft>({
	id: 'test-tasks',
	createRepository: async () => new EntityMemoryRepository<Task>(),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		created: now,
		updated: now,
		status: Status.Opened,
		important: false,
		urgent: false,
		// Straight passthrough, same as the real tasks.ts build(): a draft's
		// schedule reaches the record exactly as the caller handed it in.
		schedule: draft.schedule ?? { start: '2026-08-06T10:00' },
		completions: [{ occurrence: '2026-08-06T10:00', done: true, at: now }],
	}),
});

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'seeded',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'seeded-task',
		name: 'Water the plants',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		schedule: { start: '2026-08-06T10:00' },
		completions: [{ occurrence: '2026-08-06T10:00', done: true, at: '2026-08-06T10:00:00.000Z' }],
		...overrides,
	};
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('defineEntityStore load', () => {
	it('loads existing records from storage', async () => {
		const store = useTestStore();

		await store.load(async () => new EntityMemoryRepository([makeDream()]));

		expect(store.records).toHaveLength(1);
		expect(store.loading).toBe(false);
		expect(useStorageStore().persistent).toBe(true);
	});

	it('falls back to memory when storage is unavailable', async () => {
		const store = useTestStore();

		await store.load(async () => {
			throw new StorageUnavailableError();
		});

		expect(useStorageStore().persistent).toBe(false);
		expect(store.records).toEqual([]);
	});

	it('collects closed records past the window on load', async () => {
		const storage = new EntityMemoryRepository([
			makeDream({ id: 'open' }),
			makeDream({ id: 'stale', status: Status.Done, updated: daysAgo(400) }),
		]);
		const store = useTestStore();

		await store.load(async () => storage);

		expect(store.records.map((r) => r.id)).toEqual(['open']);
		await expect(storage.getAll()).resolves.toHaveLength(1);
	});
});

describe('defineEntityStore active and closed', () => {
	it('splits records by status', async () => {
		const store = useTestStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeDream({ id: 'a' }),
					makeDream({ id: 'b', status: Status.Done }),
					makeDream({ id: 'c', status: Status.Cancelled }),
				]),
		);

		expect(store.active.map((r) => r.id)).toEqual(['a']);
		expect(store.closed.map((r) => r.id)).toEqual(['b', 'c']);
	});
});

describe('defineEntityStore mutations', () => {
	it('adds a record with a generated id and matching timestamps', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository<Dream>());

		const created = await store.add({ name: 'Learn to sail' });

		expect(created.id).not.toBe('');
		expect(created.created).toBe(created.updated);
		expect(created.status).toBe(Status.Opened);
		expect(store.records).toHaveLength(1);
	});

	it('writes an added record through to storage', async () => {
		const storage = new EntityMemoryRepository<Dream>();
		const store = useTestStore();
		await store.load(async () => storage);

		await store.add({ name: 'Learn to sail' });

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});

	it('updates a record and moves updated', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream()]));
		const before = store.records[0].updated;

		await store.update('seeded', { name: 'Renamed' });

		expect(store.records[0].name).toBe('Renamed');
		expect(Date.parse(store.records[0].updated)).toBeGreaterThan(Date.parse(before));
	});

	it('ignores an update for an unknown id', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream()]));

		await store.update('missing', { name: 'Renamed' });

		expect(store.records[0].name).toBe('Visit Japan');
	});

	it('closes a record as done and as cancelled', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream()]));

		await store.close('seeded', Status.Done);
		expect(store.records[0].status).toBe(Status.Done);

		await store.close('seeded', Status.Cancelled);
		expect(store.records[0].status).toBe(Status.Cancelled);
	});

	it('reopens a closed record', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream({ status: Status.Done })]));

		await store.reopen('seeded');

		expect(store.records[0].status).toBe(Status.Opened);
		expect(store.active).toHaveLength(1);
	});

	it('keeps a closed record in storage instead of erasing it', async () => {
		const storage = new EntityMemoryRepository([makeDream()]);
		const store = useTestStore();
		await store.load(async () => storage);

		await store.close('seeded', Status.Cancelled);

		const stored = await storage.getAll();
		expect(stored).toHaveLength(1);
		expect(stored[0].status).toBe(Status.Cancelled);
	});

	it('reports a write failure without losing the in-memory change', async () => {
		const failing: EntityStorage<Dream> = {
			async getAll() {
				return [];
			},
			async put() {
				throw new Error('quota exceeded');
			},
			async remove() {},
			async clear() {},
		};
		const store = useTestStore();
		await store.load(async () => failing);

		await store.add({ name: 'Learn to sail' });

		expect(useStorageStore().lastError).toBe('storage.writeFailed');
		expect(store.records).toHaveLength(1);
	});
});

describe('defineEntityStore replaceAll', () => {
	it('replaces the list in memory and in storage', async () => {
		const storage = new EntityMemoryRepository([makeDream({ id: 'old' })]);
		const store = useTestStore();
		await store.load(async () => storage);

		await store.replaceAll([makeDream({ id: 'new-1' }), makeDream({ id: 'new-2' })]);

		expect(store.records.map((r) => r.id)).toEqual(['new-1', 'new-2']);
		const stored = await storage.getAll();
		expect(stored.map((r) => r.id).sort()).toEqual(['new-1', 'new-2']);
	});

	it('can replace the list with nothing', async () => {
		const storage = new EntityMemoryRepository([makeDream()]);
		const store = useTestStore();
		await store.load(async () => storage);

		await store.replaceAll([]);

		expect(store.records).toEqual([]);
		await expect(storage.getAll()).resolves.toEqual([]);
	});
});

/**
 * Regression coverage for the `toRaw` correction: every test above uses
 * `Dream`, which has no nested fields, so it cannot detect a reactive proxy
 * leaking into storage. A `Task`'s `schedule` and `completions` can. These
 * tests capture the exact object handed to `EntityStorage.put` and assert
 * none of it — top level or nested — is still a Vue reactive proxy.
 */
describe('defineEntityStore reactive proxy regression', () => {
	function spyingStorage(seed: Task[]): { storage: EntityStorage<Task>; received: Task[] } {
		const received: Task[] = [];
		const storage: EntityStorage<Task> = {
			async getAll() {
				return seed;
			},
			async put(record) {
				received.push(record);
			},
			async remove() {},
			async clear() {},
		};

		return { storage, received };
	}

	it('writes a plain object to storage on update, not a reactive proxy', async () => {
		const { storage, received } = spyingStorage([makeTask()]);
		const store = useTestTaskStore();
		await store.load(async () => storage);

		await store.update('seeded-task', { name: 'Renamed' });

		expect(received).toHaveLength(1);
		const [record] = received;
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.completions)).toBe(false);
	});

	it('writes plain objects to storage on replaceAll, not reactive proxies', async () => {
		const { storage, received } = spyingStorage([]);
		const store = useTestTaskStore();
		await store.load(async () => storage);

		// A caller can hand replaceAll a list sourced from another reactive
		// store's `records` — e.g. a sync or restore path. `reactive()` here
		// stands in for that: a genuine Vue proxy, nested fields included.
		const incoming = reactive(makeTask({ id: 'replaced' })) as Task;

		await store.replaceAll([incoming]);

		expect(received).toHaveLength(1);
		const [record] = received;
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.completions)).toBe(false);
	});

	it('writes a plain object to storage on add, not a reactive proxy in a nested field', async () => {
		const { storage, received } = spyingStorage([]);
		const store = useTestTaskStore();
		await store.load(async () => storage);

		// A draft field bound to a Vuetify form is exactly this: a `reactive()`
		// object handed in as one field of an otherwise plain draft, not the
		// whole draft wrapped at once.
		const schedule = reactive<Schedule>({
			start: '2026-08-06T10:00',
			exdate: ['2026-08-07T10:00'],
		});

		await store.add({ name: 'Water the plants', schedule });

		expect(received).toHaveLength(1);
		const [record] = received;
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.schedule?.exdate)).toBe(false);
	});

	it('writes a plain object to storage on update when only a nested field is reactive', async () => {
		// Unlike the replaceAll case above, the record itself is a plain
		// object here — only `schedule` carries a live proxy into
		// records.value. This is the transitive gap: toRaw() on the record
		// unwraps the top level fine, but the reference it hands back for
		// `schedule` is still the original proxy, untouched.
		const nestedSchedule = reactive<Schedule>({
			start: '2026-08-06T10:00',
			exdate: ['2026-08-07T10:00'],
		});
		const seeded: Task = { ...makeTask(), schedule: nestedSchedule };
		const { storage, received } = spyingStorage([seeded]);
		const store = useTestTaskStore();
		await store.load(async () => storage);

		await store.update('seeded-task', { name: 'Renamed' });

		expect(received).toHaveLength(1);
		const [record] = received;
		expect(isReactive(record)).toBe(false);
		expect(isReactive(record.schedule)).toBe(false);
		expect(isReactive(record.schedule?.exdate)).toBe(false);
	});
});

describe('defineEntityStore load skipped rows', () => {
	it('surfaces a load error when storage reports skipped rows', async () => {
		const storage: EntityStorage<Dream> = {
			async getAll() {
				return [];
			},
			async put() {},
			async remove() {},
			async clear() {},
			skipped: 2,
		};
		const store = useTestStore();

		await store.load(async () => storage);

		expect(useStorageStore().lastError).toBe('storage.recordsSkipped');
	});

	it('does not surface a load error when storage cannot report a skipped count', async () => {
		const store = useTestStore();

		await store.load(async () => new EntityMemoryRepository<Dream>());

		expect(useStorageStore().lastError).toBeNull();
	});

	it('does not surface a load error when the skipped count is zero', async () => {
		const storage: EntityStorage<Dream> = {
			async getAll() {
				return [];
			},
			async put() {},
			async remove() {},
			async clear() {},
			skipped: 0,
		};
		const store = useTestStore();

		await store.load(async () => storage);

		expect(useStorageStore().lastError).toBeNull();
	});
});
