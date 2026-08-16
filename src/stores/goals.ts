import { Status, parseGoal, type Deadline, type Goal } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export interface GoalDraft {
	name: string;
	note?: string;
	dreamId?: string;
	deadline?: Deadline;
}

export const useGoalsStore = defineEntityStore<Goal, GoalDraft>({
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
