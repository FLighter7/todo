import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
	buildRRule,
	durationBetween,
	endTimeFromDuration,
	formatWallClock,
	parseRRule,
	describeRecurrence,
	weekdayName,
} from './schedule';
import { i18n } from '@/i18n';
import type { Schedule } from '@/types';
import { isLastOccurrence, nextOccurrence } from './schedule';

const t = i18n.global.t;
const originalLocale = i18n.global.locale.value;

describe('buildRRule / parseRRule round-trip', () => {
	it('round-trips daily, never-ending, interval 1', () => {
		const rule = buildRRule({ freq: 'daily', interval: 1, end: { type: 'never' } });
		expect(parseRRule(rule)).toEqual({
			freq: 'daily',
			interval: 1,
			byweekday: undefined,
			end: { type: 'never' },
		});
	});

	it('round-trips daily with a non-default interval', () => {
		const rule = buildRRule({ freq: 'daily', interval: 3, end: { type: 'never' } });
		expect(parseRRule(rule)).toEqual({
			freq: 'daily',
			interval: 3,
			byweekday: undefined,
			end: { type: 'never' },
		});
	});

	it('round-trips weekly with specific weekdays', () => {
		const rule = buildRRule({
			freq: 'weekly',
			interval: 2,
			byweekday: [1, 3, 5],
			end: { type: 'never' },
		});
		expect(parseRRule(rule)).toEqual({
			freq: 'weekly',
			interval: 2,
			byweekday: [1, 3, 5],
			end: { type: 'never' },
		});
	});

	it('round-trips monthly, ending after a count', () => {
		const rule = buildRRule({ freq: 'monthly', interval: 1, end: { type: 'count', count: 6 } });
		expect(parseRRule(rule)).toEqual({
			freq: 'monthly',
			interval: 1,
			byweekday: undefined,
			end: { type: 'count', count: 6 },
		});
	});

	it('round-trips yearly, ending on a date', () => {
		const rule = buildRRule({
			freq: 'yearly',
			interval: 1,
			end: { type: 'until', until: '2030-06-15' },
		});
		expect(parseRRule(rule)).toEqual({
			freq: 'yearly',
			interval: 1,
			byweekday: undefined,
			end: { type: 'until', until: '2030-06-15' },
		});
	});
});

describe('parseRRule rejecting rules no preset can build', () => {
	it('rejects BYSETPOS', () => {
		expect(parseRRule('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=1')).toBeUndefined();
	});

	it('rejects multiple BYMONTHDAY', () => {
		expect(parseRRule('FREQ=MONTHLY;BYMONTHDAY=15,20')).toBeUndefined();
	});

	it('rejects BYYEARDAY', () => {
		expect(parseRRule('FREQ=YEARLY;BYYEARDAY=100')).toBeUndefined();
	});

	it('rejects an unparseable string entirely', () => {
		expect(parseRRule('not a rule')).toBeUndefined();
	});

	it('rejects a weekly rule with no BYDAY at all', () => {
		expect(parseRRule('FREQ=WEEKLY')).toBeUndefined();
	});
});

describe('durationBetween', () => {
	it('computes hours and minutes between start and an end time the same day', () => {
		expect(durationBetween('2026-08-21T09:00', '13:30')).toBe('PT4H30M');
	});

	it('omits the minutes component when the difference is a whole number of hours', () => {
		expect(durationBetween('2026-08-21T09:00', '11:00')).toBe('PT2H');
	});

	it('omits the hours component when the difference is under an hour', () => {
		expect(durationBetween('2026-08-21T09:00', '09:45')).toBe('PT45M');
	});

	it('returns undefined when the end time is not after the start time', () => {
		expect(durationBetween('2026-08-21T09:00', '09:00')).toBeUndefined();
		expect(durationBetween('2026-08-21T09:00', '08:00')).toBeUndefined();
	});
});

describe('endTimeFromDuration', () => {
	it('inverts durationBetween', () => {
		expect(endTimeFromDuration('2026-08-21T09:00', 'PT4H30M')).toBe('13:30');
		expect(endTimeFromDuration('2026-08-21T09:00', 'PT2H')).toBe('11:00');
		expect(endTimeFromDuration('2026-08-21T09:00', 'PT45M')).toBe('09:45');
	});
});

describe('formatWallClock', () => {
	it('formats the literal wall-clock numbers regardless of host timezone', () => {
		expect(formatWallClock('2026-08-21T09:00', 'en')).toBe('Aug 21, 2026, 9:00 AM');
	});

	it('formats in a different locale', () => {
		expect(formatWallClock('2026-08-21T09:00', 'ru')).toBe('21 авг. 2026 г., 09:00');
	});
});

