import { describe, expect, it } from 'vitest';
import { ItemType, Status, type ItemBase, type Task } from '@/types';
import { collectGarbage, pruneCompletions, pruneExdate, pruneTask } from '../collectGarbage';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function daysBefore(days: number): string {
	return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeRecord(overrides: Partial<ItemBase> = {}): ItemBase {
	return {
		type: ItemType.Dream,
		id: 'id-1',
		name: 'Buy milk',
		created: daysBefore(100),
		updated: daysBefore(1),
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		...makeRecord(),
		type: ItemType.Task,
		important: false,
		urgent: false,
		...overrides,
	} as Task;
}

describe('collectGarbage', () => {
	it('keeps an open record however old it is', () => {
		const records = [makeRecord({ status: Status.Opened, updated: daysBefore(3650) })];

		expect(collectGarbage(records, 30, NOW)).toEqual({ keep: records, purge: [] });
	});

	it('keeps a closed record inside the window', () => {
		const records = [makeRecord({ status: Status.Done, updated: daysBefore(29) })];

		expect(collectGarbage(records, 30, NOW).purge).toEqual([]);
	});

	it('purges a done record past the window', () => {
		const records = [makeRecord({ id: 'gone', status: Status.Done, updated: daysBefore(31) })];

		const result = collectGarbage(records, 30, NOW);
		expect(result.keep).toEqual([]);
		expect(result.purge).toEqual(['gone']);
	});

	it('purges a cancelled record past the window', () => {
		const records = [makeRecord({ id: 'gone', status: Status.Cancelled, updated: daysBefore(31) })];

		expect(collectGarbage(records, 30, NOW).purge).toEqual(['gone']);
	});

	it('treats the boundary itself as inside the window', () => {
		const records = [makeRecord({ status: Status.Done, updated: daysBefore(30) })];

		expect(collectGarbage(records, 30, NOW).purge).toEqual([]);
	});

	it('honours a longer window', () => {
		const records = [makeRecord({ status: Status.Done, updated: daysBefore(60) })];

		expect(collectGarbage(records, 90, NOW).purge).toEqual([]);
		expect(collectGarbage(records, 30, NOW).purge).toHaveLength(1);
	});

	it('never moves updated on the records it keeps', () => {
		const records = [makeRecord({ status: Status.Done, updated: daysBefore(1) })];

		expect(collectGarbage(records, 30, NOW).keep[0].updated).toBe(records[0].updated);
	});

	it('does not mutate its input', () => {
		const records = [makeRecord({ status: Status.Done, updated: daysBefore(31) })];
		const copy = structuredClone(records);

		collectGarbage(records, 30, NOW);

		expect(records).toEqual(copy);
	});

	it('splits a mixed list', () => {
		const records = [
			makeRecord({ id: 'open' }),
			makeRecord({ id: 'recent', status: Status.Done, updated: daysBefore(5) }),
			makeRecord({ id: 'stale', status: Status.Cancelled, updated: daysBefore(400) }),
		];

		const result = collectGarbage(records, 30, NOW);

		expect(result.keep.map((r) => r.id)).toEqual(['open', 'recent']);
		expect(result.purge).toEqual(['stale']);
	});
});

describe('pruneCompletions', () => {
	it('returns the task untouched when it has no completions', () => {
		const task = makeTask();

		expect(pruneCompletions(task, 30, NOW)).toEqual(task);
	});

	it('keeps marks inside the window', () => {
		const task = makeTask({
			completions: [{ occurrence: '2026-08-10T09:00', done: true, at: daysBefore(6) }],
		});

		expect(pruneCompletions(task, 30, NOW).completions).toHaveLength(1);
	});

	it('drops marks whose occurrence is past the window', () => {
		const task = makeTask({
			completions: [
				{ occurrence: '2026-01-01T09:00', done: true, at: daysBefore(220) },
				{ occurrence: '2026-08-10T09:00', done: true, at: daysBefore(6) },
			],
		});

		const pruned = pruneCompletions(task, 30, NOW);

		expect(pruned.completions?.map((c) => c.occurrence)).toEqual(['2026-08-10T09:00']);
	});

	it('treats a completion exactly on the cutoff as inside the window', () => {
		const task = makeTask({
			completions: [{ occurrence: daysBefore(30), done: true, at: daysBefore(30) }],
		});

		expect(pruneCompletions(task, 30, NOW).completions).toHaveLength(1);
	});

	it('prunes by occurrence, not by the moment the mark was made', () => {
		// Marked today, but for an occurrence from January: the occurrence decides.
		const task = makeTask({
			completions: [{ occurrence: '2026-01-01T09:00', done: true, at: daysBefore(0) }],
		});

		expect(pruneCompletions(task, 30, NOW).completions).toEqual([]);
	});

	it('never moves updated', () => {
		const task = makeTask({
			updated: daysBefore(200),
			completions: [{ occurrence: '2026-01-01T09:00', done: true, at: daysBefore(220) }],
		});

		expect(pruneCompletions(task, 30, NOW).updated).toBe(task.updated);
	});

	it('does not mutate its input', () => {
		const task = makeTask({
			completions: [{ occurrence: '2026-01-01T09:00', done: true, at: daysBefore(220) }],
		});
		const copy = structuredClone(task);

		pruneCompletions(task, 30, NOW);

		expect(task).toEqual(copy);
	});
});

describe('pruneExdate', () => {
	it('returns the task untouched when it has no schedule', () => {
		const task = makeTask();

		expect(pruneExdate(task, 30, NOW)).toEqual(task);
	});

	it('returns the task untouched when the schedule has no exdate', () => {
		const task = makeTask({
			schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' },
		});

		expect(pruneExdate(task, 30, NOW)).toEqual(task);
	});

	it('keeps exdate entries inside the window and drops entries past it', () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: ['2026-01-01T09:00', '2026-08-10T09:00'],
			},
		});

		expect(pruneExdate(task, 30, NOW).schedule?.exdate).toEqual(['2026-08-10T09:00']);
	});

	it('treats an exdate entry exactly on the cutoff as inside the window', () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: [daysBefore(30)],
			},
		});

		expect(pruneExdate(task, 30, NOW).schedule?.exdate).toHaveLength(1);
	});

	it('clears exdate to undefined once every entry is pruned', () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: ['2026-01-01T09:00'],
			},
		});

		expect(pruneExdate(task, 30, NOW).schedule?.exdate).toBeUndefined();
	});

	it('never moves updated', () => {
		const task = makeTask({
			updated: daysBefore(200),
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: ['2026-01-01T09:00'],
			},
		});

		expect(pruneExdate(task, 30, NOW).updated).toBe(task.updated);
	});

	it('does not mutate its input', () => {
		const task = makeTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR',
				exdate: ['2026-01-01T09:00'],
			},
		});
		const copy = structuredClone(task);

		pruneExdate(task, 30, NOW);

		expect(task).toEqual(copy);
	});
});

