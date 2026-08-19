import { describe, expect, it } from 'vitest';
import { Status, parseDream, parseGoal, parseTask } from '@/types';
import { listOccurrences, parseRRule } from '@/utils/schedule';
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n';
import { MockDataService, type MockDataResult } from './MockDataService';

// A Wednesday, deliberately mid-week: the recurring-schedule shapes rely on
// windows measured in days from `now`, and a mid-week anchor keeps every one
// of them comfortably clear of the boundary rather than landing right on it
// (see MockDataService.ts's comments on the Mon/Wed/Fri and Saturday shapes).
const NOW = new Date('2026-08-19T12:00:00.000Z');

/** A small counter-based RNG: cycles through a fixed sequence of values in
 *  [0, 1), no seeded-PRNG dependency, fully deterministic and reproducible. */
function makeCounterRandom(values: number[]): () => number {
	let index = 0;
	return () => {
		const value = values[index % values.length];
		index += 1;
		return value;
	};
}

const randomA = () => makeCounterRandom([0.1, 0.4, 0.7, 0.95, 0.05, 0.55, 0.25, 0.8]);
const randomB = () => makeCounterRandom([0.9, 0.15, 0.35, 0.6, 0.02, 0.72, 0.48, 0.28]);

const service = new MockDataService();

function generateAll(random: () => number): Record<AppLocale, MockDataResult> {
	return {
		en: service.generate('en', { now: NOW, random }),
		ru: service.generate('ru', { now: NOW, random }),
		pl: service.generate('pl', { now: NOW, random }),
	};
}

