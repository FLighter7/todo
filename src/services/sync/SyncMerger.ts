import { isTask, type Completion, type Item } from '@/types';

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
	 * Items take the rule above for every field except a task's `completions`,
	 * which merge per occurrence instead.
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
	 *
	 * Only a task carries marks, so the per-occurrence merge runs only when
	 * the winner is one, and each side's marks are read only if that side's
	 * record is a task too: should a record ever change type, marks must not
	 * ride onto the new type from the version that lost.
	 */
	mergeItems(local: Item[], remote: Item[]): Item[] {
		const localById = new Map(local.map((item) => [item.id, item]));
		const remoteById = new Map(remote.map((item) => [item.id, item]));
		const marksOf = (item: Item | undefined) =>
			item !== undefined && isTask(item) ? item.completions : undefined;

		return this.merge(local, remote).map((winner) => {
			if (!isTask(winner)) {
				return winner;
			}

			const completions = this.mergeCompletions(
				marksOf(localById.get(winner.id)),
				marksOf(remoteById.get(winner.id)),
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
