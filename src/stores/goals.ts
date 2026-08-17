import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { Status, parseGoal, type Deadline, type Goal } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export interface GoalDraft {
	name: string;
	note?: string;
	dreamId?: string;
	deadline?: Deadline;
}

export interface DreamGroup {
	dreamId: string;
	items: Goal[];
}

export interface GroupedGoals {
	groups: DreamGroup[];
	ungrouped: Goal[];
}

const useBaseGoalsStore = defineEntityStore<Goal, GoalDraft>({
	id: 'goals',
	createRepository: () => EntityDbRepository.create('goals', parseGoal),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		dreamId: draft.dreamId,
		deadline: draft.deadline,
	}),
});

function groupByDream(records: Goal[]): GroupedGoals {
	const byDream = new Map<string, Goal[]>();
	const ungrouped: Goal[] = [];

	for (const goal of records) {
		if (goal.dreamId === undefined) {
			ungrouped.push(goal);
			continue;
		}

		const items = byDream.get(goal.dreamId) ?? [];
		items.push(goal);
		byDream.set(goal.dreamId, items);
	}

	return {
		groups: [...byDream.entries()].map(([dreamId, items]) => ({ dreamId, items })),
		ungrouped,
	};
}

/**
 * Wraps the base goals store to add `groupedByDream`, the same
 * `storeToRefs`-based composition `stores/tasks.ts` uses for `quadrants` (see
 * that file's comment for why a plain spread would silently freeze `active`
 * and `closed`).
 *
 * `groupedByDream` keys groups by `dreamId` only -- it does not resolve the
 * Dream's name. Doing that here would mean the goals store importing the
 * dreams store, which would break the mutual independence dreams/goals/tasks
 * keep today (the same reasoning that keeps cascade-cancel's child counting
 * out of the stores entirely, in `composables/useCascadeCancel.ts`). A
 * caller with access to both stores -- a container -- resolves `dreamId` to
 * a name itself.
 */
export const useGoalsStore = defineStore('goalsGrouped', () => {
	const store = useBaseGoalsStore();
	const { records, active, closed, loading } = storeToRefs(store);

	const groupedByDream = computed<{ active: GroupedGoals; closed: GroupedGoals }>(() => ({
		active: groupByDream(active.value),
		closed: groupByDream(closed.value),
	}));

	return {
		records,
		active,
		closed,
		loading,
		groupedByDream,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
	};
});
