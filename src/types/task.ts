import { RRule } from 'rrule';
import {
	fail,
	isRecordObject,
	parseEntityBase,
	readBoolean,
	readOptionalString,
	readString,
	type EntityBase,
} from './entity';

/**
 * A miniature VEVENT: exactly the RFC 5545 fields a task needs.
 *
 * The completion window is `start` + `duration`, the way iCalendar spells
 * DTSTART + DURATION — so "every Friday 09:00–13:00" and "between the 10th
 * and the 15th" are the same shape, and a one-time deadline is just the end
 * of the window.
 */
export interface Schedule {
	/** Wall-clock time, 'YYYY-MM-DDTHH:mm'. Never UTC. */
	start: string;
	/** IANA zone when the rule is anchored to one. Absent means floating. */
	tzid?: string;
	/** ISO 8601 duration of the window: 'PT4H', 'P6D'. Absent means an instant. */
	duration?: string;
	/** RRULE without the prefix: 'FREQ=WEEKLY;BYDAY=FR'. Absent means one-time. */
	rrule?: string;
	/** EXDATE: skipped occurrences, in the same format as start. */
	exdate?: string[];
	/** RDATE: extra one-off occurrences. */
	rdate?: string[];
}

export interface Completion {
	/** The occurrence's wall-clock start — the merge key. */
	occurrence: string;
	done: boolean;
	/** ISO 8601 UTC of when the mark was set. Decides the winner per occurrence. */
	at: string;
}

export interface Task extends EntityBase {
	goalId?: string;
	important: boolean;
	urgent: boolean;
	schedule?: Schedule;
	completions?: Completion[];
}

/**
 * Never stored: two fields encoding the same fact drift apart eventually.
 * A task is one-time when it has no rule, or a rule that fires once.
 */
export function isPeriodic(task: Task): boolean {
	const rule = task.schedule?.rrule;
	if (rule === undefined) {
		return false;
	}

	return RRule.fromString(rule).origOptions.count !== 1;
}

function parseStringArray(value: unknown, key: string): string[] | undefined {
	if (value === undefined) {
		return undefined;
	}

	if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
		fail(`"${key}" must be an array of strings when present`);
	}

	return value as string[];
}

export function parseSchedule(value: unknown): Schedule {
	if (!isRecordObject(value)) {
		fail('"schedule" must be an object');
	}

	const tzid = readOptionalString(value, 'tzid');
	if (tzid !== undefined) {
		// The same Intl that renders the zone decides whether it exists.
		try {
			new Intl.DateTimeFormat('en', { timeZone: tzid });
		} catch {
			fail(`"schedule.tzid" is not a known time zone: ${tzid}`);
		}
	}

	const rule = readOptionalString(value, 'rrule');
	if (rule !== undefined) {
		try {
			RRule.fromString(rule);
		} catch {
			fail(`"schedule.rrule" is not a valid recurrence rule: ${rule}`);
		}
	}

	return {
		start: readString(value, 'start'),
		tzid,
		duration: readOptionalString(value, 'duration'),
		rrule: rule,
		exdate: parseStringArray(value.exdate, 'schedule.exdate'),
		rdate: parseStringArray(value.rdate, 'schedule.rdate'),
	};
}

export function parseCompletion(value: unknown): Completion {
	if (!isRecordObject(value)) {
		fail('"completions" must contain objects');
	}

	return {
		occurrence: readString(value, 'occurrence'),
		done: readBoolean(value, 'done'),
		at: readString(value, 'at'),
	};
}

export function parseTask(value: unknown): Task {
	const base = parseEntityBase(value);
	const entry = value as Record<string, unknown>;

	const goalId = entry.goalId;
	if (goalId !== undefined && typeof goalId !== 'string') {
		fail('"goalId" must be a string when present');
	}

	let completions: Completion[] | undefined;
	if (entry.completions !== undefined) {
		if (!Array.isArray(entry.completions)) {
			fail('"completions" must be an array when present');
		}
		completions = entry.completions.map(parseCompletion);
	}

	return {
		...base,
		goalId,
		important: readBoolean(entry, 'important'),
		urgent: readBoolean(entry, 'urgent'),
		schedule: entry.schedule === undefined ? undefined : parseSchedule(entry.schedule),
		completions,
	};
}
