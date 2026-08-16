import type { Completion, Task } from '@/types';

/**
 * All a merge needs. Deliberately structural rather than tied to one type,
 * so the same rule serves every record shape the app has had.
 */
export interface Mergeable {
	id: string;
	updated: string;
}

export class SyncMerger {
	/**
	 * Last-write-wins merge by id. A closed record is just a record with a
	 * timestamp, so a closure beats older edits and loses to newer ones.
	 *
	 * Ties keep the local record. The rule is arbitrary but has to be
	 * deterministic — otherwise the outcome would depend on which device ran
	 * the merge, and the two lists would drift apart for good.
	 */
	merge<T extends Mergeable>(local: T[], remote: T[]): T[] {
		const merged = new Map<string, T>();

		for (const record of local) {
			merged.set(record.id, { ...record });
		}

		for (const record of remote) {
			const current = merged.get(record.id);
			if (!current || Date.parse(record.updated) > Date.parse(current.updated)) {
				merged.set(record.id, { ...record });
			}
		}

		return [...merged.values()];
	}

	/**
	 * Tasks take the rule above for every field except `completions`, which
	 * merge per occurrence instead.
	 *
	 * Whole-record last-write-wins would silently drop marks: two devices out
	 * of contact, one marking the 7th and the other the 14th, produce two
	 * records neither of which holds both, and the newer one wins entirely.
	 * Merging by occurrence loses nothing — different dates never collide,
	 * and an un-mark wins because its `at` is newer.
	 *
	 * Completions are read from both sides' original records by id, not from
	 * whichever side happens to win the whole-record tie-break: the loser of
	 * that tie-break can still hold a mark the winner has never seen.
	 */
	mergeTasks(local: Task[], remote: Task[]): Task[] {
		const localById = new Map(local.map((task) => [task.id, task]));
		const remoteById = new Map(remote.map((task) => [task.id, task]));

		return this.merge(local, remote).map((winner) => {
			const completions = this.mergeCompletions(
				localById.get(winner.id)?.completions,
				remoteById.get(winner.id)?.completions,
			);

			return completions === undefined ? winner : { ...winner, completions };
		});
	}

	/**
	 * A tiny last-write-wins of its own, keyed by occurrence rather than by
	 * record. Order is not meaningful, so callers must not depend on it.
	 */
	mergeCompletions(
		local: Completion[] | undefined,
		remote: Completion[] | undefined,
	): Completion[] | undefined {
		if (local === undefined && remote === undefined) {
			return undefined;
		}

		const merged = new Map<string, Completion>();

		for (const completion of [...(local ?? []), ...(remote ?? [])]) {
			const current = merged.get(completion.occurrence);
			if (!current || Date.parse(completion.at) > Date.parse(current.at)) {
				merged.set(completion.occurrence, { ...completion });
			}
		}

		return [...merged.values()];
	}
}

export const syncMerger = new SyncMerger();
