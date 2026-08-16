import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Dream } from '@/types';
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
