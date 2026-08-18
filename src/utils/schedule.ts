import { Frequency, RRule, Weekday, type Options } from 'rrule';
import type { Completion, Schedule } from '@/types';

export interface RecurrenceRule {
	freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number;
	/** ISO weekday numbers, 1=Mon..7=Sun. Weekly only. */
	byweekday?: number[];
	end: { type: 'never' } | { type: 'count'; count: number } | { type: 'until'; until: string };
}

export interface OccurrenceWindow {
	/** Wall-clock start, 'YYYY-MM-DDTHH:mm'. */
	start: string;
	/** Wall-clock end, 'YYYY-MM-DDTHH:mm'. Equal to `start` when there's no duration. */
	end: string;
}

const FREQ_BY_KEY: Record<RecurrenceRule['freq'], Frequency> = {
	daily: RRule.DAILY,
	weekly: RRule.WEEKLY,
	monthly: RRule.MONTHLY,
	yearly: RRule.YEARLY,
};

const FREQ_BY_VALUE: Partial<Record<Frequency, RecurrenceRule['freq']>> = {
	[RRule.DAILY]: 'daily',
	[RRule.WEEKLY]: 'weekly',
	[RRule.MONTHLY]: 'monthly',
	[RRule.YEARLY]: 'yearly',
};

// rrule's Weekday.weekday is already ISO-ordered, 0-based: 0=Monday..6=Sunday.
const RRULE_WEEKDAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];

function isoToRRuleWeekday(iso: number): Weekday {
	return RRULE_WEEKDAYS[iso - 1];
}

/** A wall-clock date 'YYYY-MM-DD' encoded at 23:59, the way `RRule` expects
 *  its UTC-getter components to carry wall-clock numbers -- see `nextOccurrence`'s
 *  implementation note. 23:59 makes the picked date always fully included,
 *  regardless of `start`'s own time-of-day. */
function untilToRRuleDate(until: string): Date {
	const [year, month, day] = until.split('-').map(Number);
	return new Date(Date.UTC(year, month - 1, day, 23, 59));
}

function rruleDateToUntil(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/**
 * Deliberately never receives `dtstart` -- the day-of-month / month-and-day
 * for monthly/yearly presets come from `Schedule.start` implicitly (RFC5545:
 * no BYMONTHDAY on a MONTHLY rule means "same day-of-month as DTSTART"),
 * and dtstart lives separately in `Schedule.start`, not inside the RRULE
 * string itself (`Schedule.rrule`'s own doc comment: "RRULE without the
 * prefix").
 */
export function buildRRule(rule: RecurrenceRule): string {
	const options: Partial<Options> = {
		freq: FREQ_BY_KEY[rule.freq],
		interval: rule.interval,
	};

	if (rule.freq === 'weekly' && rule.byweekday !== undefined) {
		options.byweekday = rule.byweekday.map(isoToRRuleWeekday);
	}

	if (rule.end.type === 'count') {
		options.count = rule.end.count;
	} else if (rule.end.type === 'until') {
		options.until = untilToRRuleDate(rule.end.until);
	}

	return new RRule(options).toString().replace(/^RRULE:/, '');
}

/**
 * Returns `undefined` when `rrule` doesn't match the shape any preset could
 * have produced (multiple `BYMONTHDAY`, `BYSETPOS`, `BYYEARDAY`, `BYMONTH`,
 * an explicit `BYHOUR`/`BYMINUTE`, a non-default `WKST`, or BYDAY entries
 * like "2nd Tuesday") -- callers treat that as a safety-net "custom rule"
 * case, not an error.
 */
export function parseRRule(rrule: string): RecurrenceRule | undefined {
	let parsed: RRule;
	try {
		parsed = RRule.fromString(rrule);
	} catch {
		return undefined;
	}

	const opts = parsed.origOptions;
	const freq = opts.freq === undefined ? undefined : FREQ_BY_VALUE[opts.freq];
	if (freq === undefined) {
		return undefined;
	}

	if (
		opts.bymonthday !== undefined ||
		opts.bysetpos !== undefined ||
		opts.byyearday !== undefined ||
		opts.bymonth !== undefined ||
		opts.byhour !== undefined ||
		opts.byminute !== undefined ||
		opts.wkst !== undefined ||
		(opts.byweekday !== undefined && freq !== 'weekly')
	) {
		return undefined;
	}

	let byweekday: number[] | undefined;
	if (freq === 'weekly') {
		if (opts.byweekday === undefined || opts.byweekday === null) {
			return undefined;
		}

		const days = Array.isArray(opts.byweekday) ? opts.byweekday : [opts.byweekday];
		if (days.length === 0 || days.some((day) => !(day instanceof Weekday) || day.n !== undefined)) {
			return undefined;
		}

		byweekday = days.map((day) => (day as Weekday).weekday + 1);
	}

	const count = opts.count ?? undefined;
	const until = opts.until ?? undefined;

	if (count !== undefined && until !== undefined) {
		return undefined;
	}

	const end: RecurrenceRule['end'] =
		count !== undefined
			? { type: 'count', count }
			: until !== undefined
				? { type: 'until', until: rruleDateToUntil(until) }
				: { type: 'never' };

	return { freq, interval: opts.interval ?? 1, byweekday, end };
}

const DURATION_PATTERN = /^PT(?:(\d+)H)?(?:(\d+)M)?$/;

function minutesOfDay(hhmm: string): number {
	const [hour, minute] = hhmm.split(':').map(Number);
	return hour * 60 + minute;
}

export function durationBetween(start: string, endTime: string): string | undefined {
	const total = minutesOfDay(endTime) - minutesOfDay(start.slice(11));
	if (total <= 0) {
		return undefined;
	}

	const hours = Math.floor(total / 60);
	const minutes = total % 60;
	return `PT${hours > 0 ? `${hours}H` : ''}${minutes > 0 ? `${minutes}M` : ''}`;
}

export function endTimeFromDuration(start: string, duration: string): string {
	const match = DURATION_PATTERN.exec(duration);
	const hours = Number(match?.[1] ?? 0);
	const minutes = Number(match?.[2] ?? 0);
	const total = (minutesOfDay(start.slice(11)) + hours * 60 + minutes) % (24 * 60);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** `timeZone: 'UTC'` reads the wall-clock numbers directly, regardless of
 *  the host's own timezone -- see the file-level note on `nextOccurrence`. */
export function formatWallClock(wallClock: string, locale: string): string {
	const [datePart, timePart] = wallClock.split('T');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hour, minute] = timePart.split(':').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'UTC',
	}).format(date);
}

