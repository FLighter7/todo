import { computed, ref, toRaw, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { Status, type EntityBase } from '@/types';
import type { EntityStorage } from '@/repositories/EntityStorage';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { DEFAULT_CLEANUP_DAYS, collectGarbage } from '@/utils';
import { useStorageStore } from './storage';

export interface EntityStoreOptions<T extends EntityBase, D> {
	/** Pinia store id. */
	id: string;
	/** Opens the real repository. Tests pass their own to `load`. */
	createRepository: () => Promise<EntityStorage<T>>;
	/** Turns a draft into a complete record. */
	build: (draft: D, id: string, now: string) => T;
}

/**
 * The half of every entity store that is identical for dreams, goals and
 * tasks. Each store adds only what is genuinely its own — the task store's
 * quadrants, for instance.
 */
export function defineEntityStore<T extends EntityBase, D>(options: EntityStoreOptions<T, D>) {
	return defineStore(options.id, () => {
		/** Everything in storage, closed records included. Sync needs those. */
		const records = ref<T[]>([]) as Ref<T[]>;
		const loading = ref(false);
		const cleanupDays = ref(DEFAULT_CLEANUP_DAYS);

		const storageState = useStorageStore();

		const active = computed(() =>
			records.value.filter((record) => record.status === Status.Opened),
		);
		const closed = computed(() =>
			records.value.filter((record) => record.status !== Status.Opened),
		);

		let storage: EntityStorage<T> = new EntityMemoryRepository<T>();

		async function persist(write: () => Promise<void>): Promise<void> {
			try {
				await write();
			} catch {
				storageState.noteWriteFailure();
			}
		}

		async function load(
			createRepository: () => Promise<EntityStorage<T>> = options.createRepository,
		): Promise<void> {
			loading.value = true;

			try {
				storage = await createRepository();
				storageState.noteAvailable();
			} catch {
				storage = new EntityMemoryRepository<T>();
				storageState.noteUnavailable();
			}

			const loaded = await storage.getAll();
			storageState.noteLoadSkipped(storage.skipped ?? 0);
			const { keep, purge } = collectGarbage(loaded, cleanupDays.value, new Date());
			records.value = keep;

			await persist(async () => {
				for (const id of purge) {
					await storage.remove(id);
				}
			});

			loading.value = false;
		}

		async function add(draft: D): Promise<T> {
			const now = new Date().toISOString();
			const record = options.build(draft, crypto.randomUUID(), now);

			records.value.push(record);
			await persist(() => storage.put({ ...record }));

			return record;
		}

		async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<void> {
			const index = records.value.findIndex((record) => record.id === id);
			if (index === -1) {
				return;
			}

			// toRaw() before spreading: records.value[index] is a reactive proxy,
			// and a shallow spread of a proxy carries nested objects (a Task's
			// schedule and completions) out as proxies too. IndexedDB's structured
			// clone rejects a Proxy outright, so the write must start from the raw
			// object instead.
			const updated: T = {
				...toRaw(records.value[index]),
				...patch,
				updated: new Date().toISOString(),
			};
			records.value[index] = updated;
			await persist(() => storage.put({ ...updated }));
		}

		/**
		 * Closing is the only kind of deletion the interface offers. The record
		 * stays with an honest `updated` so a merge cannot resurrect it; the
		 * garbage collector removes it for good once the window has passed.
		 */
		async function close(id: string, status: Status.Done | Status.Cancelled): Promise<void> {
			await update(id, { status } as Partial<Omit<T, 'id'>>);
		}

		async function reopen(id: string): Promise<void> {
			await update(id, { status: Status.Opened } as Partial<Omit<T, 'id'>>);
		}

		/** Replaces the whole list, e.g. after restoring a backup or a sync. */
		async function replaceAll(incoming: T[]): Promise<void> {
			// Plain copies: reading these back out of a reactive array would yield
			// proxies, which IndexedDB cannot structured-clone. toRaw() first in
			// case `incoming` itself came from another store's reactive `records`.
			const copies = incoming.map((record) => ({ ...toRaw(record) }));
			records.value = copies;

			await persist(async () => {
				await storage.clear();
				for (const record of copies) {
					await storage.put({ ...record });
				}
			});
		}

		return {
			records,
			active,
			closed,
			loading,
			cleanupDays,
			load,
			add,
			update,
			close,
			reopen,
			replaceAll,
		};
	});
}
