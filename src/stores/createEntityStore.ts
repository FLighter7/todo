import { computed, ref, toRaw, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { Status, type ItemBase } from '@/types';
import type { ItemStorage } from '@/repositories/ItemStorage';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import { collectGarbage } from '@/utils';
import { useSettingsStore } from './settings';
import { useStorageStore } from './storage';

export interface EntityStoreOptions<T extends ItemBase, D> {
	/** Pinia store id. */
	id: string;
	/** Opens the real repository. Tests pass their own to `load`. */
	createRepository: () => Promise<ItemStorage<T>>;
	/** Turns a draft into a complete record. */
	build: (draft: D, id: string, now: string) => T;
	/**
	 * Optional per-record cleanup run on load, after the closed-record sweep.
	 * Only the task store needs it — completions have to be pruned by occurrence,
	 * and only a Task has any. Returning the record unchanged (same reference)
	 * means nothing was pruned and nothing needs rewriting.
	 */
	prune?: (record: T, windowDays: number, now: Date) => T;
}

/**
 * A copy safe to hand to storage. `toRaw` unwraps the record itself, but a
 * shallow spread carries nested objects — a Task's `schedule` and
 * `completions`, a Goal's `deadline` — out as whatever they already were, and
 * a draft bound to a form hands those in as reactive proxies. IndexedDB's
 * structured clone rejects a Proxy outright, so every level has to be
 * unwrapped, not just the first.
 *
 * Total for these records by construction: they are JSON-shaped throughout —
 * strings, numbers, booleans, arrays and plain objects, no Date, Map or Set.
 */
function toStorable<T>(value: T): T {
	const raw = toRaw(value);

	if (Array.isArray(raw)) {
		return raw.map((item) => toStorable(item)) as T;
	}

	if (raw !== null && typeof raw === 'object') {
		const copy: Record<string, unknown> = {};

		for (const [key, item] of Object.entries(raw)) {
			copy[key] = toStorable(item);
		}

		return copy as T;
	}

	return raw;
}

/**
 * The half of every entity store that is identical for dreams, goals and
 * tasks. Each store adds only what is genuinely its own — the task store's
 * quadrants, for instance.
 */
export function defineEntityStore<T extends ItemBase, D>(options: EntityStoreOptions<T, D>) {
	return defineStore(options.id, () => {
		/** Everything in storage, closed records included. Sync needs those. */
		const records = ref<T[]>([]) as Ref<T[]>;
		const loading = ref(false);

		const storageState = useStorageStore();
		const settingsState = useSettingsStore();

		const active = computed(() =>
			records.value.filter((record) => record.status === Status.Opened),
		);
		const closed = computed(() =>
			records.value.filter((record) => record.status !== Status.Opened),
		);

		let storage: ItemStorage<T> = new ItemMemoryRepository<T>();

		async function persist(write: () => Promise<void>): Promise<void> {
			try {
				await write();
			} catch {
				storageState.noteWriteFailure();
			}
		}

		async function load(
			createRepository: () => Promise<ItemStorage<T>> = options.createRepository,
		): Promise<void> {
			loading.value = true;

			try {
				storage = await createRepository();
				storageState.noteAvailable();
			} catch {
				storage = new ItemMemoryRepository<T>();
				storageState.noteUnavailable();
			}

			const now = new Date();
			const loaded = await storage.getAll();
			storageState.noteLoadSkipped(storage.skipped ?? 0);

			const cleanupDays = settingsState.general.cleanupDays;
			const { keep, purge } = collectGarbage(loaded, cleanupDays, now);
			const prune = options.prune;
			const pruned = prune ? keep.map((record) => prune(record, cleanupDays, now)) : keep;
			records.value = pruned;

			await persist(async () => {
				for (const id of purge) {
					await storage.remove(id);
				}

				for (const [index, record] of pruned.entries()) {
					if (record !== keep[index]) {
						await storage.put(toStorable(record));
					}
				}
			});

			loading.value = false;
		}

		async function add(draft: D): Promise<T> {
			const now = new Date().toISOString();
			const record = options.build(draft, crypto.randomUUID(), now);

			records.value.push(record);
			await persist(() => storage.put(toStorable(record)));

			return record;
		}

		async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<void> {
			const index = records.value.findIndex((record) => record.id === id);
			if (index === -1) {
				return;
			}

			// toRaw() before spreading: records.value[index] is a reactive proxy,
			// and a shallow spread of a proxy carries nested objects out as
			// whatever they already were. That is enough for the record's own
			// top-level shape — the in-memory `updated` below is correct — but a
			// nested field (a Task's schedule, say) can itself already be a
			// reactive proxy handed in by `patch`, and toRaw() only unwraps the
			// first level. toStorable() below is what unwraps the rest before the
			// write.
			const updated: T = {
				...toRaw(records.value[index]),
				...patch,
				updated: new Date().toISOString(),
			};
			records.value[index] = updated;
			await persist(() => storage.put(toStorable(updated)));
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
			// Plain copies, every level unwrapped: reading these back out of a
			// reactive array would yield proxies, which IndexedDB cannot
			// structured-clone. toStorable() first in case `incoming` itself came
			// from another store's reactive `records`.
			const copies = incoming.map((record) => toStorable(record));
			records.value = copies;

			await persist(async () => {
				await storage.clear();
				for (const record of copies) {
					await storage.put(toStorable(record));
				}
			});
		}

		return {
			records,
			active,
			closed,
			loading,
			load,
			add,
			update,
			close,
			reopen,
			replaceAll,
		};
	});
}
