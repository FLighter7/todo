import type { IDBPDatabase } from 'idb';
import { ItemFormatError, parseItem, type Item } from '@/types';
import type { ItemStorage } from './ItemStorage';
import { ITEMS_STORE, openAppDatabase, type AppDbSchema } from './AppDatabase';

export class ItemDbRepository implements ItemStorage<Item> {
	/** How many rows the last `getAll` could not parse. */
	skipped = 0;

	private constructor(
		private readonly database: IDBPDatabase<AppDbSchema>,
		private readonly parse: (value: unknown) => Item,
	) {}

	/**
	 * Opening the connection is async, so this replaces `new`. `parse` is only
	 * ever swapped in tests, to prove an unexpected parser error propagates.
	 */
	static async create(parse: (value: unknown) => Item = parseItem): Promise<ItemDbRepository> {
		const database = await openAppDatabase();

		return new ItemDbRepository(database, parse);
	}

	/**
	 * A row that no longer parses is skipped and counted rather than fatal:
	 * one bad record must not cost the user the whole list. Nothing on disk
	 * is touched, so the damage stays recoverable through an export.
	 */
	async getAll(): Promise<Item[]> {
		const rows = (await this.database.getAll(ITEMS_STORE)) as unknown[];
		const parsed: Item[] = [];
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

	async put(record: Item): Promise<void> {
		// A plain copy: IndexedDB cannot structured-clone Vue's reactive proxies.
		await this.database.put(ITEMS_STORE, { ...record });
	}

	async remove(id: string): Promise<void> {
		await this.database.delete(ITEMS_STORE, id);
	}

	async clear(): Promise<void> {
		await this.database.clear(ITEMS_STORE);
	}

	/**
	 * One readwrite transaction for the clear and every write: either the
	 * whole list lands or the old one stays, and the cost is one commit
	 * rather than one per record. Every request is queued before anything is
	 * awaited — a transaction left with nothing pending commits on its own.
	 */
	async replaceAll(records: Item[]): Promise<void> {
		const transaction = this.database.transaction(ITEMS_STORE, 'readwrite');
		const writes: Promise<unknown>[] = [];

		try {
			writes.push(transaction.store.clear());
			for (const record of records) {
				writes.push(transaction.store.put({ ...record }));
			}
		} catch (error) {
			// A record that cannot be cloned throws right here, synchronously,
			// with the clear already queued. Committing that would empty the list.
			transaction.abort();
			await Promise.allSettled([...writes, transaction.done]);
			throw error;
		}

		await Promise.all([...writes, transaction.done]);
	}
}
