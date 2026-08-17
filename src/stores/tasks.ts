import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { Status, parseTask, type Schedule, type Task } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { pruneCompletions } from '@/utils';
import { defineEntityStore } from './createEntityStore';

export interface TaskDraft {
	name: string;
	note?: string;
	goalId?: string;
	important: boolean;
	urgent: boolean;
	schedule?: Schedule;
}

export type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

export const QUADRANT_KEYS: readonly QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function quadrantOf(task: Task): QuadrantKey {
	if (task.important) {
		return task.urgent ? 'do' : 'schedule';
	}

	return task.urgent ? 'delegate' : 'eliminate';
}

export function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean } {
	return {
		important: key === 'do' || key === 'schedule',
		urgent: key === 'do' || key === 'delegate',
	};
}

export interface GoalGroup {
	goalId: string;
	items: Task[];
}

export interface GroupedTasks {
	groups: GoalGroup[];
	ungrouped: Task[];
}

const useBaseTasksStore = defineEntityStore<Task, TaskDraft>({
	id: 'tasks',
	createRepository: () => EntityDbRepository.create('tasks', parseTask),
	build: (draft, id, now) => ({
		id,
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
	// pruneCompletions always returns a fresh object, by contract — it must never
	// alias its input. The store, though, uses reference identity to tell "nothing
	// to prune" from "rewrite this record", so hand the original back when the
	// marks came through untouched.
	prune: (task, windowDays, now) => {
		const pruned = pruneCompletions(task, windowDays, now);

		return pruned.completions?.length === task.completions?.length ? task : pruned;
	},
});

function groupByGoal(records: Task[]): GroupedTasks {
	const byGoal = new Map<string, Task[]>();
	const ungrouped: Task[] = [];

	for (const task of records) {
		if (task.goalId === undefined) {
			ungrouped.push(task);
			continue;
		}

		const items = byGoal.get(task.goalId) ?? [];
		items.push(task);
		byGoal.set(task.goalId, items);
	}

	return {
		groups: [...byGoal.entries()].map(([goalId, items]) => ({ goalId, items })),
		ungrouped,
	};
}

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
 * `groupedByGoal` keys groups by `goalId` only, the same way `groupedByDream`
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

	const groupedByGoal = computed<{ active: GroupedTasks; closed: GroupedTasks }>(() => ({
		active: groupByGoal(active.value),
		closed: groupByGoal(closed.value),
	}));

	return {
		records,
		active,
		closed,
		loading,
		quadrants,
		groupedByGoal,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
	};
});
