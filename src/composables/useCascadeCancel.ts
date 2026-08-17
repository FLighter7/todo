import { Status } from '@/types';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';

export interface CascadeCounts {
	goals: number;
	tasks: number;
}

/**
 * Counts and cancels a Dream/Goal's active descendants for the cascading-cancel
 * flow. Lives here, not inside the entity stores, so dreams/goals/tasks stay
 * mutually independent -- the same reasoning `DefaultLayout.vue` already
 * relies on by importing all three stores together without any of them
 * knowing about each other.
 */
export function useCascadeCancel() {
	const goals = useGoalsStore();
	const tasks = useTasksStore();

	function countGoalTasks(goalId: string): number {
		return tasks.active.filter((task) => task.goalId === goalId).length;
	}

	function countDreamDescendants(dreamId: string): CascadeCounts {
		const activeGoals = goals.active.filter((goal) => goal.dreamId === dreamId);
		const taskCount = activeGoals.reduce((sum, goal) => sum + countGoalTasks(goal.id), 0);

		return { goals: activeGoals.length, tasks: taskCount };
	}

	async function cancelGoalTasks(goalId: string): Promise<void> {
		const ids = tasks.active.filter((task) => task.goalId === goalId).map((task) => task.id);

		for (const id of ids) {
			await tasks.close(id, Status.Cancelled);
		}
	}

	async function cancelDreamGoals(dreamId: string): Promise<void> {
		const ids = goals.active.filter((goal) => goal.dreamId === dreamId).map((goal) => goal.id);

		for (const id of ids) {
			await cancelGoalTasks(id);
			await goals.close(id, Status.Cancelled);
		}
	}

	return { countGoalTasks, countDreamDescendants, cancelGoalTasks, cancelDreamGoals };
}
