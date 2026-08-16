# Stage 1a: Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dream/goal/task data layer — types, guards, storage, garbage collection, stores and merge rules — alongside the existing `Todo` stack, fully tested and not yet wired to any page.

**Architecture:** Every new file is additive. `types/todo.ts`, `stores/todos.ts`, `repositories/TodoStorage.ts` and `repositories/IndexedDbRepository.ts` stay untouched so the app keeps building and every task ends green. Stage 1b switches the pages over and deletes the old stack. The one existing file this plan modifies is `SyncMerger.ts`, and it is generalised by a structural constraint (`id` + `updated`) that both `Todo` and `EntityBase` already satisfy, so `SyncFlow.vue` keeps compiling unchanged.

**Tech Stack:** TypeScript 6, Vue 3.5, Pinia 4, `idb`, `rrule` (new), Vitest 4, `fake-indexeddb`, Playwright.

**Spec:** [docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md](../specs/2026-08-16-dreams-goals-tasks-design.md)

## Global Constraints

- Every file in the repository is English — code, comments, docs, commit messages. Only `src/i18n/locales/*.json` may be otherwise.
- Formatting: tabs, `tabWidth: 2`, single quotes, `printWidth: 100`, `trailingComma: all`. Run `npm run format` before committing if unsure.
- Imports inside `src` use the `@/` alias; a file uses a relative import only for a sibling in the same folder.
- Prefer named exports. Every folder re-exports through an `index.ts` barrel.
- `services/` and `repositories/` know nothing about Vue or Pinia.
- Records written to storage must be plain copies (`{ ...record }`). IndexedDB rejects Vue's reactive proxies through structured clone; the in-memory repository accepts them silently, so unit tests will not catch a mistake here.
- `updated` moves on every user-facing change — but **never** on garbage collection.
- Enums are real `enum`s. `const enum` is impossible: `isolatedModules` is on.
- Cleanup window default is 30 days. The setting that overrides it arrives in stage 2.
- After every task: `npm test`, `npm run lint` and `npm run build` must pass. `npm run test:e2e` must pass after tasks 1 and 7.

---

### Task 1: End-to-end guard against silent data loss

The e2e suite never reloads the page, so the project's most expensive documented trap — records that render correctly and vanish on reload, because Vue's reactive proxies cannot be structured-cloned into IndexedDB — passes every existing test. This task closes that hole **before** any refactoring, against the current model, so the rest of the plan is guarded.

**Files:**

- Modify: `e2e/todo-crud.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing importable. Later tasks rely on this test existing as a regression gate.

- [ ] **Step 1: Write the failing test**

Append to `e2e/todo-crud.spec.ts`:

```ts
test('a task survives a page reload', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Survives reload');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Survives reload')).toBeVisible();

	await page.reload();

	// Rendering the task is not enough: it has to come back from IndexedDB.
	await expect(page.getByText('Survives reload')).toBeVisible();
});
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test e2e/todo-crud.spec.ts -g "survives a page reload"`

Expected: **PASS**. This test documents behaviour that already works; it is a regression gate, not a bug report. If it fails, stop and report — that means the current `main` already loses data, which changes the plan.

- [ ] **Step 3: Commit**

```bash
git add e2e/todo-crud.spec.ts
git commit -m "test: guard task persistence across a reload

The suite never reloaded the page, so a record that renders correctly and
vanishes on reload passed every test. That is the documented failure mode
when a Vue reactive proxy reaches IndexedDB, so it needs its own gate
before the data model is reworked."
```

---

### Task 2: Entity types, enums, guards and parsers

**Files:**

- Create: `src/types/entity.ts`
- Create: `src/types/dream.ts`
- Create: `src/types/goal.ts`
- Create: `src/types/task.ts`
- Create: `src/types/index.ts`
- Test: `src/types/entity.test.ts`, `src/types/dream.test.ts`, `src/types/goal.test.ts`, `src/types/task.test.ts`
- Modify: `package.json` (add `rrule`)

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `enum Status { Opened = 1, Done = 2, Cancelled = 3 }`
  - `interface EntityBase { id: string; name: string; note?: string; created: string; updated: string; status: Status }`
  - `function isStatus(value: unknown): value is Status`
  - `class EntityFormatError extends Error`
  - `interface Dream extends EntityBase {}`, `function parseDream(value: unknown): Dream`
  - `enum Season { Winter = 1, Spring = 2, Summer = 3, Autumn = 4 }`
  - `function isSeason(value: unknown): value is Season`
  - `interface Deadline { year?: number; month?: number; day?: number; season?: Season }`
  - `interface Goal extends EntityBase { dreamId?: string; deadline?: Deadline }`, `function parseGoal(value: unknown): Goal`
  - `interface Schedule { start: string; tzid?: string; duration?: string; rrule?: string; exdate?: string[]; rdate?: string[] }`
  - `interface Completion { occurrence: string; done: boolean; at: string }`
  - `interface Task extends EntityBase { goalId?: string; important: boolean; urgent: boolean; schedule?: Schedule; completions?: Completion[] }`
  - `function parseTask(value: unknown): Task`
  - `function isPeriodic(task: Task): boolean`

- [ ] **Step 1: Install the recurrence library**

Run: `npm install rrule`

Expected: `rrule` appears under `dependencies` in `package.json`. It is needed here, not in stage 7, because `parseTask` validates the rule string with the library's own parser rather than a hand-written one.

- [ ] **Step 2: Write the failing tests for the shared base**

Create `src/types/entity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EntityFormatError, Status, isStatus, parseEntityBase } from './entity';

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'id-1',
		name: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('isStatus', () => {
	it('accepts every declared member', () => {
		expect(isStatus(Status.Opened)).toBe(true);
		expect(isStatus(Status.Done)).toBe(true);
		expect(isStatus(Status.Cancelled)).toBe(true);
	});

	it('rejects a number outside the enum', () => {
		expect(isStatus(0)).toBe(false);
		expect(isStatus(7)).toBe(false);
	});

	it('rejects non-numbers', () => {
		expect(isStatus('1')).toBe(false);
		expect(isStatus(undefined)).toBe(false);
		expect(isStatus(null)).toBe(false);
	});
});