type Translate = (
	key: string,
	named?: Record<string, unknown>,
	options?: { plural?: number },
) => string;

const FREQ_KEYS: Record<RecurrenceRule['freq'], string> = {
	daily: 'task.schedule.recurrence.daily',
	weekly: 'task.schedule.recurrence.weekly',
	monthly: 'task.schedule.recurrence.monthly',
	yearly: 'task.schedule.recurrence.yearly',
};

/** ISO weekday numbers, 1=Mon..7=Sun. 2000-01-03 is a Monday -- a stable
 *  anchor for reading weekday names back out regardless of today's date. */
export function weekdayName(iso: number, locale: string): string {
	const date = new Date(Date.UTC(2000, 0, 3 + (iso - 1)));
	return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
}

function formatUntilDate(until: string, locale: string): string {
	const [year, month, day] = until.split('-').map(Number);
	return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(
		new Date(Date.UTC(year, month - 1, day)),
	);
}

export function describeRecurrence(rule: RecurrenceRule, t: Translate, locale: string): string {
	const parts = [t(FREQ_KEYS[rule.freq], { n: rule.interval }, { plural: rule.interval })];

	if (rule.freq === 'weekly' && rule.byweekday !== undefined && rule.byweekday.length > 0) {
		const days = rule.byweekday
			.slice()
			.sort((a, b) => a - b)
			.map((iso) => weekdayName(iso, locale))
			.join(', ');
		parts.push(t('task.schedule.recurrence.onDays', { days }));
	}

	if (rule.end.type === 'count') {
		parts.push(
			t(
				'task.schedule.recurrence.endAfterCount',
				{ n: rule.end.count },
				{ plural: rule.end.count },
			),
		);
	} else if (rule.end.type === 'until') {
		parts.push(
			t('task.schedule.recurrence.endUntil', { date: formatUntilDate(rule.end.until, locale) }),
		);
	}

	return parts.join(', ');
}

function wallClockStringToDate(wallClock: string): Date {
	const [datePart, timePart] = wallClock.split('T');
	const [year, month, day] = datePart.split('-').map(Number);
	const [hour, minute] = timePart.split(':').map(Number);
	return new Date(Date.UTC(year, month - 1, day, hour, minute));
}

