# Stage 7 — Completion History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user mark an individual occurrence of a periodic task done, not done, or skipped, and see the occurrence window inside `TaskDialog.vue`.

**Architecture:** A pure adapter (`src/utils/schedule.ts`) enumerates a fixed window of occurrences and folds in `exdate`/`rdate`; two task-store actions own the write side (mutual exclusion between `completions` and `exdate`, plus the auto Opened↔Done transition on the series' last occurrence); a new presentational component (`TaskCompletions.vue`) renders the window and emits toggle events that `TaskDialog.vue` re-emits and `TaskList.vue` (the only store-touching layer in this feature) turns into store calls.

**Tech Stack:** Vue 3.5 `<script setup>`, Pinia 4, Vuetify 4.1, vue-i18n 11, `rrule` 2.8.1, Vitest 4, `@vue/test-utils`.

**Spec:** [docs/superpowers/specs/2026-08-19-stage-7-completion-history-design.md](../specs/2026-08-19-stage-7-completion-history-design.md)

## Global Constraints

- SFC section order is **style → template → script**, enforced by `vue/block-order` — every new/edited `.vue` file follows it. Always `<script setup lang="ts">`, always `<style lang="scss" module>` when the file has styles.
- Formatting: tabs (`tabWidth: 2`), single quotes, `printWidth: 100`, trailing commas — per `.prettierrc.json`. Run `npm run format` if unsure.
- Imports inside `src` use the `@/` alias.
- `src/components/*.vue` are presentational: no store, no service/repository calls. Only `src/pages/TasksPage/containers/TaskList.vue` (a container) calls `useTasksStore()` in this feature.
- Default to no comments; add one only where the *why* isn't obvious from the code itself (a hidden constraint, a subtle invariant, a workaround for a specific bug) — matching the existing style in `src/utils/schedule.ts` and `src/utils/collectGarbage.ts`.
- Every new locale key goes into **all three** of `en.json`, `ru.json`, `pl.json` in the same task — never English-only.
- One task = one commit, Conventional Commits style (`feat:`, `fix:`).
- Branch discipline: stay on `stage-6-dreams-goals-tasks`. Do not merge to `main`, do not push, unless explicitly asked.
- Out of scope for this plan (see spec's Scope section): one-time-task completion tracking, any UI outside `TaskDialog.vue`, authoring `rdate`, a configurable window size, any streak/statistics view.
- "Done" for every task below: the task's own tests pass (`npx vitest run <file>`), and `npx vue-tsc --noEmit` reports no new errors introduced by the task's files.

---

## File Structure

**New files:**
- `src/components/TaskCompletions.vue` — presentational, renders one `OccurrenceEntry` row per entry, emits `toggle-done`/`toggle-skip`.
- `src/components/TaskCompletions.test.ts`

**Modified files:**
- `src/types/task.ts` — `parseCompletion` gains `assertWallClock` on `occurrence`.
- `src/types/task.test.ts` — new rejection/acceptance cases.
- `src/utils/schedule.ts` — shared wall-clock-domain occurrence walker; `nextOccurrence` now honors `exdate`/`rdate`; new `isLastOccurrence` and `listOccurrences`/`OccurrenceEntry`.
- `src/utils/schedule.test.ts` — new cases for all of the above.
- `src/utils/collectGarbage.ts` — new `pruneExdate`.
- `src/utils/collectGarbage.test.ts` — new cases for `pruneExdate`.
- `src/stores/tasks.ts` — new `setOccurrenceDone`/`setOccurrenceSkipped` actions; `prune` option extended to also prune `exdate`.
- `src/stores/tasks.test.ts` — new cases for both actions and the extended prune wiring.
- `src/components/TaskDialog.vue` — `initial: Partial<TaskDraft>` prop replaced by `record: Task | null`; renders `<task-completions>` in the read view for a periodic record; re-emits its two events with the record's id attached.
- `src/components/TaskDialog.test.ts` — every `initial:`-based test rewritten to `record:`; new completions cases.
- `src/pages/TasksPage/containers/TaskList.vue` — `editing: ref<Task | null>` replaced by `editingId: ref<string | null>` + a live `editingTask` computed; two new event handlers calling the new store actions.
- `src/pages/TasksPage/containers/TaskList.test.ts` — new completions cases (existing tests are unaffected — none of them inspect `editing` internals).
- `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json` — new `task.completions.*` namespace.

**No deleted files.**

---

### Task 1: Tighten `parseCompletion`'s `occurrence` validation

**Files:**
- Modify: `src/types/task.ts:136-146`
- Test: `src/types/task.test.ts`

**Interfaces:**
- Consumes: `assertWallClock` (already private in this file, `src/types/task.ts:87-91`).
- Produces: `parseCompletion` now throws `EntityFormatError` for a non-wall-clock `occurrence`, in addition to its existing checks. No signature change.

- [ ] **Step 1: Write the failing tests**

Add to `src/types/task.test.ts`, inside the existing `describe('parseTask', ...)` block (after the `'rejects a malformed completion'` test):

```ts
it('rejects a completion occurrence with a trailing Z', () => {
	expect(() =>
		parseTask(
			makeRaw({
				completions: [
					{ occurrence: '2026-08-07T09:00:00.000Z', done: true, at: '2026-08-07T10:00:00.000Z' },
				],
			}),
		),
	).toThrow(EntityFormatError);
});

it('rejects a completion occurrence with seconds', () => {
	expect(() =>
		parseTask(
			makeRaw({
				completions: [{ occurrence: '2026-08-07T09:00:00', done: true, at: '2026-08-07T10:00:00.000Z' }],
			}),
		),
	).toThrow(EntityFormatError);
});

it('accepts a valid wall-clock completion occurrence', () => {
	const completions = [{ occurrence: '2026-08-07T09:00', done: true, at: '2026-08-07T10:00:00.000Z' }];

	expect(parseTask(makeRaw({ completions })).completions).toEqual(completions);
});
```

- [ ] **Step 2: Run the tests to verify the first two fail**

Run: `npx vitest run src/types/task.test.ts`
Expected: FAIL — the two rejection tests fail because `parseCompletion` currently accepts any string for `occurrence`.

- [ ] **Step 3: Add the validation**

In `src/types/task.ts`, replace the existing `parseCompletion` function (lines 136-146):

```ts
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
```

with:

```ts
export function parseCompletion(value: unknown): Completion {
	if (!isRecordObject(value)) {
		fail('"completions" must contain objects');
	}

	const occurrence = readString(value, 'occurrence');
	assertWallClock(occurrence, 'completions.occurrence');

	return {
		occurrence,
		done: readBoolean(value, 'done'),
		at: readString(value, 'at'),
	};
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/types/task.test.ts`
Expected: PASS — all tests in the file, including the three new ones.

- [ ] **Step 5: Commit**

```bash
git add src/types/task.ts src/types/task.test.ts
git commit -m "fix: validate Completion.occurrence as a wall-clock string"
```

---

### Task 2: Fix `nextOccurrence` to honor `exdate`/`rdate`; add `isLastOccurrence`

**Files:**
- Modify: `src/utils/schedule.ts:1-2` (import), `src/utils/schedule.ts:316-354` (`nextOccurrence`)
- Test: `src/utils/schedule.test.ts`

**Interfaces:**
- Consumes: existing private helpers in this file — `wallClockStringToDate`, `dateToWallClockString`, `deviceLocalWallClock`, `instantAsWallClockInZone`.
- Produces: `nextOccurrence(schedule: Schedule, from: Date): OccurrenceWindow | undefined` (signature unchanged, behavior extended) and new `isLastOccurrence(schedule: Schedule, occurrence: string): boolean`. Also produces the private helpers `buildRule` and `walkOccurrence`, which Task 3's `listOccurrences` consumes directly.

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/schedule.test.ts`. First, add `isLastOccurrence` to the import on line 13:

```ts
import { isLastOccurrence, nextOccurrence } from './schedule';
```

Then add these new `describe` blocks after the existing `describe('nextOccurrence, anchored to a tzid', ...)` block:

```ts
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
```

- [ ] **Step 2: Run the tests to verify the new ones fail**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: FAIL — `isLastOccurrence` is not exported yet; the `exdate`/`rdate` cases fail because `nextOccurrence` ignores both fields today.

- [ ] **Step 3: Add the shared core, fix `nextOccurrence`, add `isLastOccurrence`**

In `src/utils/schedule.ts`, change the type-only import on line 2 from:

```ts
import type { Schedule } from '@/types';
```

to:

```ts
import type { Completion, Schedule } from '@/types';
```

(`Completion` is needed by Task 3's `listOccurrences`, added to the same file next.)

Insert the following two private helpers immediately **before** the existing `nextOccurrence` function (i.e. right before line 316):

```ts
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
		candidate = direction === 'after' ? rule.after(candidate, false) : rule.before(candidate, false);
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
```

Then replace the existing `nextOccurrence` function body (lines 316-354) with:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: PASS — every test in the file, including all the pre-existing `nextOccurrence` cases (floating, tzid, DST, embedded `DTSTART;TZID`), which must still pass unchanged since an empty `exdate`/`rdate` makes `walkOccurrence` behave exactly like the old inline code.

- [ ] **Step 5: Commit**

```bash
git add src/utils/schedule.ts src/utils/schedule.test.ts
git commit -m "fix: honor exdate/rdate in nextOccurrence; add isLastOccurrence"
```

---

### Task 3: Add `listOccurrences`

**Files:**
- Modify: `src/utils/schedule.ts` (append after `isLastOccurrence`)
- Test: `src/utils/schedule.test.ts`

**Interfaces:**
- Consumes: `buildRule`, `deviceLocalWallClock`, `instantAsWallClockInZone`, `wallClockStringToDate`, `dateToWallClockString`, `addDurationToWallClock` (all from Task 2 / pre-existing in this file); `Completion` type (import added in Task 2).
- Produces: `export interface OccurrenceEntry { start: string; end: string; state: 'pending' | 'done' | 'skipped' }` and `export function listOccurrences(schedule: Schedule, completions: Completion[] | undefined, from: Date, pastCount: number, futureCount: number): OccurrenceEntry[]`. Consumed by Task 6 (`TaskCompletions.vue`'s prop type) and Task 7 (`TaskDialog.vue`'s `occurrences` computed).

- [ ] **Step 1: Write the failing tests**

Add `listOccurrences` to the import on line 13 of `src/utils/schedule.test.ts` (now reading):

```ts
import { isLastOccurrence, listOccurrences, nextOccurrence } from './schedule';
```

Add `type Completion` to the existing type import (`import type { Schedule } from '@/types';` becomes `import type { Completion, Schedule } from '@/types';`).

Add this `describe` block after `describe('isLastOccurrence', ...)`:

```ts
describe('listOccurrences', () => {
	it('returns pastCount occurrences strictly before "from" and futureCount at or after it', () => {
		const schedule: Schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const from = new Date('2026-08-22T00:00:00Z'); // a Saturday, day after the Aug 21 occurrence

		const entries = listOccurrences(schedule, undefined, from, 2, 2);

		expect(entries.map((entry) => entry.start)).toEqual([
			'2026-08-14T09:00',
			'2026-08-21T09:00',
			'2026-08-28T09:00',
			'2026-09-04T09:00',
		]);
	});

	it('returns fewer than requested at the start of a new series', () => {
		const schedule: Schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const from = new Date('2026-08-08T00:00:00Z'); // the Saturday right after the first occurrence

		const entries = listOccurrences(schedule, undefined, from, 5, 5);

		expect(entries.map((entry) => entry.start)).toEqual([
			'2026-08-07T09:00',
			'2026-08-14T09:00',
			'2026-08-21T09:00',
			'2026-08-28T09:00',
			'2026-09-04T09:00',
			'2026-09-11T09:00',
		]);
	});

	it('tags an excluded occurrence as skipped instead of omitting it', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			exdate: ['2026-08-21T09:00'],
		};
		const from = new Date('2026-08-15T00:00:00Z');

		const entries = listOccurrences(schedule, undefined, from, 1, 2);

		expect(entries.map((entry) => [entry.start, entry.state])).toEqual([
			['2026-08-14T09:00', 'pending'],
			['2026-08-21T09:00', 'skipped'],
			['2026-08-28T09:00', 'pending'],
		]);
	});

	it('merges an rdate entry into the window, interleaved chronologically', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			rdate: ['2026-08-10T09:00'],
		};
		const from = new Date('2026-08-09T00:00:00Z');

		const entries = listOccurrences(schedule, undefined, from, 1, 2);

		expect(entries.map((entry) => entry.start)).toEqual([
			'2026-08-07T09:00',
			'2026-08-10T09:00',
			'2026-08-14T09:00',
		]);
	});

	it('reads state from completions: an explicit done: false entry is still pending', () => {
		const schedule: Schedule = { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const completions: Completion[] = [
			{ occurrence: '2026-08-07T09:00', done: true, at: '2026-08-07T10:00:00.000Z' },
			{ occurrence: '2026-08-14T09:00', done: false, at: '2026-08-14T10:00:00.000Z' },
		];
		const from = new Date('2026-08-15T00:00:00Z');

		const entries = listOccurrences(schedule, completions, from, 2, 0);

		expect(entries.map((entry) => [entry.start, entry.state])).toEqual([
			['2026-08-07T09:00', 'done'],
			['2026-08-14T09:00', 'pending'],
		]);
	});

	it('returns an empty list for a non-recurring schedule', () => {
		expect(listOccurrences({ start: '2026-08-07T09:00' }, undefined, new Date(), 5, 5)).toEqual([]);
	});

	it('applies duration to every entry\'s end', () => {
		const schedule: Schedule = {
			start: '2026-08-07T09:00',
			duration: 'PT2H',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
		};
		const from = new Date('2026-08-08T00:00:00Z');

		const entries = listOccurrences(schedule, undefined, from, 0, 1);

		expect(entries).toEqual([{ start: '2026-08-14T09:00', end: '2026-08-14T11:00', state: 'pending' }]);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: FAIL — `listOccurrences` is not exported yet.

- [ ] **Step 3: Implement `listOccurrences`**

Append to the end of `src/utils/schedule.ts`:

```ts
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
		const next = direction === 'after' ? rule.after(cursor, inclusive) : rule.before(cursor, inclusive);
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

		return direction === 'after' ? merged.slice(0, count) : merged.slice(-count);
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: PASS — every test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/utils/schedule.ts src/utils/schedule.test.ts
git commit -m "feat: add listOccurrences for enumerating a task's occurrence window"
```

---

### Task 4: Prune stale `schedule.exdate` entries in garbage collection

**Files:**
- Modify: `src/utils/collectGarbage.ts`, `src/stores/tasks.ts:61-69`
- Test: `src/utils/collectGarbage.test.ts`, `src/stores/tasks.test.ts`

**Interfaces:**
- Consumes: `MS_PER_DAY` (private, already in `collectGarbage.ts`).
- Produces: `export function pruneExdate(task: Task, windowDays: number, now: Date): Task`. Consumed by `tasks.ts`'s `prune` option (already wired to `pruneCompletions`).

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/collectGarbage.test.ts`, after the existing `describe('pruneCompletions', ...)` block. First add `pruneExdate` to the import on line 3:

```ts
import { collectGarbage, pruneCompletions, pruneExdate } from './collectGarbage';
```

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/collectGarbage.test.ts`
Expected: FAIL — `pruneExdate` is not exported yet.

- [ ] **Step 3: Implement `pruneExdate` and wire it into the task store's prune hook**

Append to `src/utils/collectGarbage.ts`:

```ts
/**
 * `schedule.exdate` grows the same way `completions` used to before
 * `pruneCompletions` existed -- skipping an occurrence writes to it, and a
 * long-running daily/weekly task with active skipping would otherwise grow
 * it without bound. Pruned by the excluded date itself, the same `cleanupDays`
 * window `pruneCompletions` already uses.
 */
export function pruneExdate(task: Task, windowDays: number, now: Date): Task {
	if (task.schedule?.exdate === undefined) {
		return { ...task };
	}

	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const exdate = task.schedule.exdate.filter((entry) => Date.parse(entry) >= cutoff);

	return {
		...task,
		schedule: { ...task.schedule, exdate: exdate.length > 0 ? exdate : undefined },
	};
}
```

In `src/stores/tasks.ts`, add `pruneExdate` to the existing import on line 5:

```ts
import { pruneCompletions, pruneExdate } from '@/utils';
```

Replace the `prune` option (lines 61-69) from:

```ts
	// pruneCompletions always returns a fresh object, by contract — it must never
	// alias its input. The store, though, uses reference identity to tell "nothing
	// to prune" from "rewrite this record", so hand the original back when the
	// marks came through untouched.
	prune: (task, windowDays, now) => {
		const pruned = pruneCompletions(task, windowDays, now);

		return pruned.completions?.length === task.completions?.length ? task : pruned;
	},
```

to:

```ts
	// Both prune functions always return a fresh object, by contract — neither
	// may alias its input. The store, though, uses reference identity to tell
	// "nothing to prune" from "rewrite this record", so hand the original back
	// when neither completions nor exdate actually changed.
	prune: (task, windowDays, now) => {
		const afterCompletions = pruneCompletions(task, windowDays, now);
		const fullyPruned = pruneExdate(afterCompletions, windowDays, now);

		const unchanged =
			fullyPruned.completions?.length === task.completions?.length &&
			fullyPruned.schedule?.exdate?.length === task.schedule?.exdate?.length;

		return unchanged ? task : fullyPruned;
	},
```

Also export `pruneExdate` from `src/utils/index.ts` — it currently reads `export * from './collectGarbage';`, which already re-exports every named export from that file, so **no change is needed there**; confirm this by checking the import in Step 4 resolves.

- [ ] **Step 4: Add a store-level regression test and run everything**

Add to `src/stores/tasks.test.ts`, inside `describe('useTasksStore load pruning', ...)`:

```ts
it('drops a stale exdate entry on load, alongside completions pruning', async () => {
	const task = makeTask({
		schedule: {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			exdate: [daysAgo(400), daysAgo(1)],
		},
	});
	const { storage } = spyingRepository([task]);
	const store = useTasksStore();

	await store.load(async () => storage);

	expect(store.records[0].schedule?.exdate).toEqual([task.schedule!.exdate![1]]);
});

it('does not rewrite a task to storage when neither completions nor exdate were pruned', async () => {
	const task = makeTask({
		schedule: {
			start: '2026-08-07T09:00',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
			exdate: [daysAgo(1)],
		},
	});
	const { storage, putIds } = spyingRepository([task]);
	const store = useTasksStore();

	await store.load(async () => storage);

	expect(putIds).toEqual([]);
});
```

Run: `npx vitest run src/utils/collectGarbage.test.ts src/stores/tasks.test.ts`
Expected: PASS — every test in both files.

- [ ] **Step 5: Commit**

```bash
git add src/utils/collectGarbage.ts src/utils/collectGarbage.test.ts src/stores/tasks.ts src/stores/tasks.test.ts
git commit -m "feat: prune stale schedule.exdate entries in garbage collection"
```

---

### Task 5: Add `setOccurrenceDone`/`setOccurrenceSkipped` store actions

**Files:**
- Modify: `src/stores/tasks.ts`
- Test: `src/stores/tasks.test.ts`

**Interfaces:**
- Consumes: `isLastOccurrence` (Task 2, `@/utils/schedule`); `store.records`/`store.update` (the base store instance, already in scope inside `useTasksStore`'s setup).
- Produces: `setOccurrenceDone(taskId: string, occurrence: string, done: boolean): Promise<void>` and `setOccurrenceSkipped(taskId: string, occurrence: string, skipped: boolean): Promise<void>`, both exposed on `useTasksStore()`'s return object. Consumed by Task 8 (`TaskList.vue`'s new event handlers).

- [ ] **Step 1: Write the failing tests**

Add to `src/stores/tasks.test.ts`, as a new top-level `describe` block (anywhere after the existing `describe('useTasksStore quadrants', ...)` block is fine):

```ts
describe('useTasksStore setOccurrenceDone / setOccurrenceSkipped', () => {
	async function loadWithTask(overrides: Partial<Task> = {}) {
		const task = makeTask({
			schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3' },
			...overrides,
		});
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository([task]));
		return store;
	}

	it('writes a done completion and clears any exdate entry for that occurrence', async () => {
		const store = await loadWithTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3',
				exdate: ['2026-08-14T09:00'],
			},
		});

		await store.setOccurrenceDone('task-1', '2026-08-14T09:00', true);

		const record = store.records[0];
		expect(record.completions).toEqual([
			expect.objectContaining({ occurrence: '2026-08-14T09:00', done: true }),
		]);
		expect(record.schedule?.exdate).toBeUndefined();
	});

	it('writes an explicit done: false completion, not a deletion, when unmarking', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', false);

		expect(store.records[0].completions).toEqual([
			expect.objectContaining({ occurrence: '2026-08-07T09:00', done: false }),
		]);
	});

	it('adds the occurrence to exdate and clears any completion when skipping', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		await store.setOccurrenceSkipped('task-1', '2026-08-07T09:00', true);

		const record = store.records[0];
		expect(record.schedule?.exdate).toEqual(['2026-08-07T09:00']);
		expect(record.completions).toEqual([]);
	});

	it('removes the occurrence from exdate when un-skipping, writing no completion', async () => {
		const store = await loadWithTask({
			schedule: {
				start: '2026-08-07T09:00',
				rrule: 'FREQ=WEEKLY;BYDAY=FR;COUNT=3',
				exdate: ['2026-08-07T09:00'],
			},
		});

		await store.setOccurrenceSkipped('task-1', '2026-08-07T09:00', false);

		const record = store.records[0];
		expect(record.schedule?.exdate).toBeUndefined();
		expect(record.completions ?? []).toEqual([]);
	});

	it('closes the task when the last occurrence of a bounded series is marked done', async () => {
		const store = await loadWithTask();

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Done);
	});

	it('reopens the task when the last occurrence is unmarked', async () => {
		const store = await loadWithTask();
		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', false);

		expect(store.records[0].status).toBe(Status.Opened);
	});

	it('closes the task when the last occurrence is skipped', async () => {
		const store = await loadWithTask();

		await store.setOccurrenceSkipped('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Done);
	});

	it('does not touch status when a non-last occurrence is marked done', async () => {
		const store = await loadWithTask();

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		expect(store.records[0].status).toBe(Status.Opened);
	});

	it('never touches a Cancelled task, even on its last occurrence', async () => {
		const store = await loadWithTask({ status: Status.Cancelled });

		await store.setOccurrenceDone('task-1', '2026-08-21T09:00', true);

		expect(store.records[0].status).toBe(Status.Cancelled);
	});

	it('moves updated once per call', async () => {
		const store = await loadWithTask({ updated: '2026-08-06T10:00:00.000Z' });

		await store.setOccurrenceDone('task-1', '2026-08-07T09:00', true);

		expect(store.records[0].updated).not.toBe('2026-08-06T10:00:00.000Z');
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stores/tasks.test.ts`
Expected: FAIL — `store.setOccurrenceDone` and `store.setOccurrenceSkipped` are not functions yet.

- [ ] **Step 3: Implement the two actions**

In `src/stores/tasks.ts`, add `isLastOccurrence` to the imports (new import line, alongside the existing ones near the top):

```ts
import { isLastOccurrence } from '@/utils/schedule';
```

Inside `useTasksStore`'s `defineStore('tasksMatrix', () => { ... })` setup function, add the following after the `groupedByGoal` computed and before the final `return { ... }` statement:

```ts
function findTask(id: string): Task | undefined {
	return records.value.find((task) => task.id === id);
}

function applyLastOccurrenceStatus(
	task: Task,
	schedule: Task['schedule'],
	occurrence: string,
	resolved: boolean,
): Task['status'] {
	if (schedule === undefined || !isLastOccurrence(schedule, occurrence)) {
		return task.status;
	}

	if (resolved && task.status === Status.Opened) {
		return Status.Done;
	}
	if (!resolved && task.status === Status.Done) {
		return Status.Opened;
	}

	return task.status;
}

async function setOccurrenceDone(taskId: string, occurrence: string, done: boolean): Promise<void> {
	const task = findTask(taskId);
	if (task === undefined || task.schedule === undefined) {
		return;
	}

	const completions = (task.completions ?? []).filter((entry) => entry.occurrence !== occurrence);
	completions.push({ occurrence, done, at: new Date().toISOString() });

	const exdate = task.schedule.exdate?.filter((entry) => entry !== occurrence);
	const schedule = { ...task.schedule, exdate: exdate !== undefined && exdate.length > 0 ? exdate : undefined };

	await store.update(taskId, {
		completions,
		schedule,
		status: applyLastOccurrenceStatus(task, schedule, occurrence, done),
	});
}

async function setOccurrenceSkipped(
	taskId: string,
	occurrence: string,
	skipped: boolean,
): Promise<void> {
	const task = findTask(taskId);
	if (task === undefined || task.schedule === undefined) {
		return;
	}

	const existing = task.schedule.exdate ?? [];
	const exdate = skipped
		? existing.includes(occurrence)
			? existing
			: [...existing, occurrence]
		: existing.filter((entry) => entry !== occurrence);
	const schedule = { ...task.schedule, exdate: exdate.length > 0 ? exdate : undefined };

	const completions = (task.completions ?? []).filter((entry) => entry.occurrence !== occurrence);

	await store.update(taskId, {
		schedule,
		completions,
		status: applyLastOccurrenceStatus(task, schedule, occurrence, skipped),
	});
}
```

Add both to the final `return` statement:

```ts
	return {
		records,
		active,
		closed,
		loading,
		quadrants,
		groupedByGoal,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
		setOccurrenceDone,
		setOccurrenceSkipped,
	};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/stores/tasks.test.ts`
Expected: PASS — every test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/stores/tasks.ts src/stores/tasks.test.ts
git commit -m "feat: add setOccurrenceDone/setOccurrenceSkipped task store actions"
```

---

### Task 6: Add `TaskCompletions.vue`

**Files:**
- Create: `src/components/TaskCompletions.vue`
- Create: `src/components/TaskCompletions.test.ts`
- Modify: `src/i18n/locales/en.json:31-63`, `src/i18n/locales/ru.json:31-62`, `src/i18n/locales/pl.json:31-62`

**Interfaces:**
- Consumes: `OccurrenceEntry` (Task 3, `@/utils/schedule`), `formatWallClock` (pre-existing, `@/utils/schedule`).
- Produces: default export `TaskCompletions`, props `{ occurrences: OccurrenceEntry[]; locale: string }`, emits `{ 'toggle-done': [occurrence: string, done: boolean]; 'toggle-skip': [occurrence: string, skipped: boolean] }`. Consumed by Task 7 (`TaskDialog.vue`).

- [ ] **Step 1: Add the i18n keys**

In `src/i18n/locales/en.json`, insert after the `schedule` block closes (after line 63's `}` that closes `"schedule"`, i.e. right before `task`'s own closing brace on line 64):

```json
		"task": {
			...
			"schedule": {
				...
			},
			"completions": {
				"label": "Completions",
				"markDone": "Mark done",
				"markPending": "Mark not done",
				"skip": "Skip",
				"unskip": "Un-skip",
				"doneCount": "{n} time done | {n} times done"
			}
		},
```

(Only the new `"completions"` block is being added — the `"schedule"` block above it is unchanged. Do not remove the trailing comma after `"schedule": { ... }`.)

In `src/i18n/locales/ru.json`, at the same position:

```json
			"completions": {
				"label": "Отметки выполнения",
				"markDone": "Отметить выполненным",
				"markPending": "Снять отметку",
				"skip": "Пропустить",
				"unskip": "Вернуть",
				"doneCount": "Выполнено {n} раз | Выполнено {n} раза | Выполнено {n} раз"
			}
```

In `src/i18n/locales/pl.json`, at the same position:

```json
			"completions": {
				"label": "Wykonania",
				"markDone": "Oznacz jako wykonane",
				"markPending": "Cofnij wykonanie",
				"skip": "Pomiń",
				"unskip": "Cofnij pominięcie",
				"doneCount": "Wykonano {n} raz | Wykonano {n} razy | Wykonano {n} razy"
			}
```

- [ ] **Step 2: Write the failing component test**

Create `src/components/TaskCompletions.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import type { OccurrenceEntry } from '@/utils/schedule';
import TaskCompletions from './TaskCompletions.vue';

function mountWith(occurrences: OccurrenceEntry[]) {
	return mount(TaskCompletions, {
		props: { occurrences, locale: 'en' },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('TaskCompletions', () => {
	it('shows a mark-done and a skip action for a pending occurrence', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		expect(wrapper.find('button[aria-label="Mark done"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Skip"]').exists()).toBe(true);
	});

	it('shows a mark-not-done action for a done occurrence and no skip action', () => {
		const wrapper = mountWith([{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'done' }]);

		expect(wrapper.find('button[aria-label="Mark not done"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Skip"]').exists()).toBe(false);
	});

	it('shows only an un-skip action for a skipped occurrence', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'skipped' },
		]);

		expect(wrapper.find('button[aria-label="Un-skip"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Mark done"]').exists()).toBe(false);
	});

	it('emits toggle-done with the occurrence and the new value', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		await wrapper.get('button[aria-label="Mark done"]').trigger('click');

		expect(wrapper.emitted('toggle-done')).toEqual([['2026-08-21T09:00', true]]);
	});

	it('emits toggle-done with false from a mark-not-done action', async () => {
		const wrapper = mountWith([{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'done' }]);

		await wrapper.get('button[aria-label="Mark not done"]').trigger('click');

		expect(wrapper.emitted('toggle-done')).toEqual([['2026-08-21T09:00', false]]);
	});

	it('emits toggle-skip with the occurrence and the new value', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		await wrapper.get('button[aria-label="Skip"]').trigger('click');

		expect(wrapper.emitted('toggle-skip')).toEqual([['2026-08-21T09:00', true]]);
	});

	it('emits toggle-skip with false from an un-skip action', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'skipped' },
		]);

		await wrapper.get('button[aria-label="Un-skip"]').trigger('click');

		expect(wrapper.emitted('toggle-skip')).toEqual([['2026-08-21T09:00', false]]);
	});

	it('shows the done count, pluralized', () => {
		const wrapper = mountWith([
			{ start: '2026-08-07T09:00', end: '2026-08-07T09:00', state: 'done' },
			{ start: '2026-08-14T09:00', end: '2026-08-14T09:00', state: 'done' },
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		expect(wrapper.text()).toContain('2 times done');
	});

	it('omits the done-count caption when nothing is done yet', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		expect(wrapper.text()).not.toContain('time done');
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/TaskCompletions.test.ts`
Expected: FAIL — `src/components/TaskCompletions.vue` does not exist yet.

- [ ] **Step 4: Implement the component**

Create `src/components/TaskCompletions.vue`:

```vue
<style lang="scss" module>
.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}
</style>

<template>
	<div>
		<p class="text-subtitle-2 mt-4">{{ t('task.completions.label') }}</p>
		<p v-if="doneCount > 0" class="text-caption text-medium-emphasis">
			{{ t('task.completions.doneCount', { n: doneCount }, { plural: doneCount }) }}
		</p>
		<div v-for="entry in occurrences" :key="entry.start" :class="$style.row">
			<span>{{ formatWallClock(entry.start, locale) }}</span>
			<template v-if="entry.state === 'pending'">
				<v-btn
					:icon="mdiCheckCircleOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('task.completions.markDone')"
					@click="emit('toggle-done', entry.start, true)"
				/>
				<v-btn
					:icon="mdiCloseCircleOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('task.completions.skip')"
					@click="emit('toggle-skip', entry.start, true)"
				/>
			</template>
			<v-btn
				v-else-if="entry.state === 'done'"
				:icon="mdiCheckCircle"
				variant="text"
				density="comfortable"
				color="primary"
				:aria-label="t('task.completions.markPending')"
				@click="emit('toggle-done', entry.start, false)"
			/>
			<v-btn
				v-else
				:icon="mdiCloseCircle"
				variant="text"
				density="comfortable"
				:aria-label="t('task.completions.unskip')"
				@click="emit('toggle-skip', entry.start, false)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheckCircle, mdiCheckCircleOutline, mdiCloseCircle, mdiCloseCircleOutline } from '@mdi/js';
import { formatWallClock, type OccurrenceEntry } from '@/utils/schedule';

const props = defineProps<{ occurrences: OccurrenceEntry[]; locale: string }>();
const emit = defineEmits<{
	'toggle-done': [occurrence: string, done: boolean];
	'toggle-skip': [occurrence: string, skipped: boolean];
}>();

const { t } = useI18n();

const doneCount = computed(() => props.occurrences.filter((entry) => entry.state === 'done').length);
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/TaskCompletions.test.ts`
Expected: PASS — every test in the file.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskCompletions.vue src/components/TaskCompletions.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add TaskCompletions component for marking occurrences"
```

---

### Task 7: Wire completion history into `TaskDialog.vue`

**Files:**
- Modify: `src/components/TaskDialog.vue` (full rewrite of the `<template>` and `<script setup>` sections)
- Test: `src/components/TaskDialog.test.ts` (full rewrite)

**Interfaces:**
- Consumes: `TaskCompletions` (Task 6), `listOccurrences`/`OccurrenceEntry` (Task 3), `isPeriodic` (pre-existing, `@/types`).
- Produces: `TaskDialog`'s `initial` prop is **removed**, replaced by `record: Task | null`. New emits `'toggle-completion-done': [taskId: string, occurrence: string, done: boolean]` and `'toggle-completion-skip': [taskId: string, occurrence: string, skipped: boolean]`. Consumed by Task 8 (`TaskList.vue`).

- [ ] **Step 1: Rewrite the test file (red first: the prop no longer exists)**

Replace the entire contents of `src/components/TaskDialog.test.ts` with:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Task } from '@/types';
import { listOccurrences } from '@/utils/schedule';
import TaskCompletions from './TaskCompletions.vue';
import TaskDialog from './TaskDialog.vue';

const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

describe('TaskDialog add mode', () => {
	it('emits a draft including flags and the picked goal', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});

	it('emits goalId undefined when "no goal" stays selected', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: false, urgent: false, goalId: undefined }],
		]);
	});
});

