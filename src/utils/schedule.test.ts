import { describe, expect, it } from 'vitest';
import {
	buildRRule,
	durationBetween,
	endTimeFromDuration,
	formatWallClock,
	parseRRule,
} from './schedule';

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
