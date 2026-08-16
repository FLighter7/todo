import type { EntityBase } from '@/types';

/**
 * The seam that keeps the stores from knowing IndexedDB sits underneath —
 * which is what lets their tests run without a browser.
 */
export interface EntityStorage<T extends EntityBase> {
	getAll(): Promise<T[]>;
	put(record: T): Promise<void>;
	remove(id: string): Promise<void>;
	clear(): Promise<void>;
}

export class StorageUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Persistent storage is unavailable', { cause });
		this.name = 'StorageUnavailableError';
	}
}
