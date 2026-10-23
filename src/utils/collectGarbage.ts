import { Status, type ItemBase, type Task } from '@/types';

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
export function collectGarbage<T extends ItemBase>(
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
 *
 * Always returns a fresh object — never the original `task` reference —
 * even when there are no completions to look at or nothing gets pruned.
 * A caller that treats the result as an isolated copy, which the "does not
 * mutate its input" contract invites, must never end up aliasing the
 * original by accident.
 */
export function pruneCompletions(task: Task, windowDays: number, now: Date): Task {
	if (task.completions === undefined) {
		return { ...task };
	}

	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const completions = task.completions.filter(
		(completion) => Date.parse(completion.occurrence) >= cutoff,
	);

	return { ...task, completions };
}

/**
 * `schedule.exdate` grows the same way `completions` used to before
 * `pruneCompletions` existed -- skipping an occurrence writes to it, and a
 * long-running daily/weekly task with active skipping would otherwise grow
 * it without bound. Pruned by the excluded date itself, the same `cleanupDays`
 * window `pruneCompletions` already uses.
 */
export function pruneExdate(task: Task, windowDays: number, now: Date): Task {
	if (task.schedule?.exdate === undefined) {
		return { ...task };
	}

	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const exdate = task.schedule.exdate.filter((entry) => Date.parse(entry) >= cutoff);

	return {
		...task,
		schedule: { ...task.schedule, exdate: exdate.length > 0 ? exdate : undefined },
	};
}

/**
 * Both prunes above, for a task read from storage or received in a sync.
 * Unlike them, this one hands the original reference back when neither
 * completions nor exdate actually changed: the store uses reference identity
 * to tell "nothing to prune" from "rewrite this record".
 */
export function pruneTask(task: Task, windowDays: number, now: Date): Task {
	const afterCompletions = pruneCompletions(task, windowDays, now);
	const fullyPruned = pruneExdate(afterCompletions, windowDays, now);

	const unchanged =
		fullyPruned.completions?.length === task.completions?.length &&
		fullyPruned.schedule?.exdate?.length === task.schedule?.exdate?.length;

	return unchanged ? task : fullyPruned;
}