describe('describeRecurrence', () => {
	beforeEach(() => {
		i18n.global.locale.value = 'en';
	});

	afterEach(() => {
		i18n.global.locale.value = originalLocale;
	});

	it('describes a plain daily rule', () => {
		expect(
			describeRecurrence({ freq: 'daily', interval: 1, end: { type: 'never' } }, t, 'en'),
		).toBe('Every day');
	});

	it('pluralizes the interval in English', () => {
		expect(
			describeRecurrence({ freq: 'daily', interval: 3, end: { type: 'never' } }, t, 'en'),
		).toBe('Every 3 days');
	});

	it('pluralizes the interval in Russian across all three forms', () => {
		i18n.global.locale.value = 'ru';
		expect(
			describeRecurrence(
				{ freq: 'weekly', interval: 1, byweekday: [5], end: { type: 'never' } },
				t,
				'ru',
			),
		).toBe('Каждую неделю, по пт');
		expect(
			describeRecurrence(
				{ freq: 'weekly', interval: 2, byweekday: [5], end: { type: 'never' } },
				t,
				'ru',
			),
		).toBe('Каждые 2 недели, по пт');
		expect(
			describeRecurrence(
				{ freq: 'weekly', interval: 5, byweekday: [5], end: { type: 'never' } },
				t,
				'ru',
			),
		).toBe('Каждые 5 недель, по пт');
	});

	it('lists multiple weekdays in ISO order', () => {
		expect(
			describeRecurrence(
				{ freq: 'weekly', interval: 1, byweekday: [5, 1, 3], end: { type: 'never' } },
				t,
				'en',
			),
		).toBe('Every week, on Mon, Wed, Fri');
	});

	it('appends an occurrence count, pluralized', () => {
		expect(
			describeRecurrence(
				{ freq: 'monthly', interval: 1, end: { type: 'count', count: 1 } },
				t,
				'en',
			),
		).toBe('Every month, 1 time');
		expect(
			describeRecurrence(
				{ freq: 'monthly', interval: 1, end: { type: 'count', count: 6 } },
				t,
				'en',
			),
		).toBe('Every month, 6 times');
	});

	it('appends an until date', () => {
		expect(
			describeRecurrence(
				{ freq: 'yearly', interval: 1, end: { type: 'until', until: '2030-06-15' } },
				t,
				'en',
			),
		).toBe('Every year, until Jun 15, 2030');
	});
});

describe('weekdayName', () => {
	beforeEach(() => {
		i18n.global.locale.value = 'en';
	});

	afterEach(() => {
		i18n.global.locale.value = originalLocale;
	});

	it('reads back short weekday names in order, regardless of the current date', () => {
		expect([1, 2, 3, 4, 5, 6, 7].map((iso) => weekdayName(iso, 'en'))).toEqual([
			'Mon',
			'Tue',
			'Wed',
			'Thu',
			'Fri',
			'Sat',
			'Sun',
		]);
	});
});