describe('MockDataService.generate', () => {
	it('produces records that pass parseDream/parseGoal/parseTask for every locale', () => {
		for (const locale of SUPPORTED_LOCALES) {
			const result = service.generate(locale, { now: NOW, random: randomA() });

			for (const dream of result.dreams) {
				expect(() => parseDream(dream)).not.toThrow();
			}
			for (const goal of result.goals) {
				expect(() => parseGoal(goal)).not.toThrow();
			}
			for (const task of result.tasks) {
				expect(() => parseTask(task)).not.toThrow();
			}
		}
	});

	it('generates the expected counts for every supported locale', () => {
		for (const locale of SUPPORTED_LOCALES) {
			const result = service.generate(locale, { now: NOW, random: randomA() });

			expect(result.dreams).toHaveLength(6);
			expect(result.goals).toHaveLength(10);
			expect(result.tasks).toHaveLength(20);
		}
	});

	it('covers all four (important, urgent) combinations among opened tasks', () => {
		const { tasks } = service.generate('en', { now: NOW, random: randomA() });
		const opened = tasks.filter((task) => task.status === Status.Opened);

		const combos = new Set(opened.map((task) => `${task.important}:${task.urgent}`));
		expect(combos).toEqual(new Set(['true:true', 'true:false', 'false:true', 'false:false']));
	});

	it('covers all three Status values within dreams, goals and tasks individually', () => {
		const { dreams, goals, tasks } = service.generate('en', { now: NOW, random: randomA() });
		const allStatuses = new Set([Status.Opened, Status.Done, Status.Cancelled]);

		expect(new Set(dreams.map((d) => d.status))).toEqual(allStatuses);
		expect(new Set(goals.map((g) => g.status))).toEqual(allStatuses);
		expect(new Set(tasks.map((t) => t.status))).toEqual(allStatuses);
	});

	it('has both standalone and dream-linked goals, and both standalone and goal-linked tasks', () => {
		const { goals, tasks } = service.generate('en', { now: NOW, random: randomA() });

		expect(goals.some((g) => g.dreamId !== undefined)).toBe(true);
		expect(goals.some((g) => g.dreamId === undefined)).toBe(true);
		expect(tasks.some((t) => t.goalId !== undefined)).toBe(true);
		expect(tasks.some((t) => t.goalId === undefined)).toBe(true);
	});

	it('covers all five deadline shapes among goals', () => {
		const { goals } = service.generate('en', { now: NOW, random: randomA() });

		expect(goals.some((g) => g.deadline === undefined)).toBe(true);
		expect(
			goals.some(
				(g) =>
					g.deadline !== undefined &&
					g.deadline.year !== undefined &&
					g.deadline.month === undefined &&
					g.deadline.season === undefined,
			),
		).toBe(true);
		expect(
			goals.some(
				(g) =>
					g.deadline !== undefined &&
					g.deadline.season !== undefined &&
					g.deadline.month === undefined,
			),
		).toBe(true);
		expect(
			goals.some(
				(g) =>
					g.deadline !== undefined &&
					g.deadline.month !== undefined &&
					g.deadline.day === undefined,
			),
		).toBe(true);
		expect(goals.some((g) => g.deadline !== undefined && g.deadline.day !== undefined)).toBe(true);
	});

	it('covers at least two recurrence frequencies and both marked and pending completions', () => {
		const { tasks } = service.generate('en', { now: NOW, random: randomA() });
		const recurring = tasks.filter((t) => t.schedule?.rrule !== undefined);

		const freqs = new Set(recurring.map((t) => parseRRule(t.schedule!.rrule!)?.freq));
		expect(freqs.has('weekly')).toBe(true);
		expect(freqs.has('monthly')).toBe(true);

		const withMixedCompletions = tasks.find((task) => {
			if (task.completions === undefined || task.schedule === undefined) return false;
			const hasDone = task.completions.some((c) => c.done === true);
			const occurrences = listOccurrencesOf(task);
			const hasUnmarked = occurrences.some(
				(occurrence) => !task.completions!.some((c) => c.occurrence === occurrence),
			);
			return hasDone && hasUnmarked;
		});
		expect(withMixedCompletions).toBeDefined();

		const recurringWithoutCompletions = recurring.find((t) => t.completions === undefined);
		expect(recurringWithoutCompletions).toBeDefined();
	});

	it('keeps closed records, occurrences and exdate entries within 14 days of now, and created <= updated always', () => {
		const { dreams, goals, tasks } = service.generate('en', { now: NOW, random: randomA() });
		const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;
		const within14 = (wallClockOrIso: string) => {
			const delta = NOW.getTime() - Date.parse(withZ(wallClockOrIso));
			return delta >= 0 && delta <= fourteenDaysMs;
		};

		for (const record of [...dreams, ...goals, ...tasks]) {
			expect(Date.parse(record.created)).toBeLessThanOrEqual(Date.parse(record.updated));

			if (record.status === Status.Done || record.status === Status.Cancelled) {
				expect(within14(record.updated)).toBe(true);
			}
		}

		for (const task of tasks) {
			for (const completion of task.completions ?? []) {
				expect(within14(completion.occurrence)).toBe(true);
			}
			for (const exdate of task.schedule?.exdate ?? []) {
				expect(within14(exdate)).toBe(true);
			}
		}
	});

	it('keeps referential integrity between goals/dreams and tasks/goals', () => {
		const { dreams, goals, tasks } = service.generate('en', { now: NOW, random: randomA() });
		const dreamIds = new Set(dreams.map((d) => d.id));
		const goalIds = new Set(goals.map((g) => g.id));

		for (const goal of goals) {
			if (goal.dreamId !== undefined) {
				expect(dreamIds.has(goal.dreamId)).toBe(true);
			}
		}
		for (const task of tasks) {
			if (task.goalId !== undefined) {
				expect(goalIds.has(task.goalId)).toBe(true);
			}
		}
	});

	it('is shaped identically but content-different across two random sequences, with no duplicate ids', () => {
		const resultA = service.generate('en', { now: NOW, random: randomA() });
		const resultB = service.generate('en', { now: NOW, random: randomB() });

		expect(resultA.dreams).toHaveLength(resultB.dreams.length);
		expect(resultA.goals).toHaveLength(resultB.goals.length);
		expect(resultA.tasks).toHaveLength(resultB.tasks.length);
		expect(resultA.dreams.map((d) => d.status)).toEqual(resultB.dreams.map((d) => d.status));
		expect(resultA.goals.map((g) => g.status)).toEqual(resultB.goals.map((g) => g.status));
		expect(resultA.tasks.map((t) => t.status)).toEqual(resultB.tasks.map((t) => t.status));
		expect(resultA.goals.map((g) => g.dreamId !== undefined)).toEqual(
			resultB.goals.map((g) => g.dreamId !== undefined),
		);
		expect(resultA.tasks.map((t) => t.goalId !== undefined)).toEqual(
			resultB.tasks.map((t) => t.goalId !== undefined),
		);

		const namesA = resultA.dreams.map((d) => d.name).join('|');
		const namesB = resultB.dreams.map((d) => d.name).join('|');
		expect(namesA).not.toEqual(namesB);

		for (const result of [resultA, resultB]) {
			const ids = [...result.dreams, ...result.goals, ...result.tasks].map((r) => r.id);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('also produces valid, non-empty content for ru and pl locales', () => {
		const results = generateAll(randomA());
		for (const locale of SUPPORTED_LOCALES) {
			const result = results[locale];
			expect(result.dreams.every((d) => d.name.length > 0)).toBe(true);
			expect(result.goals.every((g) => g.name.length > 0)).toBe(true);
			expect(result.tasks.every((t) => t.name.length > 0)).toBe(true);
		}
	});
});

/** Reads back the wall-clock occurrences a task's own schedule would list
 *  around `NOW`, the same way the app itself would -- used only to assert
 *  "at least one occurrence is left unmarked", not to build data. */
function listOccurrencesOf(task: { schedule?: { start: string; rrule?: string } }): string[] {
	if (task.schedule === undefined) return [];
	return listOccurrences(task.schedule, undefined, NOW, 6, 0).map((entry) => entry.start);
}

/**
 * `within14` above needs a real instant to compare against `NOW`. Floating
 * wall-clock strings ('YYYY-MM-DDTHH:mm', no zone) are read the same way
 * MockDataService.ts itself reads them back (`fromWallClock`: treat the
 * digits as UTC); real ISO instants (`created`/`updated`) already carry
 * their own 'Z' or offset and are left untouched.
 */
function withZ(value: string): string {
	return /Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : `${value}Z`;
}
