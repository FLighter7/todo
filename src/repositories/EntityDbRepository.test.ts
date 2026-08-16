import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { Status, parseDream, parseTask, type Dream, type Task } from '@/types';
import { StorageUnavailableError } from './EntityStorage';
import { APP_DB_NAME } from './AppDatabase';
import { EntityDbRepository } from './EntityDbRepository';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
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
		id: 'task-1',
		important: false,
		urgent: false,
		...overrides,
	};
}

afterEach(async () => {
	await deleteDB(APP_DB_NAME);
});

describe('EntityDbRepository', () => {
	it('starts empty', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('persists a record across separate connections', async () => {
		const first = await EntityDbRepository.create('dreams', parseDream);
		await first.put(makeDream());

		const second = await EntityDbRepository.create('dreams', parseDream);

		await expect(second.getAll()).resolves.toEqual([makeDream()]);
	});

	it('keeps the three stores apart', async () => {
		const dreams = await EntityDbRepository.create('dreams', parseDream);
		const tasks = await EntityDbRepository.create('tasks', parseTask);

		await dreams.put(makeDream());
		await tasks.put(makeTask());

		await expect(dreams.getAll()).resolves.toHaveLength(1);
		await expect(tasks.getAll()).resolves.toHaveLength(1);
		expect((await dreams.getAll())[0].id).toBe('id-1');
		expect((await tasks.getAll())[0].id).toBe('task-1');
	});

	it('replaces a record with the same id', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);

		await repository.put(makeDream());
		await repository.put(makeDream({ status: Status.Done }));

		const all = await repository.getAll();
		expect(all).toHaveLength(1);
		expect(all[0].status).toBe(Status.Done);
	});

	it('removes a record and clears the store', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);
		await repository.put(makeDream());
		await repository.put(makeDream({ id: 'id-2' }));

		await repository.remove('id-1');
		await expect(repository.getAll()).resolves.toHaveLength(1);

		await repository.clear();
		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('skips and counts a row it cannot parse instead of failing the load', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);
		await repository.put(makeDream());

		// Write a broken row behind the repository's back, the way a future
		// schema change or a corrupted profile would.
		const raw = await openDB(APP_DB_NAME, 3);
		await raw.put('dreams', { id: 'broken', status: 99 } as never);
		raw.close();

		const loaded = await repository.getAll();

		expect(loaded).toHaveLength(1);
		expect(loaded[0].id).toBe('id-1');
		expect(repository.skipped).toBe(1);
	});

	it('resets the skipped count on each load', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);
		await repository.put(makeDream());

		const raw = await openDB(APP_DB_NAME, 3);
		await raw.put('dreams', { id: 'broken', status: 99 } as never);
		raw.close();

		await repository.getAll();
		expect(repository.skipped).toBe(1);

		// Remove the broken row directly — `remove` needs no parsing — so the
		// next load has only valid rows and the count must drop back to zero.
		await repository.remove('broken');

		await repository.getAll();
		expect(repository.skipped).toBe(0);
	});

	it('propagates an error from parse that is not an EntityFormatError', async () => {
		const failingParse = (): Dream => {
			throw new TypeError('boom');
		};
		const repository = await EntityDbRepository.create('dreams', failingParse);

		const raw = await openDB(APP_DB_NAME, 3);
		await raw.put('dreams', makeDream());
		raw.close();

		await expect(repository.getAll()).rejects.toThrow(TypeError);
	});

	it('drops a leftover todos store from the previous schema', async () => {
		await deleteDB(APP_DB_NAME);
		const old = await openDB(APP_DB_NAME, 2, {
			upgrade(db) {
				db.createObjectStore('todos', { keyPath: 'id' });
			},
		});
		old.close();

		await EntityDbRepository.create('dreams', parseDream);

		const raw = await openDB(APP_DB_NAME, 3);
		expect([...raw.objectStoreNames].sort()).toEqual(['dreams', 'goals', 'tasks']);
		raw.close();
	});

	it('throws StorageUnavailableError when indexedDB is missing', async () => {
		const original = globalThis.indexedDB;
		// @ts-expect-error deliberately removing the global to simulate a browser without IndexedDB
		delete globalThis.indexedDB;

		try {
			await expect(EntityDbRepository.create('dreams', parseDream)).rejects.toBeInstanceOf(
				StorageUnavailableError,
			);
		} finally {
			globalThis.indexedDB = original;
		}
	});
});
