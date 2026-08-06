export type TodoPeriod = 'one-time' | 'periodic';

export interface Todo {
	id: string;
	title: string;
	note?: string;
	/** ISO 8601 timestamp in UTC. */
	created: string;
	period: TodoPeriod;
	important: boolean;
	urgent: boolean;
	done: boolean;
}