describe('parseEntityBase', () => {
	it('returns the base fields of a valid record', () => {
		expect(parseEntityBase(makeRaw())).toEqual({
			id: 'id-1',
			name: 'Buy milk',
			note: undefined,
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		});
	});

	it('keeps an optional note', () => {
		expect(parseEntityBase(makeRaw({ note: 'semi-skimmed' })).note).toBe('semi-skimmed');
	});

	it('rejects a value that is not an object', () => {
		expect(() => parseEntityBase('nope')).toThrow(EntityFormatError);
		expect(() => parseEntityBase(null)).toThrow(EntityFormatError);
		expect(() => parseEntityBase([])).toThrow(EntityFormatError);
	});

	it('rejects a missing or non-string id, name, created or updated', () => {
		for (const key of ['id', 'name', 'created', 'updated']) {
			expect(() => parseEntityBase(makeRaw({ [key]: undefined }))).toThrow(EntityFormatError);
			expect(() => parseEntityBase(makeRaw({ [key]: 42 }))).toThrow(EntityFormatError);
		}
	});

	it('rejects a status outside the enum', () => {
		expect(() => parseEntityBase(makeRaw({ status: 7 }))).toThrow(EntityFormatError);
	});

	it('rejects a non-string note when present', () => {
		expect(() => parseEntityBase(makeRaw({ note: 42 }))).toThrow(EntityFormatError);
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/types/entity.test.ts`
Expected: FAIL — `Failed to resolve import "./entity"`.

- [ ] **Step 4: Implement the shared base**

Create `src/types/entity.ts`:

```ts
export enum Status {
	Opened = 1,
	Done = 2,
	Cancelled = 3,
}

export interface EntityBase {
	id: string;
	name: string;
	note?: string;
	/** ISO 8601 timestamp in UTC. */
	created: string;
	/** ISO 8601 timestamp in UTC, moved on every user-facing change. Drives sync merges. */
	updated: string;
	status: Status;
}

/**
 * Thrown when data crossing a boundary — a backup file, an IndexedDB row —
 * does not describe a valid record. A real `enum` lets the compiler wave
 * `value as Status` through, so the check has to happen at runtime.
 */
export class EntityFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'EntityFormatError';
	}
}

export function isStatus(value: unknown): value is Status {
	return value === Status.Opened || value === Status.Done || value === Status.Cancelled;
}

export function isRecordObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fail(reason: string): never {
	throw new EntityFormatError(reason);
}

export function readString(entry: Record<string, unknown>, key: string): string {
	const value = entry[key];
	if (typeof value !== 'string') {
		fail(`"${key}" must be a string`);
	}

	return value;
}

export function readOptionalString(
	entry: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = entry[key];
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'string') {
		fail(`"${key}" must be a string when present`);
	}

	return value;
}

export function readBoolean(entry: Record<string, unknown>, key: string): boolean {
	const value = entry[key];
	if (typeof value !== 'boolean') {
		fail(`"${key}" must be true or false`);
	}

	return value;
}

export function parseEntityBase(value: unknown): EntityBase {
	if (!isRecordObject(value)) {
		fail('the record is not an object');
	}

	if (!isStatus(value.status)) {
		fail('"status" must be one of Opened, Done, Cancelled');
	}

	return {
		id: readString(value, 'id'),
		name: readString(value, 'name'),
		note: readOptionalString(value, 'note'),
		created: readString(value, 'created'),
		updated: readString(value, 'updated'),
		status: value.status,
	};
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/types/entity.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for dreams**

Create `src/types/dream.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EntityFormatError, Status } from './entity';
import { parseDream } from './dream';

describe('parseDream', () => {
	it('parses a valid dream', () => {
		const raw = {
			id: 'id-1',
			name: 'Visit Japan',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		};

		expect(parseDream(raw)).toEqual({ ...raw, note: undefined });
	});

	it('rejects a record with a broken base', () => {
		expect(() => parseDream({ id: 'id-1' })).toThrow(EntityFormatError);
	});
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/types/dream.test.ts`
Expected: FAIL — `Failed to resolve import "./dream"`.

- [ ] **Step 8: Implement dreams**

Create `src/types/dream.ts`:

```ts
import { parseEntityBase, type EntityBase } from './entity';

/**
 * A dream carries nothing beyond the shared base yet. The distinct type
 * still earns its place: it keeps stores and repositories for the three
 * entities from being interchangeable by accident.
 */
export type Dream = EntityBase;

export function parseDream(value: unknown): Dream {
	return parseEntityBase(value);
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `npx vitest run src/types/dream.test.ts`
Expected: PASS.

- [ ] **Step 10: Write the failing test for goals**

Create `src/types/goal.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { EntityFormatError, Status } from './entity';
import { Season, isSeason, parseGoal } from './goal';

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
		expect(() => parseGoal(makeRaw({ dreamId: 42 }))).toThrow(EntityFormatError);
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
			EntityFormatError,
		);
	});

	it('rejects a month and a season together', () => {
		expect(() =>
			parseGoal(makeRaw({ deadline: { year: 2027, month: 3, season: Season.Summer } })),
		).toThrow(EntityFormatError);
	});

	it('rejects an empty deadline', () => {
		expect(() => parseGoal(makeRaw({ deadline: {} }))).toThrow(EntityFormatError);
	});

	it('rejects out-of-range months and days', () => {
		expect(() => parseGoal(makeRaw({ deadline: { month: 0 } }))).toThrow(EntityFormatError);
		expect(() => parseGoal(makeRaw({ deadline: { month: 13 } }))).toThrow(EntityFormatError);
		expect(() => parseGoal(makeRaw({ deadline: { month: 3, day: 0 } }))).toThrow(EntityFormatError);
		expect(() => parseGoal(makeRaw({ deadline: { month: 3, day: 32 } }))).toThrow(
			EntityFormatError,
		);
	});

	it('rejects a non-integer year', () => {
		expect(() => parseGoal(makeRaw({ deadline: { year: 2027.5 } }))).toThrow(EntityFormatError);
	});
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `npx vitest run src/types/goal.test.ts`
Expected: FAIL — `Failed to resolve import "./goal"`.

- [ ] **Step 12: Implement goals**

Create `src/types/goal.ts`:

```ts
import { fail, isRecordObject, parseEntityBase, type EntityBase } from './entity';

export enum Season {
	Winter = 1,
	Spring = 2,
	Summer = 3,
	Autumn = 4,
}

/**
 * Deliberately vague-capable: "in 2027", "summer 2027", "March 2027" and
 * "15 March 2027" are all things people mean. The constraints run between
 * fields, so they are checked here rather than expressed in the type.
 */
export interface Deadline {
	year?: number;
	/** 1–12. */
	month?: number;
	/** 1–31, requires a month. */
	day?: number;
	/** Mutually exclusive with month and day. */
	season?: Season;
}

export interface Goal extends EntityBase {
	dreamId?: string;
	deadline?: Deadline;
}

export function isSeason(value: unknown): value is Season {
	return (
		value === Season.Winter ||
		value === Season.Spring ||
		value === Season.Summer ||
		value === Season.Autumn
	);
}

function readOptionalInteger(
	entry: Record<string, unknown>,
	key: string,
	min: number,
	max: number,
): number | undefined {
	const value = entry[key];
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
		fail(`"${key}" must be a whole number between ${min} and ${max}`);
	}

	return value;
}

export function parseDeadline(value: unknown): Deadline {
	if (!isRecordObject(value)) {
		fail('"deadline" must be an object');
	}

	const year = readOptionalInteger(value, 'year', 1, 9999);
	const month = readOptionalInteger(value, 'month', 1, 12);
	const day = readOptionalInteger(value, 'day', 1, 31);

	let season: Season | undefined;
	if (value.season !== undefined) {
		if (!isSeason(value.season)) {
			fail('"season" must be one of Winter, Spring, Summer, Autumn');
		}
		season = value.season;
	}

	if (day !== undefined && month === undefined) {
		fail('"deadline.day" requires a month');
	}

	if (season !== undefined && (month !== undefined || day !== undefined)) {
		fail('"deadline" cannot carry both a season and a month');
	}

	if (year === undefined && month === undefined && season === undefined) {
		fail('"deadline" must carry at least one field');
	}

	return { year, month, day, season };
}

export function parseGoal(value: unknown): Goal {
	const base = parseEntityBase(value);
	const entry = value as Record<string, unknown>;

	const dreamId = entry.dreamId;
	if (dreamId !== undefined && typeof dreamId !== 'string') {
		fail('"dreamId" must be a string when present');
	}

	return {
		...base,
		dreamId,
		deadline: entry.deadline === undefined ? undefined : parseDeadline(entry.deadline),
	};
}
```

Note: `parseDeadline` returns keys with `undefined` values, which `toEqual` treats as absent — that is why the shape tests above pass.

- [ ] **Step 13: Run it to verify it passes**

Run: `npx vitest run src/types/goal.test.ts`
Expected: PASS.

- [ ] **Step 14: Write the failing test for tasks**

Create `src/types/task.test.ts`:

```ts
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
```

- [ ] **Step 15: Run it to verify it fails**

Run: `npx vitest run src/types/task.test.ts`
Expected: FAIL — `Failed to resolve import "./task"`.

- [ ] **Step 16: Implement tasks**

Create `src/types/task.ts`:

```ts
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
```

- [ ] **Step 17: Run it to verify it passes**

Run: `npx vitest run src/types/task.test.ts`
Expected: PASS. If `RRule.fromString('NONSENSE')` turns out not to throw, change the guard to also require the parsed result to carry a `freq`, and adjust the test's expectation to match what the library actually does — report which it was.

- [ ] **Step 18: Add the barrel**

Create `src/types/index.ts`:

```ts
export * from './entity';
export * from './dream';
export * from './goal';
export * from './task';
```

Leave `src/types/todo.ts` out of the barrel: it is deleted in stage 1b, and nothing new should start importing it.

- [ ] **Step 19: Run the full suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 20: Commit**

```bash
git add package.json package-lock.json src/types
git commit -m "feat: add dream, goal and task types with runtime guards

The enums are real enums, so the compiler waves 'value as Status' through
and a 7 could reach storage. The guards and parsers live next to their
types because types/ is the terminal node of the dependency chain, which
lets both BackupService and the repositories share one parser instead of
duplicating validation.

parseTask validates the recurrence rule with rrule's own parser rather
than a hand-written one, which is why the dependency lands here."
```

---

