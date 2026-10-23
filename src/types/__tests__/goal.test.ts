import { describe, expect, it } from 'vitest';
import { ItemFormatError, Status } from '../item';
import { Season, isSeason, parseGoal } from '../goal';

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('isSeason', () => {
	it('accepts every declared member', () => {
		expect(isSeason(Season.Winter)).toBe(true);
		expect(isSeason(Season.Autumn)).toBe(true);
	});

	it('rejects anything else', () => {
		expect(isSeason(0)).toBe(false);
		expect(isSeason(5)).toBe(false);
		expect(isSeason('2')).toBe(false);
	});
});

describe('parseGoal', () => {
	it('parses a goal with no dream and no deadline', () => {
		const goal = parseGoal(makeRaw());

		expect(goal.dreamId).toBeUndefined();
		expect(goal.deadline).toBeUndefined();
	});

	it('keeps the dream link', () => {
		expect(parseGoal(makeRaw({ dreamId: 'dream-1' })).dreamId).toBe('dream-1');
	});

	it('rejects a non-string dreamId', () => {
		expect(() => parseGoal(makeRaw({ dreamId: 42 }))).toThrow(ItemFormatError);
	});

	it('accepts every valid deadline shape', () => {
		const shapes = [
			{ year: 2027 },
			{ year: 2027, season: Season.Summer },
			{ year: 2027, month: 3 },
			{ year: 2027, month: 3, day: 15 },
			{ month: 3 },
			{ season: Season.Winter },
		];

		for (const deadline of shapes) {
			expect(parseGoal(makeRaw({ deadline })).deadline).toEqual(deadline);
		}
	});

	it('rejects a day without a month', () => {
		expect(() => parseGoal(makeRaw({ deadline: { year: 2027, day: 15 } }))).toThrow(
			ItemFormatError,
		);
	});

	it('rejects a month and a season together', () => {
		expect(() =>
			parseGoal(makeRaw({ deadline: { year: 2027, month: 3, season: Season.Summer } })),
		).toThrow(ItemFormatError);
	});

	it('rejects an empty deadline', () => {
		expect(() => parseGoal(makeRaw({ deadline: {} }))).toThrow(ItemFormatError);
	});

	it('rejects out-of-range months and days', () => {
		expect(() => parseGoal(makeRaw({ deadline: { month: 0 } }))).toThrow(ItemFormatError);
		expect(() => parseGoal(makeRaw({ deadline: { month: 13 } }))).toThrow(ItemFormatError);
		expect(() => parseGoal(makeRaw({ deadline: { month: 3, day: 0 } }))).toThrow(ItemFormatError);
		expect(() => parseGoal(makeRaw({ deadline: { month: 3, day: 32 } }))).toThrow(ItemFormatError);
	});

	it('rejects a non-integer year', () => {
		expect(() => parseGoal(makeRaw({ deadline: { year: 2027.5 } }))).toThrow(ItemFormatError);
	});
});
