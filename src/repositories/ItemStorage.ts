import type { ItemBase } from '@/types';

/**
 * The seam that keeps the stores from knowing IndexedDB sits underneath —
 * which is what lets their tests run without a browser.
 */
export interface ItemStorage<T extends ItemBase> {
	getAll(): Promise<T[]>;
	put(record: T): Promise<void>;
	remove(id: string): Promise<void>;
	clear(): Promise<void>;
	/**
	 * Rows the last `getAll()` rejected as unparseable. Absent when the
	 * storage has no way to tell — an in-memory repository, for instance,
	 * never holds anything it didn't already accept.
	 */
	readonly skipped?: number;
}

export class StorageUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Persistent storage is unavailable', { cause });
		this.name = 'StorageUnavailableError';
	}
}
