import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Todo } from '@/types/todo';
import { StorageUnavailableError, type TodoStorage } from './TodoStorage';

const DB_NAME = 'todo';
const DB_VERSION = 2;
const STORE_NAME = 'todos';

interface TodoDbSchema extends DBSchema {
	todos: {
		key: string;
		value: Todo;
	};
}

export class IndexedDbRepository implements TodoStorage {
	private constructor(private readonly database: IDBPDatabase<TodoDbSchema>) {}

	/** Construction requires opening the connection, so this replaces `new`. */
	static async create(): Promise<IndexedDbRepository> {
		if (typeof indexedDB === 'undefined') {
			throw new StorageUnavailableError();
		}

		try {
			const database = await openDB<TodoDbSchema>(DB_NAME, DB_VERSION, {
				upgrade(db, oldVersion, _newVersion, transaction) {
					if (!db.objectStoreNames.contains(STORE_NAME)) {
						db.createObjectStore(STORE_NAME, { keyPath: 'id' });
					}

					if (oldVersion > 0 && oldVersion < 2) {
						// Records written before sync existed have no updated/deleted.
						// updated takes created rather than "now": as far as this app
						// knows the record never changed, and stamping the present
						// would hand it an undeserved win in the first merge.
						const store = transaction.objectStore(STORE_NAME);
						void store.openCursor().then(async function patch(cursor) {
							if (!cursor) return;
							const record = cursor.value as Partial<Todo> & { id: string };
							await cursor.update({
								...record,
								updated: record.updated ?? record.created ?? new Date(0).toISOString(),
								deleted: record.deleted ?? false,
							} as Todo);
							return patch(await cursor.continue());
						});
					}
				},
			});

			// Another tab upgrading or deleting the database stays blocked until every
			// other connection closes, so release ours as soon as it asks.
			database.addEventListener('versionchange', () => database.close());

			return new IndexedDbRepository(database);
		} catch (error) {
			throw new StorageUnavailableError(error);
		}
	}

	async getAll(): Promise<Todo[]> {
		return this.database.getAll(STORE_NAME);
	}

	async put(todo: Todo): Promise<void> {
		await this.database.put(STORE_NAME, todo);
	}

	async remove(id: string): Promise<void> {
		await this.database.delete(STORE_NAME, id);
	}

	async clear(): Promise<void> {
		await this.database.clear(STORE_NAME);
	}
}