describe('nextOccurrence, floating (no tzid)', () => {
	it('returns the next weekly occurrence after "from", using the device-local reading of "from"', () => {
		const schedule: Schedule = { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		// A Saturday, the day after the first Friday occurrence.
		const from = new Date('2026-08-22T00:00:00Z');

		expect(nextOccurrence(schedule, from)).toEqual({
			start: '2026-08-28T09:00',
			end: '2026-08-28T09:00',
		});
	});

	it('is inclusive: "from" landing exactly on an occurrence returns that occurrence', () => {
		const schedule: Schedule = { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const from = new Date(2026, 7, 21, 9, 0);

		expect(nextOccurrence(schedule, from)?.start).toBe('2026-08-21T09:00');
	});

	it('applies duration to the returned window', () => {
		const schedule: Schedule = {
			start: '2026-08-21T09:00',
			duration: 'PT4H',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
		};
		const from = new Date('2026-08-22T00:00:00Z');

		expect(nextOccurrence(schedule, from)).toEqual({
			start: '2026-08-28T09:00',
			end: '2026-08-28T13:00',
		});
	});

	it('returns undefined once a COUNT-bounded rule is exhausted', () => {
		const schedule: Schedule = { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=1' };
		const from = new Date('2030-01-01T00:00:00Z');

		expect(nextOccurrence(schedule, from)).toBeUndefined();
	});

	it('returns undefined when the schedule has no rrule at all', () => {
		expect(nextOccurrence({ start: '2026-08-21T09:00' }, new Date())).toBeUndefined();
	});
});

describe('nextOccurrence, anchored to a tzid', () => {
	it('keeps the local wall-clock time fixed across a DST transition, independent of the host timezone', () => {
		// Weekly Friday 09:00 in America/New_York, crossing the 2026-03-08
		// US spring-forward. Every occurrence must read 09:00 local in New
		// York, regardless of what timezone the test runner itself is in.
		const schedule: Schedule = {
			start: '2026-02-27T09:00',
			tzid: 'America/New_York',
			rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=4',
		};

		const results = [
			new Date('2026-02-20T00:00:00Z'),
			new Date('2026-03-01T00:00:00Z'),
			new Date('2026-03-08T00:00:00Z'),
			new Date('2026-03-15T00:00:00Z'),
		].map((from) => nextOccurrence(schedule, from)?.start);

		expect(results).toEqual([
			'2026-02-27T09:00',
			'2026-03-06T09:00',
			'2026-03-13T09:00',
			'2026-03-20T09:00',
		]);
	});

	it('ignores a DTSTART;TZID line embedded in the rrule string, using schedule.tzid/schedule.start instead', () => {
		// A hand-edited or imported record could carry a DTSTART;TZID line
		// inside schedule.rrule even though this app's own writers never
		// produce one (Schedule.rrule is "RRULE without the prefix", and
		// dtstart lives in Schedule.start). If RRule.parseString's leaked
		// tzid/dtstart reached RRule's own constructor unfiltered, every
		// occurrence below would be corrupted by the Asia/Tokyo-vs-host-zone
		// shift nextOccurrence's own comment documents -- the results must
		// come out identical to the plain-rrule-string case above.
		const schedule: Schedule = {
			start: '2026-02-27T09:00',
			tzid: 'America/New_York',
			rrule: 'DTSTART;TZID=Asia/Tokyo:20260227T090000\nFREQ=WEEKLY;BYDAY=FR;COUNT=4',
		};

		const results = [
			new Date('2026-02-20T00:00:00Z'),
			new Date('2026-03-01T00:00:00Z'),
			new Date('2026-03-08T00:00:00Z'),
			new Date('2026-03-15T00:00:00Z'),
		].map((from) => nextOccurrence(schedule, from)?.start);

		expect(results).toEqual([
			'2026-02-27T09:00',
			'2026-03-06T09:00',
			'2026-03-13T09:00',
			'2026-03-20T09:00',
		]);
	});

	it('resolves to the correct UTC instant on both sides of the transition', () => {
		const schedule: Schedule = {
			start: '2026-02-27T09:00',
			tzid: 'America/New_York',
			rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=4',
		};

		// Before the transition: EST, UTC-5, so 09:00 local is 14:00 UTC.
		const before = nextOccurrence(schedule, new Date('2026-03-01T00:00:00Z'));
		expect(
			new Intl.DateTimeFormat('en-US', {
				timeZone: 'UTC',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
			}).format(new Date(`${before?.start}:00-05:00`)),
		).toBe('14:00');

		// After the transition: EDT, UTC-4, so 09:00 local is 13:00 UTC.
		const after = nextOccurrence(schedule, new Date('2026-03-15T00:00:00Z'));
		expect(
			new Intl.DateTimeFormat('en-US', {
				timeZone: 'UTC',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
			}).format(new Date(`${after?.start}:00-04:00`)),
		).toBe('13:00');
	});
});

describe('nextOccurrence, exdate and rdate', () => {
	it('skips an excluded date and returns the following occurrence', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			exdate: ['2026-08-14T09:00'],
		};
		const from = new Date('2026-08-08T00:00:00Z');

		expect(nextOccurrence(schedule, from)?.start).toBe('2026-08-21T09:00');
	});

	it('considers an rdate entry when it is the nearest candidate', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			rdate: ['2026-08-10T09:00'],
		};
		const from = new Date('2026-08-08T00:00:00Z');

		expect(nextOccurrence(schedule, from)?.start).toBe('2026-08-10T09:00');
	});

	it('falls back to the rrule candidate when the rdate entry is farther away', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			rdate: ['2026-09-01T09:00'],
		};
		const from = new Date('2026-08-08T00:00:00Z');

		expect(nextOccurrence(schedule, from)?.start).toBe('2026-08-14T09:00');
	});
});

describe('isLastOccurrence', () => {
	it('is true for the final occurrence of a COUNT-bounded rule', () => {
		const schedule: Schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3' };

		expect(isLastOccurrence(schedule, '2026-08-21T09:00')).toBe(true);
	});

	it('is false for an earlier occurrence of the same rule', () => {
		const schedule: Schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3' };

		expect(isLastOccurrence(schedule, '2026-08-14T09:00')).toBe(false);
	});

	it('is false for an unbounded rule', () => {
		const schedule: Schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };

		expect(isLastOccurrence(schedule, '2026-08-21T09:00')).toBe(false);
	});

	it('is false when the schedule has no rrule at all', () => {
		expect(isLastOccurrence({ start: '2026-08-07T09:00' }, '2026-08-07T09:00')).toBe(false);
	});

	it('is true once exdate excludes what would otherwise be a later occurrence', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3',
			exdate: ['2026-08-21T09:00'],
		};

		expect(isLastOccurrence(schedule, '2026-08-14T09:00')).toBe(true);
	});
});
