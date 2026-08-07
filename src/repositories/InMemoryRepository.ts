import type { Todo } from '@/types/todo';
import type { TodoStorage } from './TodoStorage';

export class InMemoryRepository implements TodoStorage {
	private readonly items: Map<string, Todo>;

	constructor(seed: Todo[] = []) {
		this.items = new Map(seed.map((todo) => [todo.id, todo]));
	}

	async getAll(): Promise<Todo[]> {
		return [...this.items.values()].map((todo) => ({ ...todo }));
	}

	async put(todo: Todo): Promise<void> {
		this.items.set(todo.id, { ...todo });
	}

	async remove(id: string): Promise<void> {
		this.items.delete(id);
	}

	async clear(): Promise<void> {
		this.items.clear();
	}
}