describe('pruneTask', () => {
	it('hands the same reference back when there is nothing to prune', () => {
		const task = makeTask({
			schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=DAILY', exdate: ['2026-08-10T09:00'] },
			completions: [{ occurrence: '2026-08-11T09:00', done: true, at: daysBefore(5) }],
		});

		expect(pruneTask(task, 30, NOW)).toBe(task);
	});

	it('hands the same reference back for a task with no schedule and no completions', () => {
		const task = makeTask();

		expect(pruneTask(task, 30, NOW)).toBe(task);
	});

	it('returns a fresh, pruned copy when a stale completion goes', () => {
		const task = makeTask({
			completions: [
				{ occurrence: '2026-01-01T09:00', done: true, at: daysBefore(200) },
				{ occurrence: '2026-08-11T09:00', done: true, at: daysBefore(5) },
			],
		});

		const pruned = pruneTask(task, 30, NOW);

		expect(pruned).not.toBe(task);
		expect(pruned.completions?.map((entry) => entry.occurrence)).toEqual(['2026-08-11T09:00']);
	});

	it('returns a fresh, pruned copy when a stale exdate entry goes', () => {
		const task = makeTask({
			schedule: {
				start: '2026-01-01T09:00',
				rrule: 'FREQ=DAILY',
				exdate: ['2026-01-02T09:00', '2026-08-10T09:00'],
			},
		});

		const pruned = pruneTask(task, 30, NOW);

		expect(pruned).not.toBe(task);
		expect(pruned.schedule?.exdate).toEqual(['2026-08-10T09:00']);
	});
});