describe('TaskDialog goal picker', () => {
	it('offers "no goal" plus every option passed in', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('items')).toEqual([
			{ value: '', title: 'No goal' },
			{ value: 'goal-1', title: 'Learn Japanese' },
		]);
	});

	it('preserves a closed goal that is present only because it is the current selection', async () => {
		const closedOptions = [{ value: 'closed-goal', title: 'Old goal' }];
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ goalId: 'closed-goal' }),
				goalOptions: closedOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-goal');
	});
});

describe('TaskDialog edit mode', () => {
	it('shows the linked goal name and important/urgent chips in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ important: true, goalId: 'goal-1' }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Important');
		expect(wrapper.text()).not.toContain('Urgent');
	});

	it('omits the important/urgent chips entirely when both flags are false', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'edit', record: makeTask(), goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent({ name: 'VChip' }).exists()).toBe(false);
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'edit', record: makeTask(), goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});

describe('TaskDialog schedule', () => {
	it('round-trips an existing one-time schedule back out unchanged', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ name: 'Water plants', schedule: { start: '2026-08-21T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[
				{
					name: 'Water plants',
					note: undefined,
					important: false,
					urgent: false,
					goalId: undefined,
					schedule: {
						start: '2026-08-21T09:00',
						tzid: undefined,
						duration: undefined,
						rrule: undefined,
					},
				},
			],
		]);
	});

	it('emits schedule undefined after the schedule switch is turned off', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ name: 'Water plants', schedule: { start: '2026-08-21T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.findAll('input[type="checkbox"]')[2].setValue(false);
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[
				{
					name: 'Water plants',
					note: undefined,
					important: false,
					urgent: false,
					goalId: undefined,
					schedule: undefined,
				},
			],
		]);
	});

	it('shows the recurrence description in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					name: 'File the report',
					schedule: { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Every week, on Fri');
	});

	it('shows the formatted start time for a non-recurring schedule in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ name: 'Water plants', schedule: { start: '2026-08-21T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Aug 21, 2026');
	});
});

