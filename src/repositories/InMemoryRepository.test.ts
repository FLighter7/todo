import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types/todo';
import { InMemoryRepository } from './InMemoryRepository';

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

describe('InMemoryRepository', () => {
	it('returns an empty list when created without a seed', async () => {
		const repository = new InMemoryRepository();

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('returns seeded items', async () => {
		const todo = makeTodo();
		const repository = new InMemoryRepository([todo]);

		await expect(repository.getAll()).resolves.toEqual([todo]);
	});

	it('stores a new item', async () => {
		const repository = new InMemoryRepository();
		const todo = makeTodo();

		await repository.put(todo);

		await expect(repository.getAll()).resolves.toEqual([todo]);
	});

	it('replaces an item with the same id instead of duplicating it', async () => {
		const repository = new InMemoryRepository([makeTodo()]);

		await repository.put(makeTodo({ title: 'Buy oat milk' }));

		const items = await repository.getAll();
		expect(items).toHaveLength(1);
		expect(items[0].title).toBe('Buy oat milk');
	});

	it('does not expose its internal object to callers', async () => {
		const repository = new InMemoryRepository();
		const todo = makeTodo();

		await repository.put(todo);
		todo.title = 'Mutated after the call';

		const items = await repository.getAll();
		expect(items[0].title).toBe('Buy milk');
	});

	it('removes an item by id', async () => {
		const repository = new InMemoryRepository([makeTodo()]);

		await repository.remove('id-1');

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('ignores removal of an unknown id', async () => {
		const repository = new InMemoryRepository([makeTodo()]);

		await repository.remove('missing');

		await expect(repository.getAll()).resolves.toHaveLength(1);
	});

	it('clears every item', async () => {
		const repository = new InMemoryRepository([makeTodo(), makeTodo({ id: 'id-2' })]);

		await repository.clear();

		await expect(repository.getAll()).resolves.toEqual([]);
	});
});
