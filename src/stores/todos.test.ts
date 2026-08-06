import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Todo } from '@/types/todo';
import type { TodoStorage } from '@/services/storage/types';
import { StorageUnavailableError } from '@/services/storage/types';
import { createInMemoryStorage } from '@/services/storage/in-memory';
import { useTodosStore, type TodoDraft } from './todos';

function makeDraft(overrides: Partial<TodoDraft> = {}): TodoDraft {
	return {
		title: 'Buy milk',
		period: 'one-time',
		important: false,
		urgent: false,
		...overrides,
	};
}

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'seeded',
		title: 'Seeded task',
		created: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('useTodosStore', () => {
	it('loads existing items from storage', async () => {
		const storage = createInMemoryStorage([makeTodo()]);
		const store = useTodosStore();

		await store.load(async () => storage);

		expect(store.items).toHaveLength(1);
		expect(store.persistent).toBe(true);
		expect(store.loading).toBe(false);
	});

	it('falls back to memory when storage is unavailable', async () => {
		const store = useTodosStore();

		await store.load(async () => {
			throw new StorageUnavailableError();
		});

		expect(store.persistent).toBe(false);
		expect(store.items).toEqual([]);
	});

	it('adds a task with a generated id, a creation timestamp and done=false', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage());

		const created = await store.add(makeDraft({ important: true }));

		expect(created.id).not.toBe('');
		expect(Number.isNaN(Date.parse(created.created))).toBe(false);
		expect(created.done).toBe(false);
		expect(created.important).toBe(true);
		expect(store.items).toHaveLength(1);
	});

	it('writes an added task through to storage', async () => {
		const storage = createInMemoryStorage();
		const store = useTodosStore();
		await store.load(async () => storage);

		await store.add(makeDraft());

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});

	it('updates an existing task', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage([makeTodo()]));

		await store.update('seeded', { title: 'Renamed' });

		expect(store.items[0].title).toBe('Renamed');
	});

	it('ignores updates for an unknown id', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage([makeTodo()]));

		await store.update('missing', { title: 'Renamed' });

		expect(store.items[0].title).toBe('Seeded task');
	});

	it('toggles done in both directions', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage([makeTodo()]));

		await store.toggleDone('seeded');
		expect(store.items[0].done).toBe(true);

		await store.toggleDone('seeded');
		expect(store.items[0].done).toBe(false);
	});

	it('removes a task from memory and from storage', async () => {
		const storage = createInMemoryStorage([makeTodo()]);
		const store = useTodosStore();
		await store.load(async () => storage);

		await store.remove('seeded');

		expect(store.items).toEqual([]);
		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('reports a write failure without losing the in-memory change', async () => {
		const failing: TodoStorage = {
			async getAll() {
				return [];
			},
			async put() {
				throw new Error('quota exceeded');
			},
			async remove() {},
		};
		const store = useTodosStore();
		await store.load(async () => failing);

		await store.add(makeDraft());

		expect(store.lastError).toBe('storage.writeFailed');
		expect(store.items).toHaveLength(1);
	});

	it('clears the last error on dismiss', async () => {
		const store = useTodosStore();
		await store.load(async () => {
			throw new StorageUnavailableError();
		});
		store.lastError = 'storage.writeFailed';

		store.dismissError();

		expect(store.lastError).toBeNull();
	});
});