describe('TaskDialog completions', () => {
	it('shows the completions section for a periodic record', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent(TaskCompletions).exists()).toBe(true);
	});

	it('hides the completions section for a non-periodic record', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ schedule: { start: '2026-08-07T09:00' } }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent(TaskCompletions).exists()).toBe(false);
	});

	it('hides the completions section when there is no record', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent(TaskCompletions).exists()).toBe(false);
	});

	it('computes the occurrence window from the record\'s schedule and completions', () => {
		const schedule = { start: '2020-01-03T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const completions = [{ occurrence: '2020-01-03T09:00', done: true, at: '2020-01-03T10:00:00.000Z' }];
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({ schedule, completions }),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		const expected = listOccurrences(schedule, completions, new Date(), 5, 5);
		expect(wrapper.findComponent(TaskCompletions).props('occurrences')).toEqual(expected);
	});

	it('re-emits toggle-completion-done with the record id attached', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					id: 'task-9',
					schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.findComponent(TaskCompletions).vm.$emit('toggle-done', '2026-08-07T09:00', true);

		expect(wrapper.emitted('toggle-completion-done')).toEqual([['task-9', '2026-08-07T09:00', true]]);
	});

	it('re-emits toggle-completion-skip with the record id attached', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				record: makeTask({
					id: 'task-9',
					schedule: { start: '2026-08-07T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' },
				}),
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.findComponent(TaskCompletions).vm.$emit('toggle-skip', '2026-08-07T09:00', true);

		expect(wrapper.emitted('toggle-completion-skip')).toEqual([['task-9', '2026-08-07T09:00', true]]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/TaskDialog.test.ts`
Expected: FAIL — `TaskDialog` still expects an `initial` prop, not `record`, and does not render `TaskCompletions` or emit the two new events.

- [ ] **Step 3: Rewrite `TaskDialog.vue`**

Replace the entire contents of `src/components/TaskDialog.vue` with:

```vue
<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}

.chips {
	display: flex;
	gap: 0.5rem;
	margin-top: 0.5rem;
}
</style>

<template>
	<entity-dialog
		v-model="open"
		:title="t('task.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<template v-if="editing">
				<v-text-field
					v-model="name"
					:label="t('entity.name')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="onSave"
				/>
				<v-textarea v-model="note" :label="t('entity.note')" rows="3" />
				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('task.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('task.urgent')" color="primary" hide-details />
				</div>
				<v-select
					v-model="goalId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('task.goalLabel')"
				/>
				<schedule-field v-model="schedule" />
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
				<p v-if="goalName" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('task.goalLabel') }}: {{ goalName }}
				</p>
				<p v-if="schedule" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('task.schedule.label') }}: {{ scheduleSummary }}
				</p>
				<task-completions
					v-if="showCompletions"
					:occurrences="occurrences"
					:locale="locale"
					@toggle-done="onToggleDone"
					@toggle-skip="onToggleSkip"
				/>
				<div v-if="important || urgent" :class="$style.chips">
					<v-chip v-if="important" size="small" color="primary">{{ t('task.important') }}</v-chip>
					<v-chip v-if="urgent" size="small" color="primary">{{ t('task.urgent') }}</v-chip>
				</div>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import ScheduleField from './ScheduleField.vue';
