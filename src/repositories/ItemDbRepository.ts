import type { IDBPDatabase } from 'idb';
import { ItemFormatError, type ItemBase } from '@/types';
import type { ItemStorage } from './ItemStorage';
import { openAppDatabase, type AppDbSchema, type StoreName } from './AppDatabase';

export class ItemDbRepository<T extends ItemBase> implements ItemStorage<T> {
	/** How many rows the last `getAll` could not parse. */
	skipped = 0;

	private constructor(
		private readonly database: IDBPDatabase<AppDbSchema>,
		private readonly storeName: StoreName,
		private readonly parse: (value: unknown) => T,
	) {}

	/** Opening the connection is async, so this replaces `new`. */
	static async create<T extends ItemBase>(
		storeName: StoreName,
		parse: (value: unknown) => T,
	): Promise<ItemDbRepository<T>> {
		const database = await openAppDatabase();

		return new ItemDbRepository(database, storeName, parse);
	}

	/**
	 * A row that no longer parses is skipped and counted rather than fatal:
	 * one bad record must not cost the user the whole list. Nothing on disk
	 * is touched, so the damage stays recoverable through an export.
	 */
	async getAll(): Promise<T[]> {
		const rows = (await this.database.getAll(this.storeName)) as unknown[];
		const parsed: T[] = [];
		let skipped = 0;

		for (const row of rows) {
			try {
				parsed.push(this.parse(row));
			} catch (error) {
				if (!(error instanceof ItemFormatError)) {
					throw error;
				}
				skipped += 1;
			}
		}

		this.skipped = skipped;

		return parsed;
	}

	async put(record: T): Promise<void> {
		// A plain copy: IndexedDB cannot structured-clone Vue's reactive proxies.
		await this.database.put(this.storeName, { ...record } as AppDbSchema[StoreName]['value']);
	}

	async remove(id: string): Promise<void> {
		await this.database.delete(this.storeName, id);
	}

	async clear(): Promise<void> {
		await this.database.clear(this.storeName);
	}
}
