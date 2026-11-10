import type { ItemBase } from '@/types';
import type { ItemStorage } from './ItemStorage';

/**
 * No singleton, deliberately: this holds independent, disposable state —
 * a fallback instance, or a seeded one in a test — and must never be shared.
 */
export class ItemMemoryRepository<T extends ItemBase> implements ItemStorage<T> {
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

	async replaceAll(records: T[]): Promise<void> {
		this.items.clear();
		for (const record of records) {
			this.items.set(record.id, { ...record });
		}
	}
}