import TaskCompletions from './TaskCompletions.vue';
import { describeRecurrence, formatWallClock, listOccurrences, parseRRule } from '@/utils/schedule';
import { isPeriodic, type Schedule, type Task } from '@/types';
import type { TaskDraft } from '@/stores/tasks';

const PAST_WINDOW = 5;
const FUTURE_WINDOW = 5;

const props = withDefaults(
	defineProps<{
		record?: Task | null;
		mode?: 'add' | 'edit';
		goalOptions: Array<{ value: string; title: string }>;
	}>(),
	{ record: null, mode: 'edit' },
);

const emit = defineEmits<{
	save: [draft: TaskDraft];
	cancel: [];
	'toggle-completion-done': [taskId: string, occurrence: string, done: boolean];
	'toggle-completion-skip': [taskId: string, occurrence: string, skipped: boolean];
}>();

const open = defineModel<boolean>({ required: true });

const { t, locale } = useI18n();

const name = ref('');
const note = ref('');
const important = ref(false);
const urgent = ref(false);
const goalId = ref('');
const schedule = ref<Schedule | undefined>(undefined);
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

const selectItems = computed(() => [{ value: '', title: t('task.noGoal') }, ...props.goalOptions]);

const goalName = computed(
	() => selectItems.value.find((item) => item.value === goalId.value)?.title,
);

