import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import type { Todo } from '@/types/todo';
import { StorageUnavailableError } from './TodoStorage';
import { IndexedDbRepository } from './IndexedDbRepository';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

afterEach(async () => {
	await deleteDB('todo');
});

describe('IndexedDbRepository', () => {
	it('starts empty', async () => {
		const repository = await IndexedDbRepository.create();

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('persists an item across separate connections', async () => {
		const first = await IndexedDbRepository.create();
		await first.put(makeTodo());

		const second = await IndexedDbRepository.create();

		await expect(second.getAll()).resolves.toEqual([makeTodo()]);
	});

	it('replaces an item with the same id', async () => {
		const repository = await IndexedDbRepository.create();

		await repository.put(makeTodo());
		await repository.put(makeTodo({ done: true }));

		const items = await repository.getAll();
		expect(items).toHaveLength(1);
		expect(items[0].done).toBe(true);
	});

	it('removes an item by id', async () => {
		const repository = await IndexedDbRepository.create();
		await repository.put(makeTodo());

		await repository.remove('id-1');

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('clears every item', async () => {
		const repository = await IndexedDbRepository.create();
		await repository.put(makeTodo());
		await repository.put(makeTodo({ id: 'id-2' }));

		await repository.clear();

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('throws StorageUnavailableError when indexedDB is missing', async () => {
		const original = globalThis.indexedDB;
		// @ts-expect-error deliberately removing the global to simulate a browser without IndexedDB
		delete globalThis.indexedDB;

		try {
			await expect(IndexedDbRepository.create()).rejects.toBeInstanceOf(StorageUnavailableError);
		} finally {
			globalThis.indexedDB = original;
		}
	});
});
