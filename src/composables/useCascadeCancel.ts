import { Status } from '@/types';
import { useItemsStore } from '@/stores/items';

export interface CascadeCounts {
	goals: number;
	tasks: number;
}

/**
 * Counts and cancels a Dream/Goal/Group's active descendants for the
 * cascading-cancel flow. Only Cancel cascades — Done and Reopen say nothing
 * about relatives — so this is a flow the Dreams, Goals and Groups page
 * containers opt into, not something the store does on every close.
 */
export function useCascadeCancel() {
	const items = useItemsStore();

	function countGoalTasks(goalId: string): number {
		return items.tasks.active.filter((task) => task.goalId === goalId).length;
	}

	function countGroupTasks(groupId: string): number {
		return items.tasks.active.filter((task) => task.groupId === groupId).length;
	}

	function countDreamDescendants(dreamId: string): CascadeCounts {
		const activeGoals = items.goals.active.filter((goal) => goal.dreamId === dreamId);
		const taskCount = activeGoals.reduce((sum, goal) => sum + countGoalTasks(goal.id), 0);

		return { goals: activeGoals.length, tasks: taskCount };
	}

	async function cancelGoalTasks(goalId: string): Promise<void> {
		const ids = items.tasks.active.filter((task) => task.goalId === goalId).map((task) => task.id);

		for (const id of ids) {
			await items.close(id, Status.Cancelled);
		}
	}

	async function cancelGroupTasks(groupId: string): Promise<void> {
		const ids = items.tasks.active
			.filter((task) => task.groupId === groupId)
			.map((task) => task.id);

		for (const id of ids) {
			await items.close(id, Status.Cancelled);
		}
	}

	async function cancelDreamGoals(dreamId: string): Promise<void> {
		const ids = items.goals.active
			.filter((goal) => goal.dreamId === dreamId)
			.map((goal) => goal.id);

		for (const id of ids) {
			await cancelGoalTasks(id);
			await items.close(id, Status.Cancelled);
		}
	}

	return {
		countGoalTasks,
		countGroupTasks,
		countDreamDescendants,
		cancelGoalTasks,
		cancelGroupTasks,
		cancelDreamGoals,
	};
}