const scheduleSummary = computed(() => {
	if (schedule.value === undefined) {
		return '';
	}

	if (schedule.value.rrule === undefined) {
		return formatWallClock(schedule.value.start, locale.value);
	}

	const rule = parseRRule(schedule.value.rrule);
	if (rule === undefined) {
		return formatWallClock(schedule.value.start, locale.value);
	}

	return describeRecurrence(rule, t, locale.value);
});

const showCompletions = computed(() => props.record !== null && isPeriodic(props.record));

const occurrences = computed(() => {
	const record = props.record;
	if (record === null || record.schedule === undefined || !isPeriodic(record)) {
		return [];
	}

	return listOccurrences(record.schedule, record.completions, new Date(), PAST_WINDOW, FUTURE_WINDOW);
});

function onToggleDone(occurrence: string, done: boolean): void {
	if (props.record === null) {
		return;
	}

	emit('toggle-completion-done', props.record.id, occurrence, done);
}

function onToggleSkip(occurrence: string, skipped: boolean): void {
	if (props.record === null) {
		return;
	}

	emit('toggle-completion-skip', props.record.id, occurrence, skipped);
}

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.record?.name ?? '';
		note.value = props.record?.note ?? '';
		important.value = props.record?.important ?? false;
		urgent.value = props.record?.urgent ?? false;
		goalId.value = props.record?.goalId ?? '';
		schedule.value = props.record?.schedule;
		showErrors.value = false;
	},
	{ immediate: true },
);

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('save', {
		name: name.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: important.value,
		urgent: urgent.value,
		goalId: goalId.value === '' ? undefined : goalId.value,
		schedule: schedule.value,
	});
	open.value = false;
}
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/TaskDialog.test.ts`
Expected: PASS — every test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/TaskDialog.vue src/components/TaskDialog.test.ts
git commit -m "feat: wire completion history into TaskDialog"
```

