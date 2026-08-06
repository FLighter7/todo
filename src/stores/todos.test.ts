import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Todo } from '@/types/todo';
import type { TodoStorage } from '@/services/storage/types';
import { StorageUnavailableError } from '@/services/storage/types';
import { createInMemoryStorage } from '@/services/storage/in-memory';
import {
	quadrantFlags,
	quadrantOf,
	useTodosStore,
	type QuadrantKey,
	type TodoDraft,
} from './todos';

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
			async clear() {},
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

describe('useTodosStore replaceAll', () => {
	it('replaces the list in memory and in storage', async () => {
		const storage = createInMemoryStorage([makeTodo({ id: 'old' })]);
		const store = useTodosStore();
		await store.load(async () => storage);

		await store.replaceAll([makeTodo({ id: 'new-1' }), makeTodo({ id: 'new-2' })]);

		expect(store.items.map((t) => t.id)).toEqual(['new-1', 'new-2']);
		const stored = await storage.getAll();
		expect(stored.map((t) => t.id).sort()).toEqual(['new-1', 'new-2']);
	});

	it('can replace the list with nothing', async () => {
		const storage = createInMemoryStorage([makeTodo()]);
		const store = useTodosStore();
		await store.load(async () => storage);

		await store.replaceAll([]);

		expect(store.items).toEqual([]);
		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('reports a write failure instead of throwing', async () => {
		const failing: TodoStorage = {
			async getAll() {
				return [];
			},
			async put() {
				throw new Error('quota exceeded');
			},
			async remove() {},
			async clear() {},
		};
		const store = useTodosStore();
		await store.load(async () => failing);

		await store.replaceAll([makeTodo()]);

		expect(store.lastError).toBe('storage.writeFailed');
	});
});

describe('quadrantOf', () => {
	it('maps important and urgent to do', () => {
		expect(quadrantOf(makeTodo({ important: true, urgent: true }))).toBe('do');
	});

	it('maps important and not urgent to schedule', () => {
		expect(quadrantOf(makeTodo({ important: true, urgent: false }))).toBe('schedule');
	});

	it('maps not important and urgent to delegate', () => {
		expect(quadrantOf(makeTodo({ important: false, urgent: true }))).toBe('delegate');
	});

	it('maps not important and not urgent to eliminate', () => {
		expect(quadrantOf(makeTodo({ important: false, urgent: false }))).toBe('eliminate');
	});
});

describe('quadrantFlags', () => {
	it('is the inverse of quadrantOf for every quadrant', () => {
		const keys: QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

		for (const key of keys) {
			expect(quadrantOf(makeTodo(quadrantFlags(key)))).toBe(key);
		}
	});
});

describe('useTodosStore quadrants', () => {
	it('exposes all four quadrants even when empty', async () => {
		const store = useTodosStore();
		await store.load(async () => createInMemoryStorage());

		expect(Object.keys(store.quadrants).sort()).toEqual([
			'delegate',
			'do',
			'eliminate',
			'schedule',
		]);
	});

	it('groups every task into its quadrant', async () => {
		const store = useTodosStore();
		await store.load(async () =>
			createInMemoryStorage([
				makeTodo({ id: 'a', important: true, urgent: true }),
				makeTodo({ id: 'b', important: true, urgent: false }),
				makeTodo({ id: 'c', important: false, urgent: true }),
				makeTodo({ id: 'd', important: false, urgent: false }),
				makeTodo({ id: 'e', important: true, urgent: true }),
			]),
		);

		expect(store.quadrants.do.map((todo) => todo.id)).toEqual(['a', 'e']);
		expect(store.quadrants.schedule.map((todo) => todo.id)).toEqual(['b']);
		expect(store.quadrants.delegate.map((todo) => todo.id)).toEqual(['c']);
		expect(store.quadrants.eliminate.map((todo) => todo.id)).toEqual(['d']);
	});

	it('moves a task between quadrants when its flags change', async () => {
		const store = useTodosStore();
		await store.load(async () =>
			createInMemoryStorage([makeTodo({ id: 'a', important: false, urgent: false })]),
		);

		await store.update('a', { important: true, urgent: true });

		expect(store.quadrants.eliminate).toEqual([]);
		expect(store.quadrants.do).toHaveLength(1);
	});
});
