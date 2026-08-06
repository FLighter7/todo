import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types/todo';
import { createInMemoryStorage } from './in-memory';

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

describe('createInMemoryStorage', () => {
	it('returns an empty list when created without a seed', async () => {
		const storage = createInMemoryStorage();

		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('returns seeded items', async () => {
		const todo = makeTodo();
		const storage = createInMemoryStorage([todo]);

		await expect(storage.getAll()).resolves.toEqual([todo]);
	});

	it('stores a new item', async () => {
		const storage = createInMemoryStorage();
		const todo = makeTodo();

		await storage.put(todo);

		await expect(storage.getAll()).resolves.toEqual([todo]);
	});

	it('replaces an item with the same id instead of duplicating it', async () => {
		const storage = createInMemoryStorage([makeTodo()]);

		await storage.put(makeTodo({ title: 'Buy oat milk' }));

		const items = await storage.getAll();
		expect(items).toHaveLength(1);
		expect(items[0].title).toBe('Buy oat milk');
	});

	it('does not expose its internal object to callers', async () => {
		const storage = createInMemoryStorage();
		const todo = makeTodo();

		await storage.put(todo);
		todo.title = 'Mutated after the call';

		const items = await storage.getAll();
		expect(items[0].title).toBe('Buy milk');
	});

	it('removes an item by id', async () => {
		const storage = createInMemoryStorage([makeTodo()]);

		await storage.remove('id-1');

		await expect(storage.getAll()).resolves.toEqual([]);
	});

	it('ignores removal of an unknown id', async () => {
		const storage = createInMemoryStorage([makeTodo()]);

		await storage.remove('missing');

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});

	it('clears every item', async () => {
		const storage = createInMemoryStorage([makeTodo(), makeTodo({ id: 'id-2' })]);

		await storage.clear();

		await expect(storage.getAll()).resolves.toEqual([]);
	});
});
