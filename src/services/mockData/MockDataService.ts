import type { AppLocale } from '@/i18n';
import {
	Season,
	type Completion,
	type Deadline,
	type Dream,
	type Goal,
	type Schedule,
	type Task,
} from '@/types';
import { pickRandom, sample } from '@/utils';
import { buildRRule, listOccurrences } from '@/utils/schedule';
import { POOLS } from './pools';
import {
	DREAM_TEMPLATES,
	GOAL_TEMPLATES,
	TASK_TEMPLATES,
	type DeadlineShape,
	type DreamTemplate,
	type GoalTemplate,
	type ScheduleKind,
	type TaskTemplate,
} from './templates';

export interface MockDataResult {
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/** How far back a completed/cancelled generated record's `occurrence` or
 *  `exdate` entries, and its own `updated`, are allowed to land -- see
 *  `buildTimestamps`'s doc comment for why 14 days is safe. */
const GC_SAFE_WINDOW_DAYS = 14;

function randomInt(min: number, max: number, random: () => number): number {
	return min + Math.floor(random() * (max - min + 1));
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

/**
 * Formats a real instant as a floating wall-clock string 'YYYY-MM-DDTHH:mm',
 * reading its UTC fields. This service always works in that UTC-encoded
 * wall-clock domain (mirroring `wallClockStringToDate`/`dateToWallClockString`
 * in `src/utils/schedule.ts`), so its own date arithmetic never depends on
 * the host machine's local time zone.
 */
function toWallClock(date: Date): string {
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * The inverse of `toWallClock`. Note this service's wall-clock strings
 * (`toWallClock`/`atFixedTime` output) ARE handed to
 * `src/utils/schedule.ts`'s `listOccurrences`, as `schedule.start` and
 * `schedule.exdate` -- and that function's `wallClockStringToDate` reads
 * them as UTC-encoded, not device-local. What's actually device-local there
 * is the *comparison point* derived from `now` (`deviceLocalWallClock`), so
 * returned occurrences can land up to the host's local UTC offset outside
 * the intended window. `withinLastDays` below -- not the schedule math --
 * is what actually enforces this service's GC-safety bound.
 */
function fromWallClock(wallClock: string): Date {
	return new Date(`${wallClock}Z`);
}

function addDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * MS_PER_DAY);
}

function atFixedTime(date: Date, hhmm: string): string {
	return `${toWallClock(date).slice(0, 10)}T${hhmm}`;
}

function withinLastDays(wallClock: string, now: Date, days: number): boolean {
	const delta = now.getTime() - fromWallClock(wallClock).getTime();
	return delta >= 0 && delta <= days * MS_PER_DAY;
}

/**
 * `updated` lands within the last ~11 days (0-10 days of jitter, plus up to
 * a day of minute-level jitter so records sharing a day-offset don't all
 * collide on the same instant) -- comfortably inside the 14-day GC-safety
 * margin every closed generated record needs (see `collectGarbage.ts`):
 * even the shortest `cleanupDays` (30) can't make a freshly generated
 * Done/Cancelled record eligible for purge. `created` always lands at or
 * before `updated`, and moves further back by 0-60 days from there.
 */
function buildTimestamps(now: Date, random: () => number): { created: string; updated: string } {
	const updated = new Date(
		now.getTime() -
			randomInt(0, 10, random) * MS_PER_DAY -
			randomInt(0, 1439, random) * MS_PER_MINUTE,
	);
	const created = new Date(updated.getTime() - randomInt(0, 60, random) * MS_PER_DAY);

	return { created: created.toISOString(), updated: updated.toISOString() };
}

const SEASONS = [Season.Winter, Season.Spring, Season.Summer, Season.Autumn];

function buildDeadline(
	shape: Exclude<DeadlineShape, 'none'>,
	now: Date,
	random: () => number,
): Deadline {
	const year = now.getUTCFullYear() + randomInt(0, 2, random);

	switch (shape) {
		case 'yearOnly':
			return { year };
		case 'yearSeason':
			return { year, season: pickRandom(SEASONS, random) };
		case 'yearMonth':
			return { year, month: randomInt(1, 12, random) };
		case 'yearMonthDay':
			return { year, month: randomInt(1, 12, random), day: randomInt(1, 28, random) };
	}
}

interface ScheduleBuildResult {
	schedule: Schedule | undefined;
	completions: Completion[] | undefined;
}

/**
 * Every recurring shape below reuses `buildRRule`/`listOccurrences` from
 * `src/utils/schedule.ts` rather than hand-typing an RRULE string or
 * fabricating an occurrence date -- a hand-typed `Completion.occurrence` or
 * `schedule.exdate` entry that doesn't actually come out of `listOccurrences`
 * would silently fail to match the schedule it claims to belong to.
 */
function buildSchedule(
	kind: Exclude<ScheduleKind, 'none'>,
	now: Date,
	random: () => number,
): ScheduleBuildResult {
	switch (kind) {
		case 'oneTimeFuture': {
			const start = atFixedTime(addDays(now, randomInt(1, 10, random)), '09:00');
			return { schedule: { start }, completions: undefined };
		}

		case 'oneTimePast': {
			const start = atFixedTime(addDays(now, -randomInt(1, 10, random)), '09:00');
			return { schedule: { start }, completions: undefined };
		}

		case 'recurringWeeklyWithCompletions': {
			// Mon/Wed/Fri, anchored ~3 weeks back so pastCount=6 has real
			// occurrences to pull. The 12-day span between the oldest and
			// newest of those 6 does NOT bound how old the oldest one is
			// relative to `now` -- the most recent occurrence can itself
			// already be a few days old. The `.filter(withinLastDays(...))`
			// below is what actually enforces the 14-day GC-safe window.
			const start = atFixedTime(addDays(now, -21), '09:00');
			const rrule = buildRRule({
				freq: 'weekly',
				interval: 1,
				byweekday: [1, 3, 5],
				end: { type: 'never' },
			});
			const schedule: Schedule = { start, rrule };

			const recent = listOccurrences(schedule, undefined, now, 6, 0).filter((entry) =>
				withinLastDays(entry.start, now, GC_SAFE_WINDOW_DAYS),
			);
			const completions: Completion[] = recent.slice(0, 2).map((entry) => ({
				occurrence: entry.start,
				done: true,
				at: new Date(
					fromWallClock(entry.start).getTime() + randomInt(1, 4, random) * MS_PER_HOUR,
				).toISOString(),
			}));

			return { schedule, completions: completions.length > 0 ? completions : undefined };
		}

		case 'recurringMonthlyNoCompletions': {
			const start = atFixedTime(addDays(now, -25), '09:00');
			const rrule = buildRRule({
				freq: 'monthly',
				interval: 1,
				end: { type: 'count', count: 6 },
			});
			return { schedule: { start, rrule }, completions: undefined };
		}

		case 'recurringWeeklyWithExdate': {
			// Saturdays only, anchored ~2.5 weeks back so at least the most
			// recent one or two Saturdays fall inside the 14-day window.
			const start = atFixedTime(addDays(now, -18), '09:00');
			const rrule = buildRRule({
				freq: 'weekly',
				interval: 1,
				byweekday: [6],
				end: { type: 'never' },
			});
			const schedule: Schedule = { start, rrule };

			const all = listOccurrences(schedule, undefined, now, 3, 0);
			const recent = all.filter((entry) => withinLastDays(entry.start, now, GC_SAFE_WINDOW_DAYS));
			const chosen = pickRandom(recent.length > 0 ? recent : all, random);

			return { schedule: { ...schedule, exdate: [chosen.start] }, completions: undefined };
		}
	}
}

function countNoteSlots(hasNote: { hasNote: boolean }[]): number {
	return hasNote.filter((entry) => entry.hasNote).length;
}

export class MockDataService {
	/**
	 * A pure function of `locale` and `options` -- no store, no clock, no RNG
	 * reached except through the two injectable hooks. `options.now`/`.random`
	 * exist so callers (and tests) can pin both; production code leaves them
	 * unset and gets the real clock and `Math.random`.
	 */
	generate(locale: AppLocale, options: { now?: Date; random?: () => number } = {}): MockDataResult {
		const now = options.now ?? new Date();
		const random = options.random ?? Math.random;
		const pool = POOLS[locale];

		const dreamNames = sample(pool.dreamNames, DREAM_TEMPLATES.length, random);
		const goalNames = sample(pool.goalNames, GOAL_TEMPLATES.length, random);
		const taskNames = sample(pool.taskNames, TASK_TEMPLATES.length, random);

		// One shared note pool, consumed in dream -> goal -> task order across
		// every `hasNote: true` slot in all three template arrays combined.
		const noteSlots =
			countNoteSlots(DREAM_TEMPLATES) +
			countNoteSlots(GOAL_TEMPLATES) +
			countNoteSlots(TASK_TEMPLATES);
		const notes = sample(pool.notes, noteSlots, random);
		let noteIndex = 0;
		const nextNote = (hasNote: boolean): string | undefined =>
			hasNote ? notes[noteIndex++] : undefined;

		const dreams: Dream[] = DREAM_TEMPLATES.map((template: DreamTemplate, index) => {
			const { created, updated } = buildTimestamps(now, random);
			return {
				id: crypto.randomUUID(),
				name: dreamNames[index],
				note: nextNote(template.hasNote),
				created,
				updated,
				status: template.status,
			};
		});

		const goals: Goal[] = GOAL_TEMPLATES.map((template: GoalTemplate, index) => {
			const { created, updated } = buildTimestamps(now, random);
			return {
				id: crypto.randomUUID(),
				name: goalNames[index],
				note: nextNote(template.hasNote),
				created,
				updated,
				status: template.status,
				dreamId: template.dreamIndex === undefined ? undefined : dreams[template.dreamIndex].id,
				deadline:
					template.deadlineShape === 'none'
						? undefined
						: buildDeadline(template.deadlineShape, now, random),
			};
		});

		const tasks: Task[] = TASK_TEMPLATES.map((template: TaskTemplate, index) => {
			const { created, updated } = buildTimestamps(now, random);
			const { schedule, completions } =
				template.scheduleKind === 'none'
					? { schedule: undefined, completions: undefined }
					: buildSchedule(template.scheduleKind, now, random);

			return {
				id: crypto.randomUUID(),
				name: taskNames[index],
				note: nextNote(template.hasNote),
				created,
				updated,
				status: template.status,
				goalId: template.goalIndex === undefined ? undefined : goals[template.goalIndex].id,
				important: template.important,
				urgent: template.urgent,
				schedule,
				completions,
			};
		});

		return { dreams, goals, tasks };
	}
}

export const mockDataService = new MockDataService();
