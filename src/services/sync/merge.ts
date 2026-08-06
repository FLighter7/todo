import type { Todo } from '@/types/todo';

/**
 * Last-write-wins merge by id, including tombstones: a deletion is just a
 * record with a timestamp, so it beats older edits and loses to newer ones.
 *
 * Ties keep the local record. The rule is arbitrary but has to be
 * deterministic — otherwise the outcome would depend on which device ran the
 * merge, and the two lists would drift apart for good.
 */
export function mergeTodos(local: Todo[], remote: Todo[]): Todo[] {
	const merged = new Map<string, Todo>();

	for (const todo of local) {
		merged.set(todo.id, { ...todo });
	}

	for (const todo of remote) {
		const current = merged.get(todo.id);
		if (!current || Date.parse(todo.updated) > Date.parse(current.updated)) {
			merged.set(todo.id, { ...todo });
		}
	}

	return [...merged.values()];
}