function dateToWallClockString(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** The device's own current wall-clock reading, encoded the same way a
 *  floating schedule's occurrences are -- a floating time has no zone, so
 *  "is the next occurrence upcoming" is answered from this device's own
 *  clock, not from a real UTC instant. */
function deviceLocalWallClock(instant: Date): Date {
	return new Date(
		Date.UTC(
			instant.getFullYear(),
			instant.getMonth(),
			instant.getDate(),
			instant.getHours(),
			instant.getMinutes(),
		),
	);
}

/**
 * What wall-clock time `instant` (a real moment) shows in `tzid`, encoded
 * the same way `wallClockStringToDate` encodes a floating time.
 *
 * This project never passes `tzid` to `RRule`'s own constructor option.
 * Verified against the installed rrule 2.8.1
 * (`node_modules/rrule/dist/esm/dateutil.js`'s `dateInTimeZone`): its native
 * `tzid` support computes the anchor offset via
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` -- the *host machine's*
 * own system zone, not the schedule's `tzid` -- and shifts every occurrence
 * by the difference between the two. On a host whose own zone isn't UTC
 * (confirmed on Europe/Warsaw against a schedule anchored to
 * America/New_York), every anchored occurrence comes out wrong by a
 * host-dependent amount, DST transition included. RRULE iteration below
 * therefore always happens in the tzid-oblivious wall-clock-encoded domain;
 * this function is the only place `tzid` is applied, entirely by hand via
 * `Intl.DateTimeFormat`.
 */
function instantAsWallClockInZone(instant: Date, tzid: string): Date {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: tzid,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(instant);
	const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);

	return new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')));
}

function addDurationToWallClock(wallClock: Date, duration: string): Date {
	const match = DURATION_PATTERN.exec(duration);
	if (match === null) {
		return wallClock;
	}

	const hours = Number(match[1] ?? 0);
	const minutes = Number(match[2] ?? 0);
	return new Date(wallClock.getTime() + (hours * 60 + minutes) * 60_000);
}

function buildRule(schedule: Schedule): RRule {
	const parsedRRule: Partial<Options> = { ...RRule.parseString(schedule.rrule as string) };
	delete parsedRRule.tzid;
	delete parsedRRule.dtstart;
	return new RRule({ ...parsedRRule, dtstart: wallClockStringToDate(schedule.start) });
}

/**
 * `comparisonPoint` must already be in the wall-clock-as-UTC encoded domain
 * `wallClockStringToDate`/`dtstart` use -- callers holding a real moment
 * convert first (see `nextOccurrence`); callers already holding a wall-clock
 * occurrence (`isLastOccurrence`, `listOccurrences`) pass it straight
 * through. Honors `schedule.exdate` (skipped, the walk continues past it)
 * and `schedule.rdate` (considered as an extra standalone candidate).
 */
function walkOccurrence(
	schedule: Schedule,
	comparisonPoint: Date,
	direction: 'after' | 'before',
): Date | undefined {
	const excluded = new Set(schedule.exdate ?? []);
	const rule = buildRule(schedule);

	let candidate: Date | null =
		direction === 'after' ? rule.after(comparisonPoint, true) : rule.before(comparisonPoint, true);
	while (candidate !== null && excluded.has(dateToWallClockString(candidate))) {
		candidate =
			direction === 'after' ? rule.after(candidate, false) : rule.before(candidate, false);
	}

	const rdateMatch = (schedule.rdate ?? [])
		.filter((entry) => !excluded.has(entry))
		.map(wallClockStringToDate)
		.filter((date) =>
			direction === 'after'
				? date.getTime() >= comparisonPoint.getTime()
				: date.getTime() <= comparisonPoint.getTime(),
		)
		.reduce<Date | undefined>((best, date) => {
			if (best === undefined) {
				return date;
			}
			const better =
				direction === 'after' ? date.getTime() < best.getTime() : date.getTime() > best.getTime();
			return better ? date : best;
		}, undefined);

	if (candidate === null) {
		return rdateMatch;
	}
	if (rdateMatch === undefined) {
		return candidate;
	}

	const rdateWins =
		direction === 'after'
			? rdateMatch.getTime() < candidate.getTime()
			: rdateMatch.getTime() > candidate.getTime();
	return rdateWins ? rdateMatch : candidate;
}

