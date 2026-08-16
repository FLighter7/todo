import { describe, expect, it } from 'vitest';
import { EntityFormatError, Status } from './entity';
import { isPeriodic, parseTask } from './task';

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'task-1',
		name: 'File the report',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: true,
		urgent: false,
		...overrides,
	};
}

describe('parseTask', () => {
	it('parses a plain task', () => {
		const task = parseTask(makeRaw());

		expect(task.important).toBe(true);
		expect(task.urgent).toBe(false);
		expect(task.goalId).toBeUndefined();
		expect(task.schedule).toBeUndefined();
		expect(task.completions).toBeUndefined();
	});

	it('rejects non-boolean flags', () => {
		expect(() => parseTask(makeRaw({ important: 'yes' }))).toThrow(EntityFormatError);
		expect(() => parseTask(makeRaw({ urgent: 1 }))).toThrow(EntityFormatError);
	});

	it('keeps the goal link', () => {
		expect(parseTask(makeRaw({ goalId: 'goal-1' })).goalId).toBe('goal-1');
	});

	it('parses a schedule with a recurrence rule', () => {
		const schedule = {
			start: '2026-08-07T09:00',
			duration: 'PT4H',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
		};

		expect(parseTask(makeRaw({ schedule })).schedule).toEqual({
			...schedule,
			tzid: undefined,
			exdate: undefined,
			rdate: undefined,
		});
	});

	it('rejects a recurrence rule the library cannot parse', () => {
		expect(() =>
			parseTask(makeRaw({ schedule: { start: '2026-08-07T09:00', rrule: 'NONSENSE' } })),
		).toThrow(EntityFormatError);
	});

	it('rejects an unknown timezone', () => {
		expect(() =>
			parseTask(makeRaw({ schedule: { start: '2026-08-07T09:00', tzid: 'Mars/Olympus' } })),
		).toThrow(EntityFormatError);
	});

	it('accepts a known timezone', () => {
		const schedule = { start: '2026-08-07T09:00', tzid: 'Europe/Moscow' };

		expect(parseTask(makeRaw({ schedule })).schedule?.tzid).toBe('Europe/Moscow');
	});

	it('rejects a start with a trailing Z', () => {
		expect(() => parseTask(makeRaw({ schedule: { start: '2026-08-07T09:00:00.000Z' } }))).toThrow(
			EntityFormatError,
		);
	});

	it('rejects a start with a numeric offset', () => {
		expect(() => parseTask(makeRaw({ schedule: { start: '2026-08-07T09:00:00+03:00' } }))).toThrow(
			EntityFormatError,
		);
	});

	it('rejects a start with seconds', () => {
		expect(() => parseTask(makeRaw({ schedule: { start: '2026-08-07T09:00:00' } }))).toThrow(
			EntityFormatError,
		);
	});

	it('accepts a valid wall-clock start', () => {
		const schedule = { start: '2026-08-07T09:00' };

		expect(parseTask(makeRaw({ schedule })).schedule?.start).toBe('2026-08-07T09:00');
	});

	it('rejects an exdate entry with a trailing Z', () => {
		expect(() =>
			parseTask(
				makeRaw({
					schedule: {
						start: '2026-08-07T09:00',
						exdate: ['2026-08-14T09:00:00.000Z'],
					},
				}),
			),
		).toThrow(EntityFormatError);
	});

	it('accepts a valid exdate and rdate pair', () => {
		const schedule = {
			start: '2026-08-07T09:00',
			exdate: ['2026-08-14T09:00'],
			rdate: ['2026-08-21T09:00'],
		};

		const parsed = parseTask(makeRaw({ schedule })).schedule;
		expect(parsed?.exdate).toEqual(['2026-08-14T09:00']);
		expect(parsed?.rdate).toEqual(['2026-08-21T09:00']);
	});

	it('parses completions', () => {
		const completions = [
			{ occurrence: '2026-08-07T09:00', done: true, at: '2026-08-07T11:00:00.000Z' },
		];

		expect(parseTask(makeRaw({ completions })).completions).toEqual(completions);
	});

	it('rejects a malformed completion', () => {
		expect(() =>
			parseTask(makeRaw({ completions: [{ occurrence: 1, done: true, at: 'x' }] })),
		).toThrow(EntityFormatError);
		expect(() => parseTask(makeRaw({ completions: 'nope' }))).toThrow(EntityFormatError);
	});
});

describe('isPeriodic', () => {
	it('is false when there is no schedule', () => {
		expect(isPeriodic(parseTask(makeRaw()))).toBe(false);
	});

	it('is false when the schedule carries no rule', () => {
		expect(isPeriodic(parseTask(makeRaw({ schedule: { start: '2026-08-07T09:00' } })))).toBe(false);
	});

	it('is false for a rule that fires once', () => {
		const schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;COUNT=1' };

		expect(isPeriodic(parseTask(makeRaw({ schedule })))).toBe(false);
	});

	it('is true for a repeating rule', () => {
		const schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };

		expect(isPeriodic(parseTask(makeRaw({ schedule })))).toBe(true);
	});
});
