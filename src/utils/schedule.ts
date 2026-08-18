import { Frequency, RRule, Weekday, type Options } from 'rrule';

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

	if (opts.count !== undefined && opts.until !== undefined) {
		return undefined;
	}

	const end: RecurrenceRule['end'] =
		opts.count !== undefined
			? { type: 'count', count: opts.count }
			: opts.until !== undefined
				? { type: 'until', until: rruleDateToUntil(opts.until) }
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
