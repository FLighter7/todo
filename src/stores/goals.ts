import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { ItemType, Status, parseGoal, type Goal, type GoalDraft } from '@/types';
import { ItemDbRepository } from '@/repositories/ItemDbRepository';
import { sectionByParent, type SectionedByParent } from '@/utils';
import { defineEntityStore } from './createEntityStore';

const useBaseGoalsStore = defineEntityStore<Goal, GoalDraft>({
	id: 'goals',
	createRepository: () => ItemDbRepository.create('goals', parseGoal),
	build: (draft, id, now) => ({
		id,
		type: ItemType.Goal,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		dreamId: draft.dreamId,
		deadline: draft.deadline,
	}),
});

/**
 * Wraps the base goals store to add `goalsByDream`, the same
 * `storeToRefs`-based composition `stores/tasks.ts` uses for `quadrants` (see
 * that file's comment for why a plain spread would silently freeze `active`
 * and `closed`).
 *
 * `goalsByDream` keys sections by `dreamId` only -- it does not resolve the
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

	const goalsByDream = computed<{
		active: SectionedByParent<Goal>;
		closed: SectionedByParent<Goal>;
	}>(() => ({
		active: sectionByParent(active.value, (goal) => goal.dreamId),
		closed: sectionByParent(closed.value, (goal) => goal.dreamId),
	}));

	return {
		records,
		active,
		closed,
		loading,
		goalsByDream,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
	};
});
