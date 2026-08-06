export type TodoPeriod = 'one-time' | 'periodic';

export interface Todo {
	id: string;
	title: string;
	note?: string;
	/** ISO 8601 timestamp in UTC. */
	created: string;
	/** ISO 8601 timestamp in UTC, moved on every change. Drives sync merges. */
	updated: string;
	period: TodoPeriod;
	important: boolean;
	urgent: boolean;
	done: boolean;
	/** Tombstone: the task is gone but its trace stays so sync cannot revive it. */
	deleted: boolean;
}
