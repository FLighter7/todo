import type { Todo } from '@/types/todo';
import type { TodoStorage } from './types';

export function createInMemoryStorage(seed: Todo[] = []): TodoStorage {
	const items = new Map<string, Todo>(seed.map((todo) => [todo.id, todo]));

	return {
		async getAll() {
			return [...items.values()].map((todo) => ({ ...todo }));
		},
		async put(todo) {
			items.set(todo.id, { ...todo });
		},
		async remove(id) {
			items.delete(id);
		},
	};
}
