import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Item } from '@/types';
import { StorageUnavailableError } from './ItemStorage';

export const APP_DB_NAME = 'todo';
export const APP_DB_VERSION = 4;

export const ITEMS_STORE = 'items';

/**
 * Every record lives in the one object store, told apart by its `type`. No
 * indexes: the whole collection is read into memory and filtered there, so a
 * new type needs no schema change at all.
 */
export interface AppDbSchema extends DBSchema {
	items: { key: string; value: Item };
}

/**
 * The one place that attaches the `versionchange` handler. Forgetting it is
 * the documented trap where a second tab carrying a new schema hangs forever
 * waiting for the first to let go.
 */
export async function openAppDatabase(): Promise<IDBPDatabase<AppDbSchema>> {
	if (typeof indexedDB === 'undefined') {
		throw new StorageUnavailableError();
	}

	try {
		const database = await openDB<AppDbSchema>(APP_DB_NAME, APP_DB_VERSION, {
			upgrade(db) {
				// Version 4 starts clean, the way version 3 did before it. Whatever
				// stores an older version left behind — `todos`, or `dreams`/
				// `goals`/`tasks` — are dropped rather than migrated: their records
				// carry no `type`, and starting over was a deliberate choice.
				for (const name of Array.from(db.objectStoreNames)) {
					if (name !== ITEMS_STORE) {
						db.deleteObjectStore(name);
					}
				}

				if (!db.objectStoreNames.contains(ITEMS_STORE)) {
					db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
				}
			},
		});

		// Another tab upgrading or deleting the database stays blocked until
		// every other connection closes, so release ours as soon as it asks.
		database.addEventListener('versionchange', () => database.close());

		return database;
	} catch (error) {
		throw new StorageUnavailableError(error);
	}
}