---

### Task 8: Wire completion history actions into `TaskList.vue`

**Files:**
- Modify: `src/pages/TasksPage/containers/TaskList.vue`
- Test: `src/pages/TasksPage/containers/TaskList.test.ts`

**Interfaces:**
- Consumes: `tasks.setOccurrenceDone`/`tasks.setOccurrenceSkipped` (Task 5); `TaskDialog`'s `record` prop and `toggle-completion-done`/`toggle-completion-skip` events (Task 7).
- Produces: no new exports — this is the top of the call chain for this feature.

- [ ] **Step 1: Write the failing tests**

Add to `src/pages/TasksPage/containers/TaskList.test.ts`. First add `type Schedule` to the existing type import on line 8 (it already imports `type Schedule` — confirm, and add it if missing):

```ts
import { Status, type Goal, type Schedule, type Task } from '@/types';
```

Then add this new `describe` block after the existing `describe('TaskList schedule', ...)` block:

```ts
describe('TaskList completions', () => {
	it('marking an occurrence done from the open dialog calls the store action and updates the dialog live', async () => {
		const schedule: Schedule = { start: '2020-01-03T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const { wrapper, tasksStore } = await mountWithData([], [makeTask({ schedule })]);

		await wrapper.get('.v-list-item').trigger('click');
		expect(wrapper.text()).not.toContain('time done');

		await wrapper.get('button[aria-label="Mark done"]').trigger('click');

		expect(tasksStore.records[0].completions).toHaveLength(1);
		expect(tasksStore.records[0].completions?.[0].done).toBe(true);
		expect(wrapper.text()).toContain('1 time done');
	});

	it('skipping an occurrence from the open dialog calls the store action', async () => {
		const schedule: Schedule = { start: '2020-01-03T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const { wrapper, tasksStore } = await mountWithData([], [makeTask({ schedule })]);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Skip"]').trigger('click');

		expect(tasksStore.records[0].schedule?.exdate).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/pages/TasksPage/containers/TaskList.test.ts`