export function nextOccurrence(schedule: Schedule, from: Date): OccurrenceWindow | undefined {
	if (schedule.rrule === undefined) {
		return undefined;
	}

	const comparisonPoint =
		schedule.tzid === undefined
			? deviceLocalWallClock(from)
			: instantAsWallClockInZone(from, schedule.tzid);

	const next = walkOccurrence(schedule, comparisonPoint, 'after');
	if (next === undefined) {
		return undefined;
	}

	const start = dateToWallClockString(next);
	const end =
		schedule.duration === undefined
			? start
			: dateToWallClockString(addDurationToWallClock(next, schedule.duration));

	return { start, end };
}

/**
 * Whether `occurrence` is the last one a bounded (`COUNT`- or `UNTIL`-ended)
 * series will ever produce. Answered empirically -- probing one minute past
 * `occurrence` for a following one -- rather than by re-deriving COUNT/UNTIL
 * arithmetic; occurrences are minute-granularity (`WALL_CLOCK_PATTERN` in
 * `src/types/task.ts` has no seconds), so one minute strictly clears any
 * occurrence this schedule itself produces. Correctly accounts for `exdate`
 * since `walkOccurrence` already skips excluded dates.
 */
export function isLastOccurrence(schedule: Schedule, occurrence: string): boolean {
	if (schedule.rrule === undefined) {
		return false;
	}

	const probe = new Date(wallClockStringToDate(occurrence).getTime() + 60_000);
	return walkOccurrence(schedule, probe, 'after') === undefined;
}

export interface OccurrenceEntry {
	/** Wall-clock start -- the same value `Completion.occurrence` keys on. */
	start: string;
	end: string;
	state: 'pending' | 'done' | 'skipped';
}

function rawCandidates(
	schedule: Schedule,
	comparisonPoint: Date,
	direction: 'after' | 'before',
	count: number,
): Date[] {
	const rule = buildRule(schedule);
	const result: Date[] = [];
	let cursor = comparisonPoint;
	let inclusive = direction === 'after';

	for (let i = 0; i < count; i += 1) {
		const next =
			direction === 'after' ? rule.after(cursor, inclusive) : rule.before(cursor, inclusive);
		if (next === null) {
			break;
		}
		result.push(next);
		cursor = next;
		inclusive = false;
	}

	return result;
}

function occurrenceState(
	occurrence: string,
	schedule: Schedule,
	completions: Completion[] | undefined,
): OccurrenceEntry['state'] {
	if (schedule.exdate?.includes(occurrence)) {
		return 'skipped';
	}

	const completion = completions?.find((entry) => entry.occurrence === occurrence);
	return completion?.done === true ? 'done' : 'pending';
}

/**
 * Never filters by `exdate` -- it tags. `nextOccurrence` must skip an
 * excluded date entirely (it really doesn't happen); this function answers
 * "what can the user act on," and a skipped occurrence has to stay on
 * screen with an un-skip affordance, or skipping would be irreversible
 * through this UI.
 */
export function listOccurrences(
	schedule: Schedule,
	completions: Completion[] | undefined,
	from: Date,
	pastCount: number,
	futureCount: number,
): OccurrenceEntry[] {
	if (schedule.rrule === undefined) {
		return [];
	}

	const comparisonPoint =
		schedule.tzid === undefined
			? deviceLocalWallClock(from)
			: instantAsWallClockInZone(from, schedule.tzid);

	const rdateDates = (schedule.rdate ?? []).map(wallClockStringToDate);

	function windowSide(direction: 'after' | 'before', count: number): Date[] {
		const fromRule = rawCandidates(schedule, comparisonPoint, direction, count);
		const fromRdate = rdateDates.filter((date) =>
			direction === 'after'
				? date.getTime() >= comparisonPoint.getTime()
				: date.getTime() < comparisonPoint.getTime(),
		);

		const merged = [...fromRule, ...fromRdate]
			.sort((a, b) => a.getTime() - b.getTime())
			.filter((date, index, all) => index === 0 || date.getTime() !== all[index - 1].getTime());

		return direction === 'after' ? merged.slice(0, count) : count === 0 ? [] : merged.slice(-count);
	}

	const past = windowSide('before', pastCount);
	const future = windowSide('after', futureCount);

	return [...past, ...future]
		.sort((a, b) => a.getTime() - b.getTime())
		.map((date) => {
			const start = dateToWallClockString(date);
			const end =
				schedule.duration === undefined
					? start
					: dateToWallClockString(addDurationToWallClock(date, schedule.duration));
			return { start, end, state: occurrenceState(start, schedule, completions) };
		});
}
