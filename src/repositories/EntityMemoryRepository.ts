import type { EntityBase } from '@/types';
import type { EntityStorage } from './EntityStorage';

/**
 * No singleton, deliberately: this holds independent, disposable state —
 * a fallback instance, or a seeded one in a test — and must never be shared.
 */
export class EntityMemoryRepository<T extends EntityBase> implements EntityStorage<T> {
	private readonly items: Map<string, T>;

	constructor(seed: T[] = []) {
		this.items = new Map(seed.map((record) => [record.id, { ...record }]));
	}

	async getAll(): Promise<T[]> {
		return [...this.items.values()].map((record) => ({ ...record }));
	}

	async put(record: T): Promise<void> {
		this.items.set(record.id, { ...record });
	}

	async remove(id: string): Promise<void> {
		this.items.delete(id);
	}

	async clear(): Promise<void> {
		this.items.clear();
	}
}
