import { computed, ref, shallowRef, toRaw } from 'vue';
import { defineStore } from 'pinia';
import {
	ItemType,
	Status,
	isDream,
	isGoal,
	isGroup,
	isTask,
	type DraftOf,
	type Dream,
	type Goal,
	type Group,
	type Item,
	type ItemOf,
	type ItemPatch,
	type Task,
} from '@/types';
import type { ItemStorage } from '@/repositories/ItemStorage';
import { ItemDbRepository } from '@/repositories/ItemDbRepository';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import {
	collectGarbage,
	pruneItem,
	quadrantOf,
	sectionByParent,
	type QuadrantKey,
	type SectionedByParent,
} from '@/utils';
import { isLastOccurrence } from '@/utils/schedule';
import { useSettingsStore } from './settings';
import { useStorageStore } from './storage';

/** One type's slice of the collection, split the way the Active/History tabs need it. */
export interface TypeView<T extends Item> {
	all: T[];
	active: T[];
	closed: T[];
}

/** A parent-linked slice, sectioned separately for the Active and History tabs. */
export interface SectionedView<T extends Item> {
	active: SectionedByParent<T>;
	closed: SectionedByParent<T>;
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

/** A mapped type, so leaving a new `ItemType` without a builder fails to compile. */
const BUILDERS: { [K in ItemType]: (draft: DraftOf<K>, id: string, now: string) => ItemOf<K> } = {
	[ItemType.Task]: (draft, id, now) => ({
		id,
		type: ItemType.Task,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		goalId: draft.goalId,
		groupId: draft.groupId,
		important: draft.important,
		urgent: draft.urgent,
		schedule: draft.schedule,
	}),
	[ItemType.Group]: (draft, id, now) => ({
		id,
		type: ItemType.Group,
		name: draft.name,
		created: now,
		updated: now,
		status: Status.Opened,
		color: draft.color,
		paintItems: draft.paintItems,
	}),
	[ItemType.Goal]: (draft, id, now) => ({
		id,
		type: ItemType.Goal,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		dreamId: draft.dreamId,
		deadline: draft.deadline,
		color: draft.color,
		paintItems: draft.paintItems,
	}),
	[ItemType.Dream]: (draft, id, now) => ({
		id,
		type: ItemType.Dream,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		color: draft.color,
		paintItems: draft.paintItems,
	}),
};

function viewOf<T extends Item>(records: Item[], guard: (item: Item) => item is T): TypeView<T> {
	const all = records.filter(guard);

	return {
		all,
		active: all.filter((record) => record.status === Status.Opened),
		closed: all.filter((record) => record.status !== Status.Opened),
	};
}

function applyLastOccurrenceStatus(
	task: Task,
	schedule: Task['schedule'],
	occurrence: string,
	resolved: boolean,
): Task['status'] {
	if (schedule === undefined || !isLastOccurrence(schedule, occurrence)) {
		return task.status;
	}

	if (resolved && task.status === Status.Opened) {
		return Status.Done;
	}
	if (!resolved && task.status === Status.Done) {
		return Status.Opened;
	}

	return task.status;
}

/**
 * Every item of every type, in one collection. The pages are views of it:
 * `tasks`, `goals` and the rest are filters by `type`, and the matrix is the
 * open tasks split by important × urgent.
 *
 * `records` is a `shallowRef` that is never changed in place — every write
 * assigns a new array holding plain copies. That keeps a write from paying
 * for deep reactive proxies over the whole collection, and it is also why
 * nothing outside may push into the array or edit a record directly: the
 * change would reach neither the screen nor storage.
 */
export const useItemsStore = defineStore('items', () => {
	/** Everything in storage, closed records included. Sync needs those. */
	const records = shallowRef<Item[]>([]);
	const loading = ref(false);

	const storageState = useStorageStore();
	const settingsState = useSettingsStore();

	const byId = computed(() => new Map(records.value.map((record) => [record.id, record])));

	const tasks = computed<TypeView<Task>>(() => viewOf(records.value, isTask));
	const groups = computed<TypeView<Group>>(() => viewOf(records.value, isGroup));
	const goals = computed<TypeView<Goal>>(() => viewOf(records.value, isGoal));
	const dreams = computed<TypeView<Dream>>(() => viewOf(records.value, isDream));

	/** Closed tasks stay out of the matrix: it is for deciding what to do next. */
	const quadrants = computed<Record<QuadrantKey, Task[]>>(() => {
		const split: Record<QuadrantKey, Task[]> = {
			do: [],
			schedule: [],
			delegate: [],
			eliminate: [],
		};

		for (const task of tasks.value.active) {
			split[quadrantOf(task)].push(task);
		}

		return split;
	});

	/**
	 * Sections keyed by the parent's id only. Labels stay with the containers,
	 * which read them through `byId`: a closed or missing parent still makes a
	 * section, and how to name it is presentation.
	 */
	const goalsByDream = computed<SectionedView<Goal>>(() => ({
		active: sectionByParent(goals.value.active, (goal) => goal.dreamId),
		closed: sectionByParent(goals.value.closed, (goal) => goal.dreamId),
	}));

	const tasksByGoal = computed<SectionedView<Task>>(() => ({
		active: sectionByParent(tasks.value.active, (task) => task.goalId),
		closed: sectionByParent(tasks.value.closed, (task) => task.goalId),
	}));

	let storage: ItemStorage<Item> = new ItemMemoryRepository<Item>();

	async function persist(write: () => Promise<void>): Promise<void> {
		try {
			await write();
		} catch {
			storageState.noteWriteFailure();
		}
	}

	async function load(
		createRepository: () => Promise<ItemStorage<Item>> = () => ItemDbRepository.create(),
	): Promise<void> {
		loading.value = true;

		try {
			storage = await createRepository();
			storageState.noteAvailable();
		} catch {
			storage = new ItemMemoryRepository<Item>();
			storageState.noteUnavailable();
		}

		const now = new Date();
		const loaded = await storage.getAll();
		storageState.noteLoadSkipped(storage.skipped ?? 0);

		const cleanupDays = settingsState.general.cleanupDays;
		const { keep, purge } = collectGarbage(loaded, cleanupDays, now);
		const pruned = keep.map((record) => pruneItem(record, cleanupDays, now));
		records.value = pruned;

		await persist(async () => {
			for (const id of purge) {
				await storage.remove(id);
			}

			// pruneItem hands the same reference back when there was nothing to
			// prune, so only the records it actually changed are rewritten.
			for (const [index, record] of pruned.entries()) {
				if (record !== keep[index]) {
					await storage.put(record);
				}
			}
		});

		loading.value = false;
	}

	async function add<K extends ItemType>(type: K, draft: DraftOf<K>): Promise<ItemOf<K>> {
		const now = new Date().toISOString();
		const record = toStorable(BUILDERS[type](draft, crypto.randomUUID(), now));

		records.value = [...records.value, record];
		await persist(() => storage.put(record));

		return record;
	}

	/**
	 * The one write path for an existing record. `id`, `type` and `created`
	 * are put back after the patch: `ItemPatch` already keeps them out, but a
	 * draft passed in as a variable escapes the excess-property check, and a
	 * patched `type` would leave the old type's fields behind.
	 */
	async function write(index: number, patch: object): Promise<void> {
		const current = records.value[index];
		const updated = toStorable({
			...current,
			...patch,
			id: current.id,
			type: current.type,
			created: current.created,
			updated: new Date().toISOString(),
		}) as Item;

		const next = [...records.value];
		next[index] = updated;
		records.value = next;

		await persist(() => storage.put(updated));
	}

	function indexOf(id: string): number {
		return records.value.findIndex((record) => record.id === id);
	}

	/**
	 * Does nothing for an unknown id or a record of another type: the type
	 * argument is what lets the patch be checked against that type's fields.
	 */
	async function update<K extends ItemType>(
		type: K,
		id: string,
		patch: ItemPatch<K>,
	): Promise<void> {
		const index = indexOf(id);
		if (index === -1 || records.value[index].type !== type) {
			return;
		}

		await write(index, patch);
	}

	/**
	 * Closing is the only kind of deletion the interface offers. The record
	 * stays with an honest `updated` so a merge cannot resurrect it; the
	 * garbage collector removes it for good once the window has passed.
	 */
	async function close(id: string, status: Status.Done | Status.Cancelled): Promise<void> {
		const index = indexOf(id);
		if (index !== -1) {
			await write(index, { status });
		}
	}

	async function reopen(id: string): Promise<void> {
		const index = indexOf(id);
		if (index !== -1) {
			await write(index, { status: Status.Opened });
		}
	}

	/** Replaces the whole collection, e.g. after restoring a backup or a sync. */
	async function replaceAll(incoming: Item[]): Promise<void> {
		// Plain copies, every level unwrapped, in case `incoming` was read out
		// of something reactive: IndexedDB cannot structured-clone a proxy.
		const copies = incoming.map((record) => toStorable(record));
		records.value = copies;

		await persist(() => storage.replaceAll(copies));
	}

	function findTask(id: string): Task | undefined {
		const record = byId.value.get(id);
		return record !== undefined && isTask(record) ? record : undefined;
	}

	async function setOccurrenceDone(
		taskId: string,
		occurrence: string,
		done: boolean,
	): Promise<void> {
		const task = findTask(taskId);
		if (task === undefined || task.schedule === undefined) {
			return;
		}

		const completions = (task.completions ?? []).filter((entry) => entry.occurrence !== occurrence);
		completions.push({ occurrence, done, at: new Date().toISOString() });

		const exdate = task.schedule.exdate?.filter((entry) => entry !== occurrence);
		const schedule = {
			...task.schedule,
			exdate: exdate !== undefined && exdate.length > 0 ? exdate : undefined,
		};

		await update(ItemType.Task, taskId, {
			completions,
			schedule,
			status: applyLastOccurrenceStatus(task, schedule, occurrence, done),
		});
	}

	async function setOccurrenceSkipped(
		taskId: string,
		occurrence: string,
		skipped: boolean,
	): Promise<void> {
		const task = findTask(taskId);
		if (task === undefined || task.schedule === undefined) {
			return;
		}

		const existing = task.schedule.exdate ?? [];
		const exdate = skipped
			? existing.includes(occurrence)
				? existing
				: [...existing, occurrence]
			: existing.filter((entry) => entry !== occurrence);
		const schedule = { ...task.schedule, exdate: exdate.length > 0 ? exdate : undefined };

		const completions = (task.completions ?? []).filter((entry) => entry.occurrence !== occurrence);

		await update(ItemType.Task, taskId, {
			schedule,
			completions,
			status: applyLastOccurrenceStatus(task, schedule, occurrence, skipped),
		});
	}

	return {
		records,
		loading,
		byId,
		tasks,
		groups,
		goals,
		dreams,
		quadrants,
		goalsByDream,
		tasksByGoal,
		load,
		add,
		update,
		close,
		reopen,
		replaceAll,
		setOccurrenceDone,
		setOccurrenceSkipped,
	};
});
