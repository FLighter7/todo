import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Dream, Goal, Task } from '@/types';
import { StorageUnavailableError } from './EntityStorage';

export const APP_DB_NAME = 'todo';
export const APP_DB_VERSION = 3;

export const STORE_NAMES = ['dreams', 'goals', 'tasks'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export interface AppDbSchema extends DBSchema {
	dreams: { key: string; value: Dream };
	goals: { key: string; value: Goal };
	tasks: { key: string; value: Task };
}

/**
 * One shared schema for all three stores, and one place that attaches the
 * `versionchange` handler. Each caller gets its own connection — nothing is
 * pooled — so the handler has to live here: three hand-rolled `openDB` calls
 * would mean three copies of it, and forgetting one is the documented trap
 * where a second tab carrying a new schema hangs forever waiting for the
 * first to let go.
 */
export async function openAppDatabase(): Promise<IDBPDatabase<AppDbSchema>> {
	if (typeof indexedDB === 'undefined') {
		throw new StorageUnavailableError();
	}

	try {
		const database = await openDB<AppDbSchema>(APP_DB_NAME, APP_DB_VERSION, {
			upgrade(db) {
				// Version 3 starts clean. The old single-entity store is dropped
				// rather than migrated: there is no data worth carrying over, and
				// a migration would have to invent a shape for fields that never
				// existed.
				if (db.objectStoreNames.contains('todos' as never)) {
					db.deleteObjectStore('todos' as never);
				}

				for (const name of STORE_NAMES) {
					if (!db.objectStoreNames.contains(name)) {
						db.createObjectStore(name, { keyPath: 'id' });
					}
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