### Task 3: Garbage collection

**Files:**

- Create: `src/utils/collectGarbage.ts`
- Create: `src/utils/index.ts`
- Test: `src/utils/collectGarbage.test.ts`

**Interfaces:**

- Consumes: `EntityBase`, `Status` from `@/types`; `Task`, `Completion` from `@/types`.
- Produces:
  - `const DEFAULT_CLEANUP_DAYS = 30`
  - `function collectGarbage<T extends EntityBase>(records: T[], windowDays: number, now: Date): { keep: T[]; purge: string[] }`
  - `function pruneCompletions(task: Task, windowDays: number, now: Date): Task`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/collectGarbage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Status, type EntityBase, type Task } from '@/types';
import { DEFAULT_CLEANUP_DAYS, collectGarbage, pruneCompletions } from './collectGarbage';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function daysBefore(days: number): string {
	return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeRecord(overrides: Partial<EntityBase> = {}): EntityBase {
	return {
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

describe('DEFAULT_CLEANUP_DAYS', () => {
	it('is thirty days', () => {
		expect(DEFAULT_CLEANUP_DAYS).toBe(30);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/collectGarbage.test.ts`
Expected: FAIL — `Failed to resolve import "./collectGarbage"`.

- [ ] **Step 3: Implement the collector**

Create `src/utils/collectGarbage.ts`:

```ts
import { Status, type EntityBase, type Task } from '@/types';

export const DEFAULT_CLEANUP_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface CollectionResult<T> {
	keep: T[];
	/** Ids to hand to `storage.remove`. */
	purge: string[];
}

/**
 * A closed record is the tombstone: it stays in storage with an honest
 * `updated`, so a merge sees it and cannot resurrect what was closed.
 * Physical deletion happens only here, and only once the record is older
 * than the window — which is therefore the longest two devices may stay
 * apart without losing a closure.
 *
 * Deliberately takes `now` rather than reading the clock: the rule has to
 * be deterministic, because both devices must reach the same answer.
 *
 * Collection never moves `updated`. It is not a user-facing change, and a
 * moved timestamp would hand the collecting device an unearned win in the
 * next merge simply for having started up.
 */
export function collectGarbage<T extends EntityBase>(
	records: T[],
	windowDays: number,
	now: Date,
): CollectionResult<T> {
	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const keep: T[] = [];
	const purge: string[] = [];

	for (const record of records) {
		const expired = record.status !== Status.Opened && Date.parse(record.updated) < cutoff;

		if (expired) {
			purge.push(record.id);
		} else {
			keep.push(record);
		}
	}

	return { keep, purge };
}

/**
 * A recurring task is always Opened, so the collector above never touches
 * it and its marks would grow without bound — a daily task over five years
 * is roughly 1800 entries, and the whole sync payload has to fit in 200 KB.
 *
 * Marks are pruned by `occurrence`, the date the mark is about, not by
 * `at`, the moment it was made.
 */
export function pruneCompletions(task: Task, windowDays: number, now: Date): Task {
	if (task.completions === undefined) {
		return task;
	}

	const cutoff = now.getTime() - windowDays * MS_PER_DAY;
	const completions = task.completions.filter(
		(completion) => Date.parse(completion.occurrence) >= cutoff,
	);

	if (completions.length === task.completions.length) {
		return task;
	}

	return { ...task, completions };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/collectGarbage.test.ts`
Expected: PASS.

Note on the boundary test: `daysBefore(30)` is exactly the cutoff, and `<` keeps it. If the test for "the boundary itself" fails, the comparison is the thing to fix, not the test.

Note on `Date.parse` of a wall-clock string: `'2026-01-01T09:00'` without a zone is parsed as local time, which is correct here — occurrences are wall-clock, and comparing them to a local cutoff is the intended reading. The small offset this introduces at the window edge is irrelevant at a 30-day scale.

- [ ] **Step 5: Add the barrel**

Create `src/utils/index.ts`:

```ts
export * from './collectGarbage';
```

Delete `src/utils/.gitkeep` — the folder now has real content.

- [ ] **Step 6: Run the full suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/utils
git rm src/utils/.gitkeep
git commit -m "feat: add the closed-record garbage collector

Closed records are the tombstones, so physical deletion happens only here
and only past the cleanup window. The rule takes 'now' as an argument and
never moves 'updated': both devices must reach the same answer, and a
moved timestamp would win the next merge just for having started up.

Completions prune separately because a recurring task stays Opened
forever and would otherwise outgrow the 200 KB sync payload."
```

---

### Task 4: Generic storage, the shared database and the repositories

**Files:**

- Create: `src/repositories/EntityStorage.ts`
- Create: `src/repositories/AppDatabase.ts`
- Create: `src/repositories/EntityDbRepository.ts`
- Create: `src/repositories/EntityMemoryRepository.ts`
- Test: `src/repositories/EntityDbRepository.test.ts`, `src/repositories/EntityMemoryRepository.test.ts`

The existing `TodoStorage.ts`, `IndexedDbRepository.ts` and `InMemoryRepository.ts` are **left alone**; stage 1b deletes them and renames these into their place.

**Interfaces:**

- Consumes: `Dream`, `Goal`, `Task`, `EntityBase`, `parseDream`, `parseGoal`, `parseTask` from `@/types`.
- Produces:
  - `interface EntityStorage<T extends EntityBase> { getAll(): Promise<T[]>; put(record: T): Promise<void>; remove(id: string): Promise<void>; clear(): Promise<void> }`
  - `class StorageUnavailableError extends Error` (re-declared here; the old one stays where it is until 1b)
  - `type StoreName = 'dreams' | 'goals' | 'tasks'`
  - `function openAppDatabase(): Promise<IDBPDatabase<AppDbSchema>>`
  - `const APP_DB_NAME = 'todo'`, `const APP_DB_VERSION = 3`
  - `class EntityDbRepository<T extends EntityBase> implements EntityStorage<T>` with `static create<T>(storeName: StoreName, parse: (value: unknown) => T): Promise<EntityDbRepository<T>>` and `skipped: number`
  - `class EntityMemoryRepository<T extends EntityBase> implements EntityStorage<T>` with `constructor(seed?: T[])`

- [ ] **Step 1: Write the interface and the error**

Create `src/repositories/EntityStorage.ts`:

```ts
import type { EntityBase } from '@/types';

/**
 * The seam that keeps the stores from knowing IndexedDB sits underneath —
 * which is what lets their tests run without a browser.
 */
export interface EntityStorage<T extends EntityBase> {
	getAll(): Promise<T[]>;
	put(record: T): Promise<void>;
	remove(id: string): Promise<void>;
	clear(): Promise<void>;
}

export class StorageUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Persistent storage is unavailable', { cause });
		this.name = 'StorageUnavailableError';
	}
}
```

- [ ] **Step 2: Write the failing test for the in-memory repository**

Create `src/repositories/EntityMemoryRepository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Status, type Dream } from '@/types';
import { EntityMemoryRepository } from './EntityMemoryRepository';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'id-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('EntityMemoryRepository', () => {
	it('starts empty', async () => {
		await expect(new EntityMemoryRepository<Dream>().getAll()).resolves.toEqual([]);
	});

	it('returns what it was seeded with', async () => {
		const repository = new EntityMemoryRepository([makeDream()]);

		await expect(repository.getAll()).resolves.toEqual([makeDream()]);
	});

	it('replaces a record with the same id', async () => {
		const repository = new EntityMemoryRepository([makeDream()]);

		await repository.put(makeDream({ name: 'Renamed' }));

		const all = await repository.getAll();
		expect(all).toHaveLength(1);
		expect(all[0].name).toBe('Renamed');
	});

	it('removes by id and clears everything', async () => {
		const repository = new EntityMemoryRepository([makeDream(), makeDream({ id: 'id-2' })]);

		await repository.remove('id-1');
		await expect(repository.getAll()).resolves.toHaveLength(1);

		await repository.clear();
		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('hands out copies so callers cannot mutate its state', async () => {
		const repository = new EntityMemoryRepository([makeDream()]);

		const [first] = await repository.getAll();
		first.name = 'Mutated';

		const [second] = await repository.getAll();
		expect(second.name).toBe('Visit Japan');
	});
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/repositories/EntityMemoryRepository.test.ts`
Expected: FAIL — unresolved import.

- [ ] **Step 4: Implement the in-memory repository**

Create `src/repositories/EntityMemoryRepository.ts`:

```ts
import type { EntityBase } from '@/types';
import type { EntityStorage } from './EntityStorage';

/**
 * No singleton, deliberately: this holds independent, disposable state —
 * a fallback instance, or a seeded one in a test — and must never be shared.
 */
export class EntityMemoryRepository<T extends EntityBase> implements EntityStorage<T> {
	private readonly items: Map<string, T>;

	constructor(seed: T[] = []) {
		this.items = new Map(seed.map((record) => [record.id, { ...record }]));
	}

	async getAll(): Promise<T[]> {
		return [...this.items.values()].map((record) => ({ ...record }));
	}

	async put(record: T): Promise<void> {
		this.items.set(record.id, { ...record });
	}

	async remove(id: string): Promise<void> {
		this.items.delete(id);
	}

	async clear(): Promise<void> {
		this.items.clear();
	}
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run src/repositories/EntityMemoryRepository.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing test for the database and the IndexedDB repository**

Create `src/repositories/EntityDbRepository.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteDB, openDB } from 'idb';
import { Status, parseDream, parseTask, type Dream, type Task } from '@/types';
import { StorageUnavailableError } from './EntityStorage';
import { APP_DB_NAME } from './AppDatabase';
import { EntityDbRepository } from './EntityDbRepository';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'id-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		...makeDream(),
		id: 'task-1',
		important: false,
		urgent: false,
		...overrides,
	};
}

afterEach(async () => {
	await deleteDB(APP_DB_NAME);
});

describe('EntityDbRepository', () => {
	it('starts empty', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);

		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('persists a record across separate connections', async () => {
		const first = await EntityDbRepository.create('dreams', parseDream);
		await first.put(makeDream());

		const second = await EntityDbRepository.create('dreams', parseDream);

		await expect(second.getAll()).resolves.toEqual([makeDream()]);
	});

	it('keeps the three stores apart', async () => {
		const dreams = await EntityDbRepository.create('dreams', parseDream);
		const tasks = await EntityDbRepository.create('tasks', parseTask);

		await dreams.put(makeDream());
		await tasks.put(makeTask());

		await expect(dreams.getAll()).resolves.toHaveLength(1);
		await expect(tasks.getAll()).resolves.toHaveLength(1);
		expect((await dreams.getAll())[0].id).toBe('id-1');
		expect((await tasks.getAll())[0].id).toBe('task-1');
	});

	it('replaces a record with the same id', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);

		await repository.put(makeDream());
		await repository.put(makeDream({ status: Status.Done }));

		const all = await repository.getAll();
		expect(all).toHaveLength(1);
		expect(all[0].status).toBe(Status.Done);
	});

	it('removes a record and clears the store', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);
		await repository.put(makeDream());
		await repository.put(makeDream({ id: 'id-2' }));

		await repository.remove('id-1');
		await expect(repository.getAll()).resolves.toHaveLength(1);

		await repository.clear();
		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('skips and counts a row it cannot parse instead of failing the load', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);
		await repository.put(makeDream());

		// Write a broken row behind the repository's back, the way a future
		// schema change or a corrupted profile would.
		const raw = await openDB(APP_DB_NAME, 3);
		await raw.put('dreams', { id: 'broken', status: 99 } as never);
		raw.close();

		const loaded = await repository.getAll();

		expect(loaded).toHaveLength(1);
		expect(loaded[0].id).toBe('id-1');
		expect(repository.skipped).toBe(1);
	});

	it('resets the skipped count on each load', async () => {
		const repository = await EntityDbRepository.create('dreams', parseDream);

		await repository.getAll();

		expect(repository.skipped).toBe(0);
	});

	it('drops a leftover todos store from the previous schema', async () => {
		await deleteDB(APP_DB_NAME);
		const old = await openDB(APP_DB_NAME, 2, {
			upgrade(db) {
				db.createObjectStore('todos', { keyPath: 'id' });
			},
		});
		old.close();

		await EntityDbRepository.create('dreams', parseDream);

		const raw = await openDB(APP_DB_NAME, 3);
		expect([...raw.objectStoreNames].sort()).toEqual(['dreams', 'goals', 'tasks']);
		raw.close();
	});

	it('throws StorageUnavailableError when indexedDB is missing', async () => {
		const original = globalThis.indexedDB;
		// @ts-expect-error deliberately removing the global to simulate a browser without IndexedDB
		delete globalThis.indexedDB;

		try {
			await expect(EntityDbRepository.create('dreams', parseDream)).rejects.toBeInstanceOf(
				StorageUnavailableError,
			);
		} finally {
			globalThis.indexedDB = original;
		}
	});
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `npx vitest run src/repositories/EntityDbRepository.test.ts`
Expected: FAIL — unresolved imports.

- [ ] **Step 8: Implement the shared database**

Create `src/repositories/AppDatabase.ts`:

```ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Dream, Goal, Task } from '@/types';
import { StorageUnavailableError } from './EntityStorage';

export const APP_DB_NAME = 'todo';
export const APP_DB_VERSION = 3;

export const STORE_NAMES = ['dreams', 'goals', 'tasks'] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export interface AppDbSchema extends DBSchema {
	dreams: { key: string; value: Dream };
	goals: { key: string; value: Goal };
	tasks: { key: string; value: Task };
}

/**
 * One connection for all three stores. Three separate connections would
 * mean three copies of the `versionchange` handler, and forgetting one is
 * the documented trap where a second tab carrying a new schema hangs
 * forever waiting for the first to let go.
 */
export async function openAppDatabase(): Promise<IDBPDatabase<AppDbSchema>> {
	if (typeof indexedDB === 'undefined') {
		throw new StorageUnavailableError();
	}

	try {
		const database = await openDB<AppDbSchema>(APP_DB_NAME, APP_DB_VERSION, {
			upgrade(db) {
				// Version 3 starts clean. The old single-entity store is dropped
				// rather than migrated: there is no data worth carrying over, and
				// a migration would have to invent a shape for fields that never
				// existed.
				if (db.objectStoreNames.contains('todos' as never)) {
					db.deleteObjectStore('todos' as never);
				}

				for (const name of STORE_NAMES) {
					if (!db.objectStoreNames.contains(name)) {
						db.createObjectStore(name, { keyPath: 'id' });
					}
				}
			},
		});

		// Another tab upgrading or deleting the database stays blocked until
		// every other connection closes, so release ours as soon as it asks.
		database.addEventListener('versionchange', () => database.close());

		return database;
	} catch (error) {
		throw new StorageUnavailableError(error);
	}
}
```

- [ ] **Step 9: Implement the IndexedDB repository**

Create `src/repositories/EntityDbRepository.ts`:

```ts
import type { IDBPDatabase } from 'idb';
import type { EntityBase } from '@/types';
import type { EntityStorage } from './EntityStorage';
import { openAppDatabase, type AppDbSchema, type StoreName } from './AppDatabase';

export class EntityDbRepository<T extends EntityBase> implements EntityStorage<T> {
	/** How many rows the last `getAll` could not parse. */
	skipped = 0;

	private constructor(
		private readonly database: IDBPDatabase<AppDbSchema>,
		private readonly storeName: StoreName,
		private readonly parse: (value: unknown) => T,
	) {}

	/** Opening the connection is async, so this replaces `new`. */
	static async create<T extends EntityBase>(
		storeName: StoreName,
		parse: (value: unknown) => T,
	): Promise<EntityDbRepository<T>> {
		const database = await openAppDatabase();

		return new EntityDbRepository(database, storeName, parse);
	}

	/**
	 * A row that no longer parses is skipped and counted rather than fatal:
	 * one bad record must not cost the user the whole list. Nothing on disk
	 * is touched, so the damage stays recoverable through an export.
	 */
	async getAll(): Promise<T[]> {
		const rows = (await this.database.getAll(this.storeName)) as unknown[];
		const parsed: T[] = [];
		let skipped = 0;

		for (const row of rows) {
			try {
				parsed.push(this.parse(row));
			} catch {
				skipped += 1;
			}
		}

		this.skipped = skipped;

		return parsed;
	}

	async put(record: T): Promise<void> {
		// A plain copy: IndexedDB cannot structured-clone Vue's reactive proxies.
		await this.database.put(this.storeName, { ...record } as AppDbSchema[StoreName]['value']);
	}

	async remove(id: string): Promise<void> {
		await this.database.delete(this.storeName, id);
	}

	async clear(): Promise<void> {
		await this.database.clear(this.storeName);
	}
}
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run src/repositories/EntityDbRepository.test.ts`
Expected: PASS.

If TypeScript rejects the `put` cast, widen it to `as never` rather than loosening `AppDbSchema` — the schema's per-store typing is what makes the three stores safe to keep apart, and it should not be weakened to satisfy one line.

- [ ] **Step 11: Run the full suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass. The old `IndexedDbRepository` tests still run and still pass — both schemas coexist because `openAppDatabase` upgrades the same database to version 3 only when it is called.

If the old `IndexedDbRepository.test.ts` starts failing because both suites share the database name, add `await deleteDB(APP_DB_NAME)` to the failing suite's `afterEach` and report it.

- [ ] **Step 12: Commit**

```bash
git add src/repositories/EntityStorage.ts src/repositories/AppDatabase.ts src/repositories/EntityDbRepository.ts src/repositories/EntityMemoryRepository.ts src/repositories/EntityDbRepository.test.ts src/repositories/EntityMemoryRepository.test.ts
git commit -m "feat: add the three-store database and generic repositories

One connection serves all three stores: separate connections would mean
three copies of the versionchange handler, and a missed one is what hangs
a second tab carrying a new schema.

getAll skips and counts rows it cannot parse rather than failing the
load, so one damaged record cannot cost the user the whole list."
```

---

### Task 5: Shared storage state and the entity store factory

**Files:**

- Create: `src/stores/storage.ts`
- Create: `src/stores/createEntityStore.ts`
- Test: `src/stores/createEntityStore.test.ts`

**Interfaces:**

- Consumes: `EntityStorage`, `EntityMemoryRepository` from `@/repositories/*`; `collectGarbage`, `DEFAULT_CLEANUP_DAYS` from `@/utils`; `EntityBase`, `Status` from `@/types`.
- Produces:
  - `useStorageStore()` exposing `persistent: boolean`, `lastError: string | null`, `noteWriteFailure()`, `noteUnavailable()`, `noteAvailable()`, `dismissError()`
  - `function defineEntityStore<T extends EntityBase, D>(options: EntityStoreOptions<T, D>)` returning a Pinia store definition whose store exposes `records`, `active`, `closed`, `loading`, `cleanupDays`, `load(createRepository?)`, `add(draft)`, `update(id, patch)`, `close(id, status)`, `reopen(id)`, `replaceAll(records)`
  - `interface EntityStoreOptions<T extends EntityBase, D> { id: string; createRepository: () => Promise<EntityStorage<T>>; build: (draft: D, id: string, now: string) => T }`

- [ ] **Step 1: Write the shared storage store**

Create `src/stores/storage.ts`:

```ts
import { ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * `persistent` and `lastError` belong to storage as a whole, not to any one
 * entity. Three entity stores each carrying their own copy would make the
 * layout's warning depend on which store happened to fail last.
 */
export const useStorageStore = defineStore('storage', () => {
	const persistent = ref(true);
	const lastError = ref<string | null>(null);

	function noteAvailable(): void {
		persistent.value = true;
	}

	function noteUnavailable(): void {
		persistent.value = false;
	}

	function noteWriteFailure(): void {
		lastError.value = 'storage.writeFailed';
	}

	function noteLoadSkipped(count: number): void {
		if (count > 0) {
			lastError.value = 'storage.recordsSkipped';
		}
	}

	function dismissError(): void {
		lastError.value = null;
	}

	return {
		persistent,
		lastError,
		noteAvailable,
		noteUnavailable,
		noteWriteFailure,
		noteLoadSkipped,
		dismissError,
	};
});
```

- [ ] **Step 2: Write the failing tests for the factory**

Create `src/stores/createEntityStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Dream } from '@/types';
import { StorageUnavailableError, type EntityStorage } from '@/repositories/EntityStorage';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { defineEntityStore } from './createEntityStore';
import { useStorageStore } from './storage';

interface DreamDraft {
	name: string;
	note?: string;
}

const useTestStore = defineEntityStore<Dream, DreamDraft>({
	id: 'test-dreams',
	createRepository: async () => new EntityMemoryRepository<Dream>(),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
	}),
});

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'seeded',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('defineEntityStore load', () => {
	it('loads existing records from storage', async () => {
		const store = useTestStore();

		await store.load(async () => new EntityMemoryRepository([makeDream()]));

		expect(store.records).toHaveLength(1);
		expect(store.loading).toBe(false);
		expect(useStorageStore().persistent).toBe(true);
	});

	it('falls back to memory when storage is unavailable', async () => {
		const store = useTestStore();

		await store.load(async () => {
			throw new StorageUnavailableError();
		});

		expect(useStorageStore().persistent).toBe(false);
		expect(store.records).toEqual([]);
	});

	it('collects closed records past the window on load', async () => {
		const storage = new EntityMemoryRepository([
			makeDream({ id: 'open' }),
			makeDream({ id: 'stale', status: Status.Done, updated: daysAgo(400) }),
		]);
		const store = useTestStore();

		await store.load(async () => storage);

		expect(store.records.map((r) => r.id)).toEqual(['open']);
		await expect(storage.getAll()).resolves.toHaveLength(1);
	});
});

describe('defineEntityStore active and closed', () => {
	it('splits records by status', async () => {
		const store = useTestStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeDream({ id: 'a' }),
					makeDream({ id: 'b', status: Status.Done }),
					makeDream({ id: 'c', status: Status.Cancelled }),
				]),
		);

		expect(store.active.map((r) => r.id)).toEqual(['a']);
		expect(store.closed.map((r) => r.id)).toEqual(['b', 'c']);
	});
});

describe('defineEntityStore mutations', () => {
	it('adds a record with a generated id and matching timestamps', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository<Dream>());

		const created = await store.add({ name: 'Learn to sail' });

		expect(created.id).not.toBe('');
		expect(created.created).toBe(created.updated);
		expect(created.status).toBe(Status.Opened);
		expect(store.records).toHaveLength(1);
	});

	it('writes an added record through to storage', async () => {
		const storage = new EntityMemoryRepository<Dream>();
		const store = useTestStore();
		await store.load(async () => storage);

		await store.add({ name: 'Learn to sail' });

		await expect(storage.getAll()).resolves.toHaveLength(1);
	});

	it('updates a record and moves updated', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream()]));
		const before = store.records[0].updated;

		await store.update('seeded', { name: 'Renamed' });

		expect(store.records[0].name).toBe('Renamed');
		expect(Date.parse(store.records[0].updated)).toBeGreaterThan(Date.parse(before));
	});

	it('ignores an update for an unknown id', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream()]));

		await store.update('missing', { name: 'Renamed' });

		expect(store.records[0].name).toBe('Visit Japan');
	});

	it('closes a record as done and as cancelled', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream()]));

		await store.close('seeded', Status.Done);
		expect(store.records[0].status).toBe(Status.Done);

		await store.close('seeded', Status.Cancelled);
		expect(store.records[0].status).toBe(Status.Cancelled);
	});

	it('reopens a closed record', async () => {
		const store = useTestStore();
		await store.load(async () => new EntityMemoryRepository([makeDream({ status: Status.Done })]));

		await store.reopen('seeded');

		expect(store.records[0].status).toBe(Status.Opened);
		expect(store.active).toHaveLength(1);
	});

	it('keeps a closed record in storage instead of erasing it', async () => {
		const storage = new EntityMemoryRepository([makeDream()]);
		const store = useTestStore();
		await store.load(async () => storage);

		await store.close('seeded', Status.Cancelled);

		const stored = await storage.getAll();
		expect(stored).toHaveLength(1);
		expect(stored[0].status).toBe(Status.Cancelled);
	});

	it('reports a write failure without losing the in-memory change', async () => {
		const failing: EntityStorage<Dream> = {
			async getAll() {
				return [];
			},
			async put() {
				throw new Error('quota exceeded');
			},
			async remove() {},
			async clear() {},
		};
		const store = useTestStore();
		await store.load(async () => failing);

		await store.add({ name: 'Learn to sail' });

		expect(useStorageStore().lastError).toBe('storage.writeFailed');
		expect(store.records).toHaveLength(1);
	});
});

describe('defineEntityStore replaceAll', () => {
	it('replaces the list in memory and in storage', async () => {
		const storage = new EntityMemoryRepository([makeDream({ id: 'old' })]);
		const store = useTestStore();
		await store.load(async () => storage);

		await store.replaceAll([makeDream({ id: 'new-1' }), makeDream({ id: 'new-2' })]);

		expect(store.records.map((r) => r.id)).toEqual(['new-1', 'new-2']);
		const stored = await storage.getAll();
		expect(stored.map((r) => r.id).sort()).toEqual(['new-1', 'new-2']);
	});

	it('can replace the list with nothing', async () => {
		const storage = new EntityMemoryRepository([makeDream()]);
		const store = useTestStore();
		await store.load(async () => storage);

		await store.replaceAll([]);

		expect(store.records).toEqual([]);
		await expect(storage.getAll()).resolves.toEqual([]);
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/stores/createEntityStore.test.ts`
Expected: FAIL — unresolved import.

- [ ] **Step 4: Implement the factory**

Create `src/stores/createEntityStore.ts`:

```ts
import { computed, ref, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { Status, type EntityBase } from '@/types';
import type { EntityStorage } from '@/repositories/EntityStorage';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { DEFAULT_CLEANUP_DAYS, collectGarbage } from '@/utils';
import { useStorageStore } from './storage';

export interface EntityStoreOptions<T extends EntityBase, D> {
	/** Pinia store id. */
	id: string;
	/** Opens the real repository. Tests pass their own to `load`. */
	createRepository: () => Promise<EntityStorage<T>>;
	/** Turns a draft into a complete record. */
	build: (draft: D, id: string, now: string) => T;
}

/**
 * The half of every entity store that is identical for dreams, goals and
 * tasks. Each store adds only what is genuinely its own — the task store's
 * quadrants, for instance.
 */
export function defineEntityStore<T extends EntityBase, D>(options: EntityStoreOptions<T, D>) {
	return defineStore(options.id, () => {
		/** Everything in storage, closed records included. Sync needs those. */
		const records = ref<T[]>([]) as Ref<T[]>;
		const loading = ref(false);
		const cleanupDays = ref(DEFAULT_CLEANUP_DAYS);

		const storageState = useStorageStore();

		const active = computed(() =>
			records.value.filter((record) => record.status === Status.Opened),
		);
		const closed = computed(() =>
			records.value.filter((record) => record.status !== Status.Opened),
		);

		let storage: EntityStorage<T> = new EntityMemoryRepository<T>();

		async function persist(write: () => Promise<void>): Promise<void> {
			try {
				await write();
			} catch {
				storageState.noteWriteFailure();
			}
		}

		async function load(
			createRepository: () => Promise<EntityStorage<T>> = options.createRepository,
		): Promise<void> {
			loading.value = true;

			try {
				storage = await createRepository();
				storageState.noteAvailable();
			} catch {
				storage = new EntityMemoryRepository<T>();
				storageState.noteUnavailable();
			}

			const loaded = await storage.getAll();
			const { keep, purge } = collectGarbage(loaded, cleanupDays.value, new Date());
			records.value = keep;

			await persist(async () => {
				for (const id of purge) {
					await storage.remove(id);
				}
			});

			loading.value = false;
		}

		async function add(draft: D): Promise<T> {
			const now = new Date().toISOString();
			const record = options.build(draft, crypto.randomUUID(), now);

			records.value.push(record);
			await persist(() => storage.put({ ...record }));

			return record;
		}

		async function update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<void> {
			const index = records.value.findIndex((record) => record.id === id);
			if (index === -1) {
				return;
			}

			const updated: T = {
				...records.value[index],
				...patch,
				updated: new Date().toISOString(),
			};
			records.value[index] = updated;
			await persist(() => storage.put({ ...updated }));
		}

		/**
		 * Closing is the only kind of deletion the interface offers. The record
		 * stays with an honest `updated` so a merge cannot resurrect it; the
		 * garbage collector removes it for good once the window has passed.
		 */
		async function close(id: string, status: Status.Done | Status.Cancelled): Promise<void> {
			await update(id, { status } as Partial<Omit<T, 'id'>>);
		}

		async function reopen(id: string): Promise<void> {
			await update(id, { status: Status.Opened } as Partial<Omit<T, 'id'>>);
		}

		/** Replaces the whole list, e.g. after restoring a backup or a sync. */
		async function replaceAll(incoming: T[]): Promise<void> {
			// Plain copies: reading these back out of a reactive array would yield
			// proxies, which IndexedDB cannot structured-clone.
			const copies = incoming.map((record) => ({ ...record }));
			records.value = copies;

			await persist(async () => {
				await storage.clear();
				for (const record of copies) {
					await storage.put({ ...record });
				}
			});
		}

		return {
			records,
			active,
			closed,
			loading,
			cleanupDays,
			load,
			add,
			update,
			close,
			reopen,
			replaceAll,
		};
	});
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/stores/createEntityStore.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/stores/storage.ts src/stores/createEntityStore.ts src/stores/createEntityStore.test.ts
git commit -m "feat: add the entity store factory and shared storage state

The three entity stores differ only in what they build and where they
write, so the rest lives in one factory. persistent and lastError describe
storage as a whole and move to their own store rather than being tripled.

load collects closed records past the window before anything reads them,
so collected records never reach a view."
```

---

### Task 6: The dream, goal and task stores

**Files:**

- Create: `src/stores/dreams.ts`
- Create: `src/stores/goals.ts`
- Create: `src/stores/tasks.ts`
- Create: `src/stores/index.ts`
- Test: `src/stores/tasks.test.ts`

`src/stores/todos.ts` is left alone; stage 1b deletes it.

**Interfaces:**

- Consumes: `defineEntityStore` from `./createEntityStore`; `EntityDbRepository` from `@/repositories/EntityDbRepository`; parsers and types from `@/types`.
- Produces:
  - `useDreamsStore()`, `interface DreamDraft { name: string; note?: string }`
  - `useGoalsStore()`, `interface GoalDraft { name: string; note?: string; dreamId?: string; deadline?: Deadline }`
  - `useTasksStore()` with an extra `quadrants` getter, `interface TaskDraft { name: string; note?: string; goalId?: string; important: boolean; urgent: boolean; schedule?: Schedule }`
  - `type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate'`
  - `const QUADRANT_KEYS: readonly QuadrantKey[]`
  - `function quadrantOf(task: Task): QuadrantKey`
  - `function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean }`

- [ ] **Step 1: Implement the dream store**

Create `src/stores/dreams.ts`:

```ts
import { Status, parseDream, type Dream } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export interface DreamDraft {
	name: string;
	note?: string;
}

export const useDreamsStore = defineEntityStore<Dream, DreamDraft>({
	id: 'dreams',
	createRepository: () => EntityDbRepository.create('dreams', parseDream),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
	}),
});
```

- [ ] **Step 2: Implement the goal store**

Create `src/stores/goals.ts`:

```ts
import { Status, parseGoal, type Deadline, type Goal } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export interface GoalDraft {
	name: string;
	note?: string;
	dreamId?: string;
	deadline?: Deadline;
}

export const useGoalsStore = defineEntityStore<Goal, GoalDraft>({
	id: 'goals',
	createRepository: () => EntityDbRepository.create('goals', parseGoal),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		dreamId: draft.dreamId,
		deadline: draft.deadline,
	}),
});
```

- [ ] **Step 3: Write the failing test for the task store**

Create `src/stores/tasks.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { QUADRANT_KEYS, quadrantFlags, quadrantOf, useTasksStore, type QuadrantKey } from './tasks';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'File the report',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('quadrantOf', () => {
	it('maps important and urgent to do', () => {
		expect(quadrantOf(makeTask({ important: true, urgent: true }))).toBe('do');
	});

	it('maps important and not urgent to schedule', () => {
		expect(quadrantOf(makeTask({ important: true, urgent: false }))).toBe('schedule');
	});

	it('maps not important and urgent to delegate', () => {
		expect(quadrantOf(makeTask({ important: false, urgent: true }))).toBe('delegate');
	});

	it('maps not important and not urgent to eliminate', () => {
		expect(quadrantOf(makeTask({ important: false, urgent: false }))).toBe('eliminate');
	});
});

describe('quadrantFlags', () => {
	it('is the inverse of quadrantOf for every quadrant', () => {
		for (const key of QUADRANT_KEYS) {
			expect(quadrantOf(makeTask(quadrantFlags(key)))).toBe(key);
		}
	});
});

describe('useTasksStore quadrants', () => {
	it('exposes all four quadrants even when empty', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository<Task>());

		expect(Object.keys(store.quadrants).sort()).toEqual([
			'delegate',
			'do',
			'eliminate',
			'schedule',
		]);
	});

	it('groups every open task into its quadrant', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', important: true, urgent: true }),
					makeTask({ id: 'b', important: true, urgent: false }),
					makeTask({ id: 'c', important: false, urgent: true }),
					makeTask({ id: 'd', important: false, urgent: false }),
					makeTask({ id: 'e', important: true, urgent: true }),
				]),
		);

		expect(store.quadrants.do.map((task) => task.id)).toEqual(['a', 'e']);
		expect(store.quadrants.schedule.map((task) => task.id)).toEqual(['b']);
		expect(store.quadrants.delegate.map((task) => task.id)).toEqual(['c']);
		expect(store.quadrants.eliminate.map((task) => task.id)).toEqual(['d']);
	});

	it('leaves closed tasks out of the matrix', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'open', important: true, urgent: true }),
					makeTask({ id: 'done', important: true, urgent: true, status: Status.Done }),
					makeTask({ id: 'gone', important: true, urgent: true, status: Status.Cancelled }),
				]),
		);

		expect(store.quadrants.do.map((task) => task.id)).toEqual(['open']);
	});

	it('moves a task between quadrants when its flags change', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([makeTask({ id: 'a', important: false, urgent: false })]),
		);

		await store.update('a', { important: true, urgent: true });

		expect(store.quadrants.eliminate).toEqual([]);
		expect(store.quadrants.do).toHaveLength(1);
	});

	it('builds a task from a draft with both flags', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository<Task>());

		const created = await store.add({
			name: 'Ship the release',
			important: true,
			urgent: true,
		});

		expect(created.important).toBe(true);
		expect(created.urgent).toBe(true);
		expect(created.status).toBe(Status.Opened);
		expect(store.quadrants.do).toHaveLength(1);
	});
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/stores/tasks.test.ts`
Expected: FAIL — unresolved import.

- [ ] **Step 5: Implement the task store**

Create `src/stores/tasks.ts`:

```ts
import { computed } from 'vue';
import { Status, parseTask, type Schedule, type Task } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export interface TaskDraft {
	name: string;
	note?: string;
	goalId?: string;
	important: boolean;
	urgent: boolean;
	schedule?: Schedule;
}

export type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

export const QUADRANT_KEYS: readonly QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function quadrantOf(task: Task): QuadrantKey {
	if (task.important) {
		return task.urgent ? 'do' : 'schedule';
	}

	return task.urgent ? 'delegate' : 'eliminate';
}

export function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean } {
	return {
		important: key === 'do' || key === 'schedule',
		urgent: key === 'do' || key === 'delegate',
	};
}

const useBaseTasksStore = defineEntityStore<Task, TaskDraft>({
	id: 'tasks',
	createRepository: () => EntityDbRepository.create('tasks', parseTask),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		goalId: draft.goalId,
		important: draft.important,
		urgent: draft.urgent,
		schedule: draft.schedule,
	}),
});

/**
 * The matrix is a view of the same data, not a separate entity: this getter
 * splits the open tasks by important × urgent. Closed tasks stay out — the
 * matrix is for deciding what to do next.
 */
export function useTasksStore() {
	const store = useBaseTasksStore();

	const quadrants = computed<Record<QuadrantKey, Task[]>>(() => {
		const groups: Record<QuadrantKey, Task[]> = {
			do: [],
			schedule: [],
			delegate: [],
			eliminate: [],
		};

		for (const task of store.active) {
			groups[quadrantOf(task)].push(task);
		}

		return groups;
	});

	return Object.assign(store, { quadrants });
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run src/stores/tasks.test.ts`
Expected: PASS.

If `Object.assign` onto the store trips TypeScript or loses reactivity, replace `useTasksStore` with a full `defineStore` that calls `defineEntityStore`'s pieces inline — but try the composition first, it keeps the factory honest.

- [ ] **Step 7: Add the barrel**

Create `src/stores/index.ts`:

```ts
export * from './storage';
export * from './createEntityStore';
export * from './dreams';
export * from './goals';
export * from './tasks';
```

Leave `todos.ts` out: it is deleted in stage 1b.

- [ ] **Step 8: Run the full suite and the build**

Run: `npm test && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add src/stores/dreams.ts src/stores/goals.ts src/stores/tasks.ts src/stores/index.ts src/stores/tasks.test.ts
git commit -m "feat: add the dream, goal and task stores

Each store supplies only what is its own: where to write and how to build
a record from a draft. The task store adds the quadrants getter, which
now reads from active rather than every record — a cancelled task has no
business in the matrix."
```

---

### Task 7: Merging, including per-occurrence completions

**Files:**

- Modify: `src/services/sync/SyncMerger.ts`
- Modify: `src/services/sync/SyncMerger.test.ts`

**Interfaces:**

- Consumes: `Task`, `Completion` from `@/types`.
- Produces:
  - `interface Mergeable { id: string; updated: string }`
  - `merge<T extends Mergeable>(local: T[], remote: T[]): T[]` — generalised from `Todo[]`; both `Todo` and `EntityBase` satisfy the constraint, so `SyncFlow.vue` keeps compiling untouched
  - `mergeTasks(local: Task[], remote: Task[]): Task[]`
  - `mergeCompletions(local: Completion[] | undefined, remote: Completion[] | undefined): Completion[] | undefined`

- [ ] **Step 1: Write the failing tests**

Append to `src/services/sync/SyncMerger.test.ts`, and add the imports `import { Status, type Completion, type Task } from '@/types';` at the top:

```ts
function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'File the report',
		created: '2026-08-01T10:00:00.000Z',
		updated: '2026-08-01T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

function mark(occurrence: string, done: boolean, at: string): Completion {
	return { occurrence, done, at };
}

describe('SyncMerger.merge on entity records', () => {
	it('lets a newer closure win over an older edit', () => {
		const local = [makeTask({ name: 'Edited', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTask({ status: Status.Cancelled, updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].status).toBe(Status.Cancelled);
	});

	it('lets a newer edit win over an older closure', () => {
		const local = [makeTask({ name: 'Reopened', updated: '2026-08-03T00:00:00.000Z' })];
		const remote = [makeTask({ status: Status.Done, updated: '2026-08-02T00:00:00.000Z' })];

		const merged = merger.merge(local, remote)[0];
		expect(merged.status).toBe(Status.Opened);
		expect(merged.name).toBe('Reopened');
	});
});

describe('SyncMerger.mergeTasks', () => {
	it('keeps marks made on two devices for different occurrences', () => {
		// The phone marked the 7th, the desktop marked the 14th without ever
		// seeing the 7th. Whole-record last-write-wins would drop one of them.
		const local = [
			makeTask({
				updated: '2026-08-07T12:00:00.000Z',
				completions: [mark('2026-08-07T09:00', true, '2026-08-07T12:00:00.000Z')],
			}),
		];
		const remote = [
			makeTask({
				updated: '2026-08-14T10:00:00.000Z',
				completions: [mark('2026-08-14T09:00', true, '2026-08-14T10:00:00.000Z')],
			}),
		];

		const merged = merger.mergeTasks(local, remote)[0];

		expect(merged.completions?.map((c) => c.occurrence).sort()).toEqual([
			'2026-08-07T09:00',
			'2026-08-14T09:00',
		]);
	});

	it('lets a later un-mark win over an earlier mark', () => {
		const local = [
			makeTask({
				updated: '2026-08-10T00:00:00.000Z',
				completions: [mark('2026-08-07T09:00', false, '2026-08-10T00:00:00.000Z')],
			}),
		];
		const remote = [
			makeTask({
				updated: '2026-08-07T00:00:00.000Z',
				completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')],
			}),
		];

		const merged = merger.mergeTasks(local, remote)[0];

		expect(merged.completions).toEqual([
			mark('2026-08-07T09:00', false, '2026-08-10T00:00:00.000Z'),
		]);
	});

	it('lets a later mark win over an earlier un-mark', () => {
		const local = [
			makeTask({
				completions: [mark('2026-08-07T09:00', false, '2026-08-07T00:00:00.000Z')],
			}),
		];
		const remote = [
			makeTask({
				completions: [mark('2026-08-07T09:00', true, '2026-08-09T00:00:00.000Z')],
			}),
		];

		expect(merger.mergeTasks(local, remote)[0].completions?.[0].done).toBe(true);
	});

	it('still applies last-write-wins to every other field', () => {
		const local = [makeTask({ name: 'Local', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTask({ name: 'Remote', updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.mergeTasks(local, remote)[0].name).toBe('Remote');
	});

	it('carries marks over from the losing version of the record', () => {
		const local = [
			makeTask({
				name: 'Local loses',
				updated: '2026-08-01T00:00:00.000Z',
				completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')],
			}),
		];
		const remote = [makeTask({ name: 'Remote wins', updated: '2026-08-02T00:00:00.000Z' })];

		const merged = merger.mergeTasks(local, remote)[0];

		expect(merged.name).toBe('Remote wins');
		expect(merged.completions).toHaveLength(1);
	});

	it('leaves completions undefined when neither side has any', () => {
		expect(merger.mergeTasks([makeTask()], [makeTask()])[0].completions).toBeUndefined();
	});

	it('takes a task that exists only on one side', () => {
		expect(merger.mergeTasks([], [makeTask({ id: 'remote-only' })])).toHaveLength(1);
		expect(merger.mergeTasks([makeTask({ id: 'local-only' })], [])).toHaveLength(1);
	});

	it('does not mutate either input', () => {
		const local = [
			makeTask({ completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')] }),
		];
		const remote = [
			makeTask({ completions: [mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z')] }),
		];
		const localCopy = structuredClone(local);
		const remoteCopy = structuredClone(remote);

		merger.mergeTasks(local, remote);

		expect(local).toEqual(localCopy);
		expect(remote).toEqual(remoteCopy);
	});

	it('is idempotent', () => {
		const local = [
			makeTask({ completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')] }),
		];
		const remote = [
			makeTask({ completions: [mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z')] }),
		];

		const once = merger.mergeTasks(local, remote);
		const twice = merger.mergeTasks(once, remote);

		expect(twice).toEqual(once);
	});

	it('gives the same completions regardless of which side runs it', () => {
		const local = [
			makeTask({ completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')] }),
		];
		const remote = [
			makeTask({ completions: [mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z')] }),
		];

		const one = merger.mergeTasks(local, remote)[0].completions ?? [];
		const other = merger.mergeTasks(remote, local)[0].completions ?? [];

		expect([...one].sort((a, b) => a.occurrence.localeCompare(b.occurrence))).toEqual(
			[...other].sort((a, b) => a.occurrence.localeCompare(b.occurrence)),
		);
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/services/sync/SyncMerger.test.ts`
Expected: FAIL — `merger.mergeTasks is not a function`.

- [ ] **Step 3: Implement the merge rules**

Replace `src/services/sync/SyncMerger.ts` with:

```ts
import type { Completion, Task } from '@/types';

/**
 * All a merge needs. Deliberately structural rather than tied to one type,
 * so the same rule serves every record shape the app has had.
 */
export interface Mergeable {
	id: string;
	updated: string;
}

export class SyncMerger {
	/**
	 * Last-write-wins merge by id. A closed record is just a record with a
	 * timestamp, so a closure beats older edits and loses to newer ones.
	 *
	 * Ties keep the local record. The rule is arbitrary but has to be
	 * deterministic — otherwise the outcome would depend on which device ran
	 * the merge, and the two lists would drift apart for good.
	 */
	merge<T extends Mergeable>(local: T[], remote: T[]): T[] {
		const merged = new Map<string, T>();

		for (const record of local) {
			merged.set(record.id, { ...record });
		}

		for (const record of remote) {
			const current = merged.get(record.id);
			if (!current || Date.parse(record.updated) > Date.parse(current.updated)) {
				merged.set(record.id, { ...record });
			}
		}

		return [...merged.values()];
	}

	/**
	 * Tasks take the rule above for every field except `completions`, which
	 * merge per occurrence instead.
	 *
	 * Whole-record last-write-wins would silently drop marks: two devices out
	 * of contact, one marking the 7th and the other the 14th, produce two
	 * records neither of which holds both, and the newer one wins entirely.
	 * Merging by occurrence loses nothing — different dates never collide,
	 * and an un-mark wins because its `at` is newer.
	 */
	mergeTasks(local: Task[], remote: Task[]): Task[] {
		const byId = new Map<string, Task>();
		for (const task of local) {
			byId.set(task.id, task);
		}

		return this.merge(local, remote).map((winner) => {
			const other = byId.get(winner.id);
			const completions = this.mergeCompletions(winner.completions, other?.completions);

			return completions === undefined ? winner : { ...winner, completions };
		});
	}

	/**
	 * A tiny last-write-wins of its own, keyed by occurrence rather than by
	 * record. Order is not meaningful, so callers must not depend on it.
	 */
	mergeCompletions(
		local: Completion[] | undefined,
		remote: Completion[] | undefined,
	): Completion[] | undefined {
		if (local === undefined && remote === undefined) {
			return undefined;
		}

		const merged = new Map<string, Completion>();

		for (const completion of [...(local ?? []), ...(remote ?? [])]) {
			const current = merged.get(completion.occurrence);
			if (!current || Date.parse(completion.at) > Date.parse(current.at)) {
				merged.set(completion.occurrence, { ...completion });
			}
		}

		return [...merged.values()];
	}
}

export const syncMerger = new SyncMerger();
```

Note: `mergeTasks` looks up the losing version through `byId` built from `local`, then merges its marks into the winner. When the winner came from `local`, `other` is the same record and merging is a no-op.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/services/sync/SyncMerger.test.ts`
Expected: PASS — the existing `Todo`-based tests included. They keep working because `Todo` satisfies `Mergeable`.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run lint && npm run build && npm run test:e2e`
Expected: all pass, including the reload guard from Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/services/sync/SyncMerger.ts src/services/sync/SyncMerger.test.ts
git commit -m "feat: merge task completions per occurrence

merge is now constrained structurally on id and updated, so it serves both
the old Todo and the new entities without SyncFlow changing.

Completions cannot ride on whole-record last-write-wins: two devices out
of contact, one marking the 7th and the other the 14th, produce records
neither of which holds both, and the newer wins entirely. Merging by
occurrence loses nothing, and an un-mark still wins on a newer 'at'."
```

---

## Self-Review

**Spec coverage.** Types and enums — Task 2. Guards and parsers at both boundaries — Task 2 defines them, Task 4 wires the repository; the `BackupService` half moves to stage 1b with `BackupActions.vue`. Garbage collection and completion pruning — Task 3. Three-store database and generic repositories — Task 4. Store factory, `active`/`closed`, shared storage state — Task 5. The three stores and quadrants — Task 6. Merge rules including per-occurrence completions — Task 7.

Deliberately deferred to stage 1b, because each touches a `.vue` file and would break the build mid-plan: backup format v3 (`BackupActions.vue`), the sync envelope with `schema` (`SyncFlow.vue`), the page cutover, deleting `types/todo.ts`, `stores/todos.ts`, `repositories/TodoStorage.ts`, `repositories/IndexedDbRepository.ts` and `repositories/InMemoryRepository.ts`, renaming the `Entity*` repositories into their place, and the i18n key rename.

**Type consistency.** `EntityStorage<T>` is the interface name everywhere. Store methods are `close(id, status)` and `reopen(id)` in Tasks 5 and 6 alike. `EntityDbRepository.create(storeName, parse)` matches its use in all three stores. `collectGarbage` returns `{ keep, purge }` in Task 3 and is destructured that way in Task 5. `DEFAULT_CLEANUP_DAYS` is defined in Task 3 and imported in Task 5.

**Known risk.** Task 2 Step 17 and Task 6 Step 6 carry fallbacks for two things the plan asserts but cannot verify without running: whether `RRule.fromString` throws on nonsense, and whether `Object.assign` composition preserves Pinia reactivity. Both say what to do and to report which way it went.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-16-stage-1a-data-layer.md`.
