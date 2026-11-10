import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { ItemType, Status, type Dream, type Item, type Task } from '@/types';
import { StorageUnavailableError } from '../ItemStorage';
import { APP_DB_NAME, APP_DB_VERSION } from '../AppDatabase';
import { ItemDbRepository } from '../ItemDbRepository';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
		id: 'id-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		...makeDream(),
		type: ItemType.Task,
		id: 'task-1',
		important: false,
		urgent: false,
		...overrides,
	};
}

afterEach(async () => {
	await deleteDB(APP_DB_NAME);
});

describe('ItemDbRepository', () => {
	it('starts empty', async () => {
		const repository = await ItemDbRepository.create();

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('persists a record across separate connections', async () => {
		const first = await ItemDbRepository.create();
		await first.put(makeDream());

		const second = await ItemDbRepository.create();

		await expect(second.getAll()).resolves.toEqual([makeDream()]);
	});

	it('keeps records of every type side by side, each read back as its own type', async () => {
		const repository = await ItemDbRepository.create();

		await repository.put(makeDream());
		await repository.put(makeTask({ goalId: 'goal-1' }));

		const all = await repository.getAll();
		expect(all.map((item) => item.type).sort()).toEqual([ItemType.Task, ItemType.Dream]);
		expect(all.find((item) => item.id === 'task-1')).toMatchObject({ goalId: 'goal-1' });
	});

	it('replaces a record with the same id', async () => {
		const repository = await ItemDbRepository.create();

		await repository.put(makeDream());
		await repository.put(makeDream({ status: Status.Done }));

		const all = await repository.getAll();
		expect(all).toHaveLength(1);
		expect(all[0].status).toBe(Status.Done);
	});

	it('removes a record and clears the store', async () => {
		const repository = await ItemDbRepository.create();
		await repository.put(makeDream());
		await repository.put(makeDream({ id: 'id-2' }));

		await repository.remove('id-1');
		await expect(repository.getAll()).resolves.toHaveLength(1);

		await repository.clear();
		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('replaceAll swaps the whole contents for the given list', async () => {
		const repository = await ItemDbRepository.create();
		await repository.put(makeDream());

		await repository.replaceAll([makeTask(), makeDream({ id: 'id-2' })]);

		const ids = (await repository.getAll()).map((item) => item.id).sort();
		expect(ids).toEqual(['id-2', 'task-1']);
	});

	it('replaceAll leaves the old contents in place when one record cannot be stored', async () => {
		const repository = await ItemDbRepository.create();
		await repository.put(makeDream());

		// A function cannot be structured-cloned: the write fails part of the
		// way through, after the clear has already been queued.
		const unstorable = { ...makeDream({ id: 'id-2' }), oops: () => undefined } as unknown as Item;

		await expect(repository.replaceAll([makeTask(), unstorable])).rejects.toThrow();
		await expect(repository.getAll()).resolves.toEqual([makeDream()]);
	});

	it('skips and counts a row it cannot parse instead of failing the load', async () => {
		const repository = await ItemDbRepository.create();
		await repository.put(makeDream());

		// Write a broken row behind the repository's back, the way a future
		// schema change or a corrupted profile would.
		const raw = await openDB(APP_DB_NAME, APP_DB_VERSION);
		await raw.put('items', { id: 'broken', status: 99 } as never);
		raw.close();

		const loaded = await repository.getAll();

		expect(loaded).toHaveLength(1);
		expect(loaded[0].id).toBe('id-1');
		expect(repository.skipped).toBe(1);
	});

	it('skips a row whose type this version does not know', async () => {
		const repository = await ItemDbRepository.create();
		await repository.put(makeDream());

		const raw = await openDB(APP_DB_NAME, APP_DB_VERSION);
		await raw.put('items', { ...makeDream({ id: 'future' }), type: 9 } as never);
		raw.close();

		const loaded = await repository.getAll();

		expect(loaded.map((item) => item.id)).toEqual(['id-1']);
		expect(repository.skipped).toBe(1);
	});

	it('resets the skipped count on each load', async () => {
		const repository = await ItemDbRepository.create();
		await repository.put(makeDream());

		const raw = await openDB(APP_DB_NAME, APP_DB_VERSION);
		await raw.put('items', { id: 'broken', status: 99 } as never);
		raw.close();

		await repository.getAll();
		expect(repository.skipped).toBe(1);

		// Remove the broken row directly — `remove` needs no parsing — so the
		// next load has only valid rows and the count must drop back to zero.
		await repository.remove('broken');

		await repository.getAll();
		expect(repository.skipped).toBe(0);
	});

	it('propagates an error from parse that is not an ItemFormatError', async () => {
		const failingParse = (): Item => {
			throw new TypeError('boom');
		};
		const repository = await ItemDbRepository.create(failingParse);

		const raw = await openDB(APP_DB_NAME, APP_DB_VERSION);
		await raw.put('items', makeDream());
		raw.close();

		await expect(repository.getAll()).rejects.toThrow(TypeError);
	});

	it('drops the per-type stores of version 3, records and all, leaving only items', async () => {
		await deleteDB(APP_DB_NAME);
		const old = await openDB(APP_DB_NAME, 3, {
			upgrade(db) {
				for (const name of ['dreams', 'goals', 'tasks']) {
					db.createObjectStore(name, { keyPath: 'id' });
				}
			},
		});
		await old.put('dreams', { id: 'old-dream', name: 'Old', status: Status.Opened });
		old.close();

		const repository = await ItemDbRepository.create();

		await expect(repository.getAll()).resolves.toEqual([]);
		const raw = await openDB(APP_DB_NAME, APP_DB_VERSION);
		expect([...raw.objectStoreNames]).toEqual(['items']);
		raw.close();
	});

	it('drops a leftover todos store from an even older schema', async () => {
		await deleteDB(APP_DB_NAME);
		const old = await openDB(APP_DB_NAME, 2, {
			upgrade(db) {
				db.createObjectStore('todos', { keyPath: 'id' });
			},
		});
		old.close();

		await ItemDbRepository.create();

		const raw = await openDB(APP_DB_NAME, APP_DB_VERSION);
		expect([...raw.objectStoreNames]).toEqual(['items']);
		raw.close();
	});

	it('throws StorageUnavailableError when indexedDB is missing', async () => {
		const original = globalThis.indexedDB;
		// @ts-expect-error deliberately removing the global to simulate a browser without IndexedDB
		delete globalThis.indexedDB;

		try {
			await expect(ItemDbRepository.create()).rejects.toBeInstanceOf(StorageUnavailableError);
		} finally {
			globalThis.indexedDB = original;
		}
	});
});
