import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { Status, parseTask, type Schedule, type Task } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
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
});

/**
 * The matrix is a view of the same data, not a separate entity: this getter
 * splits the open tasks by important × urgent. Closed tasks stay out — the
 * matrix is for deciding what to do next.
 *
 * `Object.assign`-ing the base store with `{ quadrants }` type-checks
 * `quadrants` as a raw `ComputedRef` instead of its unwrapped value, and —
 * worse — even wrapping a plain `{ ...store, quadrants }` spread in a new
 * `defineStore` setup silently freezes scalar state (`loading`,
 * `cleanupDays`) at whatever value it held the instant the spread ran,
 * because a spread copies a primitive by value, not by reference, and only
 * object/array-shaped state stays live by virtue of being the same
 * underlying reactive object. `storeToRefs` is Pinia's documented answer for
 * composing one store from another: it hands back real `Ref`s that stay
 * wired to the source, so every state and getter here keeps updating after
 * the source store changes. Actions are passed through directly — Pinia
 * already binds them to their own store.
 */
export const useTasksStore = defineStore('tasksMatrix', () => {
	const store = useBaseTasksStore();
	const { records, active, closed, loading, cleanupDays } = storeToRefs(store);

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

	return {
		records,
		active,
		closed,
		loading,
		cleanupDays,
		quadrants,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
	};
});
