import type { IDBPDatabase } from 'idb';
import type { EntityBase } from '@/types';
import type { EntityStorage } from './EntityStorage';
import { openAppDatabase, type AppDbSchema, type StoreName } from './AppDatabase';

export class EntityDbRepository<T extends EntityBase> implements EntityStorage<T> {
	/** How many rows the last `getAll` could not parse. */
	skipped = 0;

	private constructor(
		private readonly database: IDBPDatabase<AppDbSchema>,
		private readonly storeName: StoreName,
		private readonly parse: (value: unknown) => T,
	) {}

	/** Opening the connection is async, so this replaces `new`. */
	static async create<T extends EntityBase>(
		storeName: StoreName,
		parse: (value: unknown) => T,
	): Promise<EntityDbRepository<T>> {
		const database = await openAppDatabase();

		return new EntityDbRepository(database, storeName, parse);
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
			} catch {
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
