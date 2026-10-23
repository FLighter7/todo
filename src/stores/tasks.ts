import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { ItemType, Status, parseTask, type Task, type TaskDraft } from '@/types';
import { ItemDbRepository } from '@/repositories/ItemDbRepository';
import {
	pruneTask,
	quadrantOf,
	sectionByParent,
	type QuadrantKey,
	type SectionedByParent,
} from '@/utils';
import { isLastOccurrence } from '@/utils/schedule';
import { defineEntityStore } from './createEntityStore';

const useBaseTasksStore = defineEntityStore<Task, TaskDraft>({
	id: 'tasks',
	createRepository: () => ItemDbRepository.create('tasks', parseTask),
	build: (draft, id, now) => ({
		id,
		type: ItemType.Task,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		goalId: draft.goalId,
		important: draft.important,
		urgent: draft.urgent,
		schedule: draft.schedule,
	}),
	prune: pruneTask,
});

/**
 * The matrix is a view of the same data, not a separate entity: this getter
 * splits the open tasks by important × urgent. Closed tasks stay out — the
 * matrix is for deciding what to do next.
 *
 * `Object.assign`-ing the base store with `{ quadrants }` type-checks
 * `quadrants` as a raw `ComputedRef` instead of its unwrapped value. A plain
 * `{ ...store, quadrants }` spread — even inside a new `defineStore` setup —
 * fares no better at runtime: a spread just copies each property's current
 * value out once, so nothing behind it stays connected to the source store.
 * Scalars (`loading`) freeze at that value, and so do `records`, `active`
 * and `closed`, despite being arrays — `load()` reassigns `records` outright
 * rather than mutating it in place, and `active`/`closed` are computeds that
 * return a fresh array on every recalculation, so the copied snapshot is
 * already stale. `storeToRefs` is Pinia's documented answer for composing
 * one store from another: it hands back real `Ref`s that stay wired to the
 * source, so every state and getter here keeps updating after the source
 * store changes. Actions are passed through directly — Pinia already binds
 * them to their own store.
 *
 * `tasksByGoal` keys sections by `goalId` only, the same way `goalsByDream`
 * on the goals store keys by `dreamId` only — it never resolves the Goal's
 * name, since that would mean the tasks store importing the goals store,
 * breaking the mutual independence dreams/goals/tasks keep. A caller with
 * access to both stores — a container — resolves `goalId` to a name itself.
 */
export const useTasksStore = defineStore('tasksMatrix', () => {
	const store = useBaseTasksStore();
	const { records, active, closed, loading } = storeToRefs(store);

	const quadrants = computed<Record<QuadrantKey, Task[]>>(() => {
		const groups: Record<QuadrantKey, Task[]> = {
			do: [],
			schedule: [],
			delegate: [],
			eliminate: [],
		};

		for (const task of active.value) {
			groups[quadrantOf(task)].push(task);
		}

		return groups;
	});

	const tasksByGoal = computed<{
		active: SectionedByParent<Task>;
		closed: SectionedByParent<Task>;
	}>(() => ({
		active: sectionByParent(active.value, (task) => task.goalId),
		closed: sectionByParent(closed.value, (task) => task.goalId),
	}));

	function findTask(id: string): Task | undefined {
		return records.value.find((task) => task.id === id);
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

		await store.update(taskId, {
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

		await store.update(taskId, {
			schedule,
			completions,
			status: applyLastOccurrenceStatus(task, schedule, occurrence, skipped),
		});
	}

	return {
		records,
		active,
		closed,
		loading,
		quadrants,
		tasksByGoal,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
		setOccurrenceDone,
		setOccurrenceSkipped,
	};
});
