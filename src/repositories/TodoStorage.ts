import type { Todo } from '@/types/todo';

export interface TodoStorage {
	getAll(): Promise<Todo[]>;
	put(todo: Todo): Promise<void>;
	remove(id: string): Promise<void>;
	clear(): Promise<void>;
}

export class StorageUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Persistent storage is unavailable', { cause });
		this.name = 'StorageUnavailableError';
	}
}
