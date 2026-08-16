import { Status, type EntityBase, type Task } from '@/types';

export const DEFAULT_CLEANUP_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CollectionResult<T> {
	keep: T[];
	/** Ids to hand to `storage.remove`. */
	purge: string[];
}

/**
 * A closed record is the tombstone: it stays in storage with an honest
 * `updated`, so a merge sees it and cannot resurrect what was closed.
 * Physical deletion happens only here, and only once the record is older
 * than the window — which is therefore the longest two devices may stay
 * apart without losing a closure.
 *
 * Deliberately takes `now` rather than reading the clock: the rule has to
 * be deterministic, because both devices must reach the same answer.
 *
 * Collection never moves `updated`. It is not a user-facing change, and a
 * moved timestamp would hand the collecting device an unearned win in the
 * next merge simply for having started up.
 */
export function collectGarbage<T extends EntityBase>(
	records: T[],
	windowDays: number,
	now: Date,
): CollectionResult<T> {
	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const keep: T[] = [];
	const purge: string[] = [];

	for (const record of records) {
		const expired = record.status !== Status.Opened && Date.parse(record.updated) < cutoff;

		if (expired) {
			purge.push(record.id);
		} else {
			keep.push(record);
		}
	}

	return { keep, purge };
}

/**
 * A recurring task is always Opened, so the collector above never touches
 * it and its marks would grow without bound — a daily task over five years
 * is roughly 1800 entries, and the whole sync payload has to fit in 200 KB.
 *
 * Marks are pruned by `occurrence`, the date the mark is about, not by
 * `at`, the moment it was made.
 */
export function pruneCompletions(task: Task, windowDays: number, now: Date): Task {
	if (task.completions === undefined) {
		return task;
	}

	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const completions = task.completions.filter(
		(completion) => Date.parse(completion.occurrence) >= cutoff,
	);

	if (completions.length === task.completions.length) {
		return task;
	}

	return { ...task, completions };
}