Expected: FAIL — `TaskDialog` inside `TaskList` is still passed `:initial="initialDraft"`, and no `button[aria-label="Mark done"]` exists in the rendered tree.

- [ ] **Step 3: Rewrite the relevant parts of `TaskList.vue`**

In `src/pages/TasksPage/containers/TaskList.vue`, replace the `<task-dialog>` element (lines 17-24):

```vue
		<task-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			:goal-options="goalOptions"
			@save="handleSave"
			@cancel="onCancel"
		/>
```

with:

```vue
		<task-dialog
			v-model="dialogOpen"
			mode="edit"
			:record="editingTask"
			:goal-options="goalOptions"
			@save="handleSave"
			@cancel="onCancel"
			@toggle-completion-done="onToggleCompletionDone"
			@toggle-completion-skip="onToggleCompletionSkip"
		/>
```

Replace the `editing`/`initialDraft` block (lines 84-93):

```ts
const dialogOpen = ref(false);
const editing = ref<Task | null>(null);
const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent, goalId, schedule } = editing.value;
	return { name, note, important, urgent, goalId, schedule };
});
```

with:

```ts
const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const editingTask = computed<Task | null>(
	() => tasks.records.find((task) => task.id === editingId.value) ?? null,
);
```

Update `goalOptions` (line 97, `editing.value?.goalId` becomes `editingTask.value?.goalId`):

```ts
const goalOptions = computed(() => {
	const options = goals.active.map((goal) => ({ value: goal.id, title: goal.name }));
	const currentGoalId = editingTask.value?.goalId;
	...
```

Update `openEdit`, `handleSave`, `onCancel` (lines 109-132):

```ts
function openEdit(task: Task): void {
	editingId.value = task.id;
	dialogOpen.value = true;
}

async function handleSave(draft: TaskDraft): Promise<void> {
	if (editingId.value === null) {
		return;
	}

	await tasks.update(editingId.value, draft);
	editingId.value = null;
}

function onCancel(): void {
	const id = editingId.value;
	if (id === null) {
		return;
	}

	void tasks.close(id, Status.Cancelled);
	dialogOpen.value = false;
	editingId.value = null;
}

function onToggleCompletionDone(taskId: string, occurrence: string, done: boolean): void {
	void tasks.setOccurrenceDone(taskId, occurrence, done);
}

function onToggleCompletionSkip(taskId: string, occurrence: string, skipped: boolean): void {
	void tasks.setOccurrenceSkipped(taskId, occurrence, skipped);
}
```

`TaskDraft` is no longer used as a type for `initialDraft`'s `Partial<...>`, but it is still needed for `handleSave`'s parameter type — keep the existing `import { useTasksStore, type TaskDraft } from '@/stores/tasks';` import unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/pages/TasksPage/containers/TaskList.test.ts`
Expected: PASS — every test in the file, including all pre-existing ones (none of them reference `editing` directly, only DOM behavior, which is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/pages/TasksPage/containers/TaskList.vue src/pages/TasksPage/containers/TaskList.test.ts
git commit -m "feat: wire completion history actions into TaskList"
```

---

### Task 9: Full verification and manual browser check

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: PASS — every test file, including all eight tasks' additions.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. Pay particular attention to `vue/block-order` on `TaskDialog.vue` and `TaskCompletions.vue` (style → template → script), and to unused-import warnings — `TaskDraft` must still be used in `TaskList.vue` for `handleSave`'s parameter even though `initialDraft` is gone.

- [ ] **Step 3: Run the build (type-check)**

Run: `npm run build`
Expected: no `vue-tsc` errors. Watch specifically for:
- `TaskDialog.vue`'s `props.record` being `Task | null` — every read of `props.record.<field>` must go through `?.` or an explicit `!== null` guard first.
- `applyLastOccurrenceStatus`'s `schedule: Task['schedule']` parameter type in `tasks.ts` resolving correctly against `Schedule | undefined`.
- `listOccurrences`'s `completions: Completion[] | undefined` parameter matching `Task['completions']` exactly at every call site (`TaskDialog.vue`'s `occurrences` computed, any test file).

- [ ] **Step 4: Run the e2e suite**

Run: `npm run test:e2e`
Expected: PASS — no existing e2e flow touches completion history directly (out of scope for this plan's Playwright coverage), so this run is a regression check that nothing in the task pages broke.

- [ ] **Step 5: Manual verification in a real browser**

Per CLAUDE.md's storage trap (IndexedDB rejects the reactive proxies that satisfy in-memory-repository unit tests): `npm run build && npm run preview`, then in **Edge** (not Chrome — see CLAUDE.md's Chrome/Cache-API trap):

1. Create a periodic task (e.g. weekly, no end) via `AddEntityDialog`.
2. Open it from the task list; confirm the Completions section appears with a window of occurrences.
3. Mark a pending occurrence done; confirm the checkmark updates immediately, without closing the dialog.
4. Reload the page; reopen the task; confirm the mark survived (IndexedDB round-trip).
5. Skip a different pending occurrence; confirm it shows as skipped with an un-skip action, and reload to confirm `exdate` survived.
6. Create a task bounded by `COUNT` small enough to reach on screen (e.g. 3 occurrences, weekly); mark the last occurrence done; confirm the task disappears from Active and appears in History as Done.
7. Reopen it from History, unmark that same occurrence; confirm it moves back to Active as Opened.
8. Cancel a periodic task manually (not via completions); mark its last occurrence done; confirm the status stays Cancelled (does not flip to Done).
9. Edit an unrelated field (e.g. the note) on a task that already has completions/exdate; save; confirm both survive untouched (regression check for the `record`-prop rewrite of `TaskDialog`).

- [ ] **Step 6: Report results**

Summarize pass/fail for each of steps 1-5 above. No commit for this task.
