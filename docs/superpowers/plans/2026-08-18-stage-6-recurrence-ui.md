# Stage 6, Stage 6 — Recurrence UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a task's `schedule` (already in the data model, never exposed in any UI) be set, cleared, and viewed — a start date/time, an optional end time, an optional timezone anchor, and an optional recurrence rule built from four presets (daily/weekly/monthly/yearly) — from `TaskDialog` and `AddEntityDialog`'s Task tab.

**Architecture:** A pure adapter, `src/utils/schedule.ts`, is the only place that knows how to convert between the app's structured recurrence form and the `rrule` library's RRULE strings, and how to compute a human-readable description and the next occurrence. A new composite input component, `ScheduleField.vue`, is the only place that knows how to turn user interaction into a `parseSchedule`-valid `Schedule` object; `TaskDialog.vue` and `AddEntityDialog.vue`'s Task tab both mount it. A new, separately-testable Slavic pluralization rule feeds `ru`/`pl`'s three-form cardinal number grammar ("1 день / 2 дня / 5 дней") into vue-i18n, since this stage is the first thing in the app that needs a pluralized count. `TaskList.vue`'s `initialDraft` — which today drops `schedule` when opening the edit dialog — is fixed as part of wiring `ScheduleField` in.

**Tech Stack:** Vite 8 (Rolldown), Vue 3.5 (`<script setup>`, `defineModel`), TypeScript, Pinia 4, vue-i18n 11 (`useI18n()`'s `t`/`locale`, custom `pluralRules`), Vuetify 4.1 (`VSwitch`, `VSelect`, `VTextField`, `VCheckbox`), `rrule` 2.8.1 (`RRule`, `Weekday`, `Frequency`, `Options` types — never its `tzid` constructor option, see Task 4), native `Intl` (`DateTimeFormat`, `supportedValuesOf('timeZone')`; no date library in this project), Vitest 4 (`happy-dom` per file via `// @vitest-environment happy-dom`), `@vue/test-utils`.

**Spec:** [docs/superpowers/specs/2026-08-18-stage-6-recurrence-ui-design.md](../specs/2026-08-18-stage-6-recurrence-ui-design.md)

## Global Constraints

- SFC section order is **style → template → script**, enforced by ESLint's `vue/block-order`. Omit the `<style>` block entirely on files that need no custom CSS. `TaskDialog.vue` already has one (`.flags`/`.chips`); `AddEntityDialog.vue` already has one (`.flags`); `ScheduleField.vue` needs one only from Task 6 onward (the weekday-checkbox row).
- Formatting: tabs, single quotes, `printWidth: 100`, trailing commas everywhere (`.prettierrc.json`). Run `npm run format` if unsure.
- Imports inside `src` use the `@/` alias.
- `src/components/` (shared) components get props/emits only, no store or service calls. `ScheduleField.vue` must not call any `useXStore()`.
- Every file is English except `src/i18n/locales/ru.json` and `src/i18n/locales/pl.json`. New i18n keys need all three locale files updated in the same step that introduces the key.
- Default to no comments; add one only where the _why_ isn't obvious from the code (e.g. the tzid implementation note in Task 4 — that one earns a comment because the "obvious" approach is a real, verified bug).
- Out of scope, per the spec — do not add any of these: `exdate`/`rdate` editing, schedule display in the task list (`TaskList.vue`/`EntityList`) or the matrix (`TaskQuadrant.vue`), multi-day `duration` (the end-time control never produces anything but a same-day `PTnHnM`), free-form RRULE text entry as an authoring method, completion-history UI.
- **Never pass `tzid` to `RRule`'s own constructor option.** Verified empirically against the installed `rrule` 2.8.1: its native `tzid` support derives the anchor offset from `Intl.DateTimeFormat().resolvedOptions().timeZone` — the *host machine's* own system zone, not the schedule's `tzid` — corrupting every anchored occurrence's wall-clock time on any host not itself running in UTC. This project's tzid handling is entirely hand-rolled in `src/utils/schedule.ts` (Task 4). Full detail in the spec's Adapter section.
- `nextOccurrence()` returns wall-clock strings (`'YYYY-MM-DDTHH:mm'`), never `Date` objects — an occurrence in this app's domain is a wall-clock reading (see `Completion.occurrence`), not an ambiguous instant.
- `RecurrenceRule`'s `end.until` and the "Until a date" picker are bare calendar dates (`'YYYY-MM-DD'`), never a specific time. `buildRRule` always encodes UNTIL at 23:59 wall-clock on that date.
- The "After N occurrences" end condition has a floor of 2 — `RRULE COUNT=1` is indistinguishable from a one-time task (`isPeriodic()` treats it as non-periodic), so allowing 1 here would silently misrepresent what the user built.
- Do not merge to `main`, push, or add a git remote — stay on `stage-6-dreams-goals-tasks` and commit locally only, one commit per task.
- Every task's "done" bar is `npx vitest run <file>` (or the full `npm test`) passing. The final task includes a manual browser check (Edge, not Chrome — see CLAUDE.md's Cache API note) — per CLAUDE.md's storage trap, `toStorable()`/IndexedDB structured-clone failures never show up in tests that use the in-memory repository.

---

## File Structure

New files:

- `src/i18n/pluralRules.ts` (+ `.test.ts`) — `slavicPluralRule(choice, choicesLength)`, pure; registered for `ru`/`pl` in `src/i18n/index.ts`.
- `src/utils/schedule.ts` (+ `.test.ts`) — the recurrence adapter: `RecurrenceRule`, `OccurrenceWindow` types; `buildRRule`, `parseRRule`, `durationBetween`, `endTimeFromDuration`, `formatWallClock`, `describeRecurrence`, `weekdayName`, `nextOccurrence`.
- `src/components/ScheduleField.vue` (+ `.test.ts`) — the composite `v-model<Schedule | undefined>` input.

Modified files:

- `src/i18n/index.ts` — registers `slavicPluralRule` for `ru`/`pl`.
- `src/i18n/locales/{en,ru,pl}.json` — new `task.schedule.*` keys, added incrementally across Tasks 3, 5, 6, 7.
- `src/components/TaskDialog.vue` + `.test.ts` — schedule field (editing) and description (read view).
- `src/components/AddEntityDialog.vue` + `.test.ts` — schedule field on the Task tab.
- `src/pages/TasksPage/containers/TaskList.vue` + `.test.ts` — fixes `initialDraft` to round-trip `schedule`.

No deleted files.

---

### Task 1: Slavic pluralization rule

**Files:**

- Create: `src/i18n/pluralRules.ts`
- Test: `src/i18n/pluralRules.test.ts`
- Modify: `src/i18n/index.ts`

**Interfaces:**

- Consumes: nothing (pure function).
- Produces: `slavicPluralRule(choice: number, choicesLength: number): number`, matching vue-i18n's `PluralizationRule` shape. Registered in `createI18n({ pluralRules: { ru: slavicPluralRule, pl: slavicPluralRule } })`. Consumed by every `ru.json`/`pl.json` message written with three pipe-separated plural forms from Task 3 onward.

- [ ] **Step 1: Write the failing test**

`src/i18n/pluralRules.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { slavicPluralRule } from './pluralRules';

describe('slavicPluralRule with three forms (one/few/many)', () => {
	it('picks "one" for numbers ending in 1, except 11', () => {
		expect(slavicPluralRule(1, 3)).toBe(0);
		expect(slavicPluralRule(21, 3)).toBe(0);
		expect(slavicPluralRule(101, 3)).toBe(0);
	});

	it('picks "few" for numbers ending in 2-4, except 12-14', () => {
		expect(slavicPluralRule(2, 3)).toBe(1);
		expect(slavicPluralRule(3, 3)).toBe(1);
		expect(slavicPluralRule(4, 3)).toBe(1);
		expect(slavicPluralRule(22, 3)).toBe(1);
	});

	it('picks "many" for 0, for numbers ending in 5-9 or 0, and for the 11-14 exception', () => {
		expect(slavicPluralRule(0, 3)).toBe(2);
		expect(slavicPluralRule(5, 3)).toBe(2);
		expect(slavicPluralRule(11, 3)).toBe(2);
		expect(slavicPluralRule(12, 3)).toBe(2);
		expect(slavicPluralRule(13, 3)).toBe(2);
		expect(slavicPluralRule(14, 3)).toBe(2);
		expect(slavicPluralRule(20, 3)).toBe(2);
	});
});

describe('slavicPluralRule with two forms', () => {
	it('falls back to a plain singular/other split when a message has only two forms', () => {
		expect(slavicPluralRule(1, 2)).toBe(0);
		expect(slavicPluralRule(2, 2)).toBe(1);
		expect(slavicPluralRule(5, 2)).toBe(1);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/i18n/pluralRules.test.ts`
Expected: FAIL — `Cannot find module './pluralRules'`.

- [ ] **Step 3: Write the implementation**

`src/i18n/pluralRules.ts`:

```ts
/**
 * Russian and Polish share the same cardinal-number plural structure for
 * integers: "one" (ends in 1, not 11), "few" (ends in 2-4, not 12-14), and
 * "many" (everything else, including 0). vue-i18n's built-in rule only knows
 * singular/plural, so a message with three pipe-separated forms needs this
 * registered explicitly (`createI18n({ pluralRules: { ru, pl } })`), matching
 * vue-i18n's `PluralizationRule` signature: return the index into the
 * message's plural forms to use.
 */
export function slavicPluralRule(choice: number, choicesLength: number): number {
	const value = Math.abs(choice);

	if (choicesLength < 3) {
		return value === 1 ? 0 : 1;
	}

	const lastDigit = value % 10;
	const lastTwoDigits = value % 100;

	if (lastDigit === 1 && lastTwoDigits !== 11) {
		return 0;
	}

	if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
		return 1;
	}

	return 2;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/i18n/pluralRules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Register it in the i18n instance**

In `src/i18n/index.ts`, add the import:

```ts
import { slavicPluralRule } from './pluralRules';
```

Replace:

```ts
export const i18n = createI18n({
	legacy: false,
	locale: initialLocale,
	fallbackLocale: 'en',
	messages: { en, ru, pl },
});
```

with:

```ts
export const i18n = createI18n({
	legacy: false,
	locale: initialLocale,
	fallbackLocale: 'en',
	messages: { en, ru, pl },
	pluralRules: { ru: slavicPluralRule, pl: slavicPluralRule },
});
```

- [ ] **Step 6: Run the full i18n test folder to confirm nothing broke**

Run: `npx vitest run src/i18n`
Expected: PASS (all tests, including the new ones and the pre-existing `detectLocale.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add src/i18n/pluralRules.ts src/i18n/pluralRules.test.ts src/i18n/index.ts
git commit -m "feat: add Slavic (ru/pl) cardinal pluralization rule"
```

---

### Task 2: `schedule.ts` — RRULE round-trip and duration helpers

**Files:**

- Create: `src/utils/schedule.ts`
- Test: `src/utils/schedule.test.ts`

**Interfaces:**

- Consumes: `RRule`, `Weekday`, `Frequency`, `type Options` from `rrule`.
- Produces:
  - `interface RecurrenceRule { freq: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: number; byweekday?: number[]; end: { type: 'never' } | { type: 'count'; count: number } | { type: 'until'; until: string } }` — consumed by Task 3 (`describeRecurrence`), Task 6 (`ScheduleField`'s recurrence sub-form).
  - `buildRRule(rule: RecurrenceRule): string` / `parseRRule(rrule: string): RecurrenceRule | undefined` — consumed by Task 6.
  - `durationBetween(start: string, endTime: string): string | undefined` — `start` a full wall-clock string, `endTime` an `'HH:mm'` on the same day; `undefined` when `endTime` isn't after `start`'s time. Consumed by Task 5.
  - `endTimeFromDuration(start: string, duration: string): string` — the inverse, returns `'HH:mm'`. Consumed by Task 5.
  - `formatWallClock(wallClock: string, locale: string): string` — a display formatter for a `'YYYY-MM-DDTHH:mm'` string. Consumed by Task 6 (preview line) and Task 7 (`TaskDialog` read view, indirectly via `describeRecurrence`'s non-recurring fallback).

- [ ] **Step 1: Write the failing test file**

`src/utils/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRRule, durationBetween, endTimeFromDuration, formatWallClock, parseRRule } from './schedule';

describe('buildRRule / parseRRule round-trip', () => {
	it('round-trips daily, never-ending, interval 1', () => {
		const rule = buildRRule({ freq: 'daily', interval: 1, end: { type: 'never' } });
		expect(parseRRule(rule)).toEqual({ freq: 'daily', interval: 1, byweekday: undefined, end: { type: 'never' } });
	});

	it('round-trips daily with a non-default interval', () => {
		const rule = buildRRule({ freq: 'daily', interval: 3, end: { type: 'never' } });
		expect(parseRRule(rule)).toEqual({ freq: 'daily', interval: 3, byweekday: undefined, end: { type: 'never' } });
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
		const rule = buildRRule({ freq: 'yearly', interval: 1, end: { type: 'until', until: '2030-06-15' } });
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: FAIL — `Cannot find module './schedule'`.

- [ ] **Step 3: Write the implementation**

`src/utils/schedule.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: PASS (18 tests). If `formatWallClock`'s exact locale output differs slightly from what's asserted (Intl's punctuation/spacing can vary by Node/ICU version), adjust the expected strings to match actual output — the behavior under test is "reads the literal wall-clock numbers, unaffected by host timezone," not an exact byte-for-byte format.

- [ ] **Step 5: Commit**

```bash
git add src/utils/schedule.ts src/utils/schedule.test.ts
git commit -m "feat: add buildRRule/parseRRule and duration helpers to the schedule adapter"
```

---

### Task 3: `schedule.ts` — `describeRecurrence`

**Files:**

- Modify: `src/utils/schedule.ts`
- Modify: `src/utils/schedule.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `RecurrenceRule` (Task 2); a structural `Translate` function type (`(key, named?, options?) => string` — any vue-i18n `t` satisfies it, matching `formatDeadline`'s own reasoning for staying framework-agnostic).
- Produces: `describeRecurrence(rule: RecurrenceRule, t: Translate, locale: string): string`; `weekdayName(iso: number, locale: string): string`. Both consumed by Task 6 (`ScheduleField`'s preview line) and Task 7 (`TaskDialog`'s read view).

- [ ] **Step 1: Add the recurrence description i18n keys**

In `src/i18n/locales/en.json`, replace the `task` block:

```json
	"task": {
		"name": "Name",
		"note": "Note",
		"created": "Created",
		"important": "Important",
		"urgent": "Urgent",
		"done": "Done",
		"actions": "Actions",
		"cancel": "Cancel this task",
		"title": "Task",
		"goalLabel": "Goal",
		"noGoal": "No goal",
		"empty": "No tasks yet. Add the first one."
	},
```

with:

```json
	"task": {
		"name": "Name",
		"note": "Note",
		"created": "Created",
		"important": "Important",
		"urgent": "Urgent",
		"done": "Done",
		"actions": "Actions",
		"cancel": "Cancel this task",
		"title": "Task",
		"goalLabel": "Goal",
		"noGoal": "No goal",
		"empty": "No tasks yet. Add the first one.",
		"schedule": {
			"recurrence": {
				"daily": "Every day | Every {n} days",
				"weekly": "Every week | Every {n} weeks",
				"monthly": "Every month | Every {n} months",
				"yearly": "Every year | Every {n} years",
				"onDays": "on {days}",
				"endAfterCount": "{n} time | {n} times",
				"endUntil": "until {date}"
			}
		}
	},
```

In `src/i18n/locales/ru.json`, replace the `task` block:

```json
	"task": {
		"name": "Название",
		"note": "Описание",
		"created": "Создано",
		"important": "Важное",
		"urgent": "Срочное",
		"done": "Сделано",
		"actions": "Действия",
		"cancel": "Отменить задачу",
		"title": "Задача",
		"goalLabel": "Цель",
		"noGoal": "Без цели",
		"empty": "Задач пока нет. Заведи первую."
	},
```

with:

```json
	"task": {
		"name": "Название",
		"note": "Описание",
		"created": "Создано",
		"important": "Важное",
		"urgent": "Срочное",
		"done": "Сделано",
		"actions": "Действия",
		"cancel": "Отменить задачу",
		"title": "Задача",
		"goalLabel": "Цель",
		"noGoal": "Без цели",
		"empty": "Задач пока нет. Заведи первую.",
		"schedule": {
			"recurrence": {
				"daily": "Каждый день | Каждые {n} дня | Каждые {n} дней",
				"weekly": "Каждую неделю | Каждые {n} недели | Каждые {n} недель",
				"monthly": "Каждый месяц | Каждые {n} месяца | Каждые {n} месяцев",
				"yearly": "Каждый год | Каждые {n} года | Каждые {n} лет",
				"onDays": "по {days}",
				"endAfterCount": "{n} раз | {n} раза | {n} раз",
				"endUntil": "до {date}"
			}
		}
	},
```

In `src/i18n/locales/pl.json`, replace the `task` block:

```json
	"task": {
		"name": "Nazwa",
		"note": "Opis",
		"created": "Utworzono",
		"important": "Ważne",
		"urgent": "Pilne",
		"done": "Zrobione",
		"actions": "Czynności",
		"cancel": "Anuluj zadanie",
		"title": "Zadanie",
		"goalLabel": "Cel",
		"noGoal": "Bez celu",
		"empty": "Brak zadań. Dodaj pierwsze."
	},
```

with:

```json
	"task": {
		"name": "Nazwa",
		"note": "Opis",
		"created": "Utworzono",
		"important": "Ważne",
		"urgent": "Pilne",
		"done": "Zrobione",
		"actions": "Czynności",
		"cancel": "Anuluj zadanie",
		"title": "Zadanie",
		"goalLabel": "Cel",
		"noGoal": "Bez celu",
		"empty": "Brak zadań. Dodaj pierwsze.",
		"schedule": {
			"recurrence": {
				"daily": "Codziennie | Co {n} dni | Co {n} dni",
				"weekly": "Co tydzień | Co {n} tygodnie | Co {n} tygodni",
				"monthly": "Co miesiąc | Co {n} miesiące | Co {n} miesięcy",
				"yearly": "Co rok | Co {n} lata | Co {n} lat",
				"onDays": "w {days}",
				"endAfterCount": "{n} raz | {n} razy | {n} razy",
				"endUntil": "do {date}"
			}
		}
	},
```

- [ ] **Step 2: Write the failing tests**

Add to `src/utils/schedule.test.ts`:

```ts
import { i18n } from '@/i18n';
import { describeRecurrence, weekdayName } from './schedule';

const t = i18n.global.t;

describe('describeRecurrence', () => {
	it('describes a plain daily rule', () => {
		expect(describeRecurrence({ freq: 'daily', interval: 1, end: { type: 'never' } }, t, 'en')).toBe(
			'Every day',
		);
	});

	it('pluralizes the interval in English', () => {
		expect(describeRecurrence({ freq: 'daily', interval: 3, end: { type: 'never' } }, t, 'en')).toBe(
			'Every 3 days',
		);
	});

	it('pluralizes the interval in Russian across all three forms', () => {
		expect(describeRecurrence({ freq: 'weekly', interval: 1, byweekday: [5], end: { type: 'never' } }, t, 'ru')).toBe(
			'Каждую неделю, по пт',
		);
		expect(describeRecurrence({ freq: 'weekly', interval: 2, byweekday: [5], end: { type: 'never' } }, t, 'ru')).toBe(
			'Каждые 2 недели, по пт',
		);
		expect(describeRecurrence({ freq: 'weekly', interval: 5, byweekday: [5], end: { type: 'never' } }, t, 'ru')).toBe(
			'Каждые 5 недель, по пт',
		);
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
			describeRecurrence({ freq: 'monthly', interval: 1, end: { type: 'count', count: 1 } }, t, 'en'),
		).toBe('Every month, 1 time');
		expect(
			describeRecurrence({ freq: 'monthly', interval: 1, end: { type: 'count', count: 6 } }, t, 'en'),
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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: FAIL — `describeRecurrence`/`weekdayName` don't exist yet.

- [ ] **Step 4: Write the implementation**

Add to `src/utils/schedule.ts` (append at the end):

```ts
type Translate = (key: string, named?: Record<string, unknown>, options?: { plural?: number }) => string;

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
			t('task.schedule.recurrence.endAfterCount', { n: rule.end.count }, { plural: rule.end.count }),
		);
	} else if (rule.end.type === 'until') {
		parts.push(t('task.schedule.recurrence.endUntil', { date: formatUntilDate(rule.end.until, locale) }));
	}

	return parts.join(', ');
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: PASS (all tests, including the new ones). If `formatUntilDate`'s exact punctuation differs from the asserted "Jun 15, 2030" (ICU version differences), adjust the expected string — same caveat as Task 2's `formatWallClock` test.

- [ ] **Step 6: Commit**

```bash
git add src/utils/schedule.ts src/utils/schedule.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add describeRecurrence and weekdayName to the schedule adapter"
```

---

### Task 4: `schedule.ts` — `nextOccurrence`

**Files:**

- Modify: `src/utils/schedule.ts`
- Modify: `src/utils/schedule.test.ts`

**Interfaces:**

- Consumes: `Schedule` from `@/types`; `RRule` from `rrule`; `durationBetween`-adjacent duration parsing (inlined, see below); `OccurrenceWindow` (Task 2).
- Produces: `nextOccurrence(schedule: Schedule, from: Date): OccurrenceWindow | undefined`. Consumed by Task 6 (`ScheduleField`'s preview line).

- [ ] **Step 1: Write the failing tests**

Add to `src/utils/schedule.test.ts`:

```ts
import type { Schedule } from '@/types';
import { nextOccurrence } from './schedule';

describe('nextOccurrence, floating (no tzid)', () => {
	it('returns the next weekly occurrence after "from", using the device-local reading of "from"', () => {
		const schedule: Schedule = { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		// A Saturday, the day after the first Friday occurrence.
		const from = new Date('2026-08-22T00:00:00Z');

		expect(nextOccurrence(schedule, from)).toEqual({ start: '2026-08-28T09:00', end: '2026-08-28T09:00' });
	});

	it('is inclusive: "from" landing exactly on an occurrence returns that occurrence', () => {
		const schedule: Schedule = { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR' };
		const from = new Date(
			Date.UTC(2026, 7, 21, 9, 0) - new Date().getTimezoneOffset() * 60_000,
		);

		expect(nextOccurrence(schedule, from)?.start).toBe('2026-08-21T09:00');
	});

	it('applies duration to the returned window', () => {
		const schedule: Schedule = {
			start: '2026-08-21T09:00',
			duration: 'PT4H',
			rrule: 'FREQ=WEEKLY;BYDAY=FR',
		};
		const from = new Date('2026-08-22T00:00:00Z');

		expect(nextOccurrence(schedule, from)).toEqual({ start: '2026-08-28T09:00', end: '2026-08-28T13:00' });
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

		expect(results).toEqual(['2026-02-27T09:00', '2026-03-06T09:00', '2026-03-13T09:00', '2026-03-20T09:00']);
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
			}).format(new Date(`${before?.start}:00Z`)),
		).toBe('14:00');

		// After the transition: EDT, UTC-4, so 09:00 local is 13:00 UTC.
		const after = nextOccurrence(schedule, new Date('2026-03-15T00:00:00Z'));
		expect(
			new Intl.DateTimeFormat('en-US', {
				timeZone: 'UTC',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23',
			}).format(new Date(`${after?.start}:00Z`)),
		).toBe('13:00');
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: FAIL — `nextOccurrence` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Add to `src/utils/schedule.ts` (append at the end):

```ts
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

export function nextOccurrence(schedule: Schedule, from: Date): OccurrenceWindow | undefined {
	if (schedule.rrule === undefined) {
		return undefined;
	}

	const rule = new RRule({
		...RRule.parseString(schedule.rrule),
		dtstart: wallClockStringToDate(schedule.start),
	});

	const comparisonPoint =
		schedule.tzid === undefined ? deviceLocalWallClock(from) : instantAsWallClockInZone(from, schedule.tzid);

	const next = rule.after(comparisonPoint, true);
	if (next === null) {
		return undefined;
	}

	const start = dateToWallClockString(next);
	const end =
		schedule.duration === undefined ? start : dateToWallClockString(addDurationToWallClock(next, schedule.duration));

	return { start, end };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/utils/schedule.test.ts`
Expected: PASS (all tests, including the DST ones — these must pass on this development machine regardless of its own system timezone; that's the entire point).

- [ ] **Step 5: Commit**

```bash
git add src/utils/schedule.ts src/utils/schedule.test.ts
git commit -m "feat: add nextOccurrence to the schedule adapter, host-timezone-independent"
```

---

### Task 5: `ScheduleField.vue` core (start, end time, timezone anchor)

**Files:**

- Create: `src/components/ScheduleField.vue`
- Test: `src/components/ScheduleField.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `durationBetween`, `endTimeFromDuration` (Task 2); `type Schedule` from `@/types`.
- Produces: a `v-model<Schedule | undefined>` component (`defineModel`). This task's version never sets `rrule` — Task 6 extends it. Consumed by Task 7 (`TaskDialog`) and Task 8 (`AddEntityDialog`).

- [ ] **Step 1: Add the core field i18n keys**

In `src/i18n/locales/en.json`, replace the `task.schedule` block from Task 3:

```json
		"schedule": {
			"recurrence": {
```

with:

```json
		"schedule": {
			"enabled": "Has a schedule",
			"start": "Start",
			"hasEndTime": "Add an end time",
			"endTime": "End time",
			"hasTzid": "Anchor to a timezone",
			"tzid": "Timezone",
			"repeat": "Repeat",
			"repeatNone": "Doesn't repeat",
			"recurrence": {
```

In `src/i18n/locales/ru.json`, replace:

```json
		"schedule": {
			"recurrence": {
```

with:

```json
		"schedule": {
			"enabled": "Есть расписание",
			"start": "Начало",
			"hasEndTime": "Указать время окончания",
			"endTime": "Время окончания",
			"hasTzid": "Привязать к часовому поясу",
			"tzid": "Часовой пояс",
			"repeat": "Повторение",
			"repeatNone": "Не повторяется",
			"recurrence": {
```

In `src/i18n/locales/pl.json`, replace:

```json
		"schedule": {
			"recurrence": {
```

with:

```json
		"schedule": {
			"enabled": "Ma harmonogram",
			"start": "Początek",
			"hasEndTime": "Dodaj czas zakończenia",
			"endTime": "Czas zakończenia",
			"hasTzid": "Przypisz strefę czasową",
			"tzid": "Strefa czasowa",
			"repeat": "Powtarzanie",
			"repeatNone": "Nie powtarza się",
			"recurrence": {
```

- [ ] **Step 2: Write the failing test file**

`src/components/ScheduleField.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import type { Schedule } from '@/types';
import ScheduleField from './ScheduleField.vue';

function mountField(modelValue?: Schedule) {
	return mount(ScheduleField, {
		props: { modelValue },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('ScheduleField collapsed state', () => {
	it('shows only the toggle when there is no schedule', () => {
		const wrapper = mountField(undefined);

		expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(false);
	});
});

describe('ScheduleField turning the toggle on', () => {
	it('reveals the start field and emits nothing until a start is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(true);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('emits a floating schedule once a start is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ start: '2026-08-21T09:00', tzid: undefined, duration: undefined, rrule: undefined },
		]);
	});
});

describe('ScheduleField end time', () => {
	it('computes a duration once an end time is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true); // hasEndTime
		await wrapper.get('input[type="time"]').setValue('11:30');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ start: '2026-08-21T09:00', tzid: undefined, duration: 'PT2H30M', rrule: undefined },
		]);
	});

	it('emits nothing while the end-time switch is on but no time is chosen yet', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});
});

describe('ScheduleField timezone anchor', () => {
	it('emits tzid once the switch is on and a zone is picked', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await wrapper.findAll('input[type="checkbox"]')[2].setValue(true); // hasTzid
		const [, tzidSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await tzidSelect.vm.$emit('update:modelValue', 'America/New_York');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ start: '2026-08-21T09:00', tzid: 'America/New_York', duration: undefined, rrule: undefined },
		]);
	});
});

describe('ScheduleField existing value', () => {
	it('derives the end-time switch and field from an existing duration', () => {
		const wrapper = mountField({ start: '2026-08-21T09:00', duration: 'PT4H' });

		expect((wrapper.get('input[type="time"]').element as HTMLInputElement).value).toBe('13:00');
	});

	it('derives the timezone switch and field from an existing tzid', () => {
		const wrapper = mountField({ start: '2026-08-21T09:00', tzid: 'Europe/Warsaw' });

		const [, tzidSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(tzidSelect.props('modelValue')).toBe('Europe/Warsaw');
	});

	it('emits undefined when the toggle is turned off', async () => {
		const wrapper = mountField({ start: '2026-08-21T09:00' });

		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/ScheduleField.test.ts`
Expected: FAIL — `Cannot find module './ScheduleField.vue'`.

- [ ] **Step 4: Write the implementation**

`src/components/ScheduleField.vue`:

```vue
<template>
	<v-switch v-model="hasSchedule" :label="t('task.schedule.enabled')" color="primary" hide-details />

	<template v-if="hasSchedule">
		<v-text-field v-model="start" type="datetime-local" :label="t('task.schedule.start')" />

		<v-switch
			v-model="hasEndTime"
			:label="t('task.schedule.hasEndTime')"
			color="primary"
			hide-details
		/>
		<v-text-field
			v-if="hasEndTime"
			v-model="endTime"
			type="time"
			:label="t('task.schedule.endTime')"
		/>

		<v-switch v-model="hasTzid" :label="t('task.schedule.hasTzid')" color="primary" hide-details />
		<v-select
			v-if="hasTzid"
			v-model="tzid"
			:items="timeZoneItems"
			:label="t('task.schedule.tzid')"
		/>

		<v-select
			v-model="repeat"
			:items="repeatItems"
			item-title="title"
			item-value="value"
			:label="t('task.schedule.repeat')"
		/>
	</template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { durationBetween, endTimeFromDuration } from '@/utils/schedule';
import type { Schedule } from '@/types';

type Repeat = 'none';

const schedule = defineModel<Schedule | undefined>();

const { t } = useI18n();

const hasSchedule = ref(false);
const start = ref('');
const hasEndTime = ref(false);
const endTime = ref('');
const hasTzid = ref(false);
const tzid = ref<string>();
const repeat = ref<Repeat>('none');

/**
 * The last value this component itself wrote via `build()`. `syncFromValue`
 * uses it to tell "the parent genuinely cleared the schedule" apart from
 * "this is just an echo of what we ourselves just emitted" -- `build()`
 * legitimately returns `undefined` while the toggle is on but the current
 * fields aren't complete yet (e.g. the end-time switch is on but no time is
 * picked yet), and that echo must not collapse the form.
 */
const lastEmitted = ref<Schedule | undefined>(undefined);

function syncFromValue(value: Schedule | undefined): void {
	if (value === undefined) {
		if (lastEmitted.value === undefined) {
			return;
		}

		hasSchedule.value = false;
		return;
	}

	hasSchedule.value = true;
	start.value = value.start;

	hasTzid.value = value.tzid !== undefined;
	tzid.value = value.tzid;

	if (value.duration !== undefined) {
		hasEndTime.value = true;
		endTime.value = endTimeFromDuration(value.start, value.duration);
	} else {
		hasEndTime.value = false;
		endTime.value = '';
	}

	repeat.value = 'none';
}

watch(schedule, syncFromValue, { immediate: true });

function build(): Schedule | undefined {
	if (!hasSchedule.value || start.value === '') {
		return undefined;
	}

	if (hasTzid.value && tzid.value === undefined) {
		return undefined;
	}

	let duration: string | undefined;
	if (hasEndTime.value) {
		if (endTime.value === '') {
			return undefined;
		}

		duration = durationBetween(start.value, endTime.value);
		if (duration === undefined) {
			return undefined;
		}
	}

	return {
		start: start.value,
		tzid: hasTzid.value ? tzid.value : undefined,
		duration,
		rrule: undefined,
	};
}

watch([hasSchedule, start, hasEndTime, endTime, hasTzid, tzid, repeat], () => {
	const next = build();
	lastEmitted.value = next;
	schedule.value = next;
});

const repeatItems = computed(() => [{ value: 'none', title: t('task.schedule.repeatNone') }]);

const timeZoneItems = computed(() => Intl.supportedValuesOf('timeZone'));
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/ScheduleField.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/ScheduleField.vue src/components/ScheduleField.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add ScheduleField core (start, end time, timezone anchor)"
```

---

### Task 6: `ScheduleField.vue` recurrence sub-form

**Files:**

- Modify: `src/components/ScheduleField.vue`
- Modify: `src/components/ScheduleField.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `RecurrenceRule`, `buildRRule`, `parseRRule`, `describeRecurrence`, `weekdayName`, `nextOccurrence`, `formatWallClock` (Tasks 2-4).
- Produces: `ScheduleField` now emits a full `Schedule` including `rrule` when a repeating preset is selected. No new exports beyond the component itself.

- [ ] **Step 1: Add the recurrence sub-form i18n keys**

In `src/i18n/locales/en.json`, replace the `task.schedule` block from Task 5:

```json
		"schedule": {
			"enabled": "Has a schedule",
			"start": "Start",
			"hasEndTime": "Add an end time",
			"endTime": "End time",
			"hasTzid": "Anchor to a timezone",
			"tzid": "Timezone",
			"repeat": "Repeat",
			"repeatNone": "Doesn't repeat",
			"recurrence": {
```

with:

```json
		"schedule": {
			"enabled": "Has a schedule",
			"start": "Start",
			"hasEndTime": "Add an end time",
			"endTime": "End time",
			"hasTzid": "Anchor to a timezone",
			"tzid": "Timezone",
			"repeat": "Repeat",
			"repeatNone": "Doesn't repeat",
			"repeatDaily": "Daily",
			"repeatWeekly": "Weekly",
			"repeatMonthly": "Monthly",
			"repeatYearly": "Yearly",
			"repeatCustom": "Custom rule",
			"interval": "Repeat every",
			"endType": "Ends",
			"endNever": "Never",
			"endCountOption": "After a number of times",
			"endUntilOption": "On a date",
			"endCountField": "Number of times",
			"endUntilField": "Until",
			"nextOccurrence": "Next: {date}",
			"recurrence": {
```

In `src/i18n/locales/ru.json`, replace:

```json
		"schedule": {
			"enabled": "Есть расписание",
			"start": "Начало",
			"hasEndTime": "Указать время окончания",
			"endTime": "Время окончания",
			"hasTzid": "Привязать к часовому поясу",
			"tzid": "Часовой пояс",
			"repeat": "Повторение",
			"repeatNone": "Не повторяется",
			"recurrence": {
```

with:

```json
		"schedule": {
			"enabled": "Есть расписание",
			"start": "Начало",
			"hasEndTime": "Указать время окончания",
			"endTime": "Время окончания",
			"hasTzid": "Привязать к часовому поясу",
			"tzid": "Часовой пояс",
			"repeat": "Повторение",
			"repeatNone": "Не повторяется",
			"repeatDaily": "Ежедневно",
			"repeatWeekly": "Еженедельно",
			"repeatMonthly": "Ежемесячно",
			"repeatYearly": "Ежегодно",
			"repeatCustom": "Особое правило",
			"interval": "Повторять каждые",
			"endType": "Окончание",
			"endNever": "Никогда",
			"endCountOption": "После числа повторов",
			"endUntilOption": "По дате",
			"endCountField": "Число повторов",
			"endUntilField": "До даты",
			"nextOccurrence": "Ближайший раз: {date}",
			"recurrence": {
```

In `src/i18n/locales/pl.json`, replace:

```json
		"schedule": {
			"enabled": "Ma harmonogram",
			"start": "Początek",
			"hasEndTime": "Dodaj czas zakończenia",
			"endTime": "Czas zakończenia",
			"hasTzid": "Przypisz strefę czasową",
			"tzid": "Strefa czasowa",
			"repeat": "Powtarzanie",
			"repeatNone": "Nie powtarza się",
			"recurrence": {
```

with:

```json
		"schedule": {
			"enabled": "Ma harmonogram",
			"start": "Początek",
			"hasEndTime": "Dodaj czas zakończenia",
			"endTime": "Czas zakończenia",
			"hasTzid": "Przypisz strefę czasową",
			"tzid": "Strefa czasowa",
			"repeat": "Powtarzanie",
			"repeatNone": "Nie powtarza się",
			"repeatDaily": "Codziennie",
			"repeatWeekly": "Co tydzień",
			"repeatMonthly": "Co miesiąc",
			"repeatYearly": "Co rok",
			"repeatCustom": "Niestandardowa reguła",
			"interval": "Powtarzaj co",
			"endType": "Koniec",
			"endNever": "Nigdy",
			"endCountOption": "Po liczbie powtórzeń",
			"endUntilOption": "W dniu",
			"endCountField": "Liczba powtórzeń",
			"endUntilField": "Do dnia",
			"nextOccurrence": "Następny raz: {date}",
			"recurrence": {
```

- [ ] **Step 2: Write the failing tests**

Add to `src/components/ScheduleField.test.ts`:

```ts
describe('ScheduleField repeat presets', () => {
	it('defaults the weekday to the day of the chosen start date', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00'); // a Friday
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{
				start: '2026-08-21T09:00',
				tzid: undefined,
				duration: undefined,
				rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1',
			},
		]);
	});

	it('never emits a weekly rule with every day unchecked', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();

		const fridayCheckbox = wrapper
			.findAllComponents({ name: 'VCheckbox' })
			.find((c) => c.props('modelValue') === true);
		await fridayCheckbox?.vm.$emit('update:modelValue', false);
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1',
		});
	});

	it('builds a monthly rule with a non-default interval', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'monthly');
		await wrapper.vm.$nextTick();
		await wrapper.get('input[type="number"]').setValue('3');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{
				start: '2026-08-21T09:00',
				tzid: undefined,
				duration: undefined,
				rrule: 'FREQ=MONTHLY;INTERVAL=3',
			},
		]);
	});
});

describe('ScheduleField end condition', () => {
	async function mountWeekly() {
		const wrapper = mountField(undefined);
		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();
		return wrapper;
	}

	it('rejects an occurrence count below 2', async () => {
		const wrapper = await mountWeekly();
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const endTypeSelect = selects[selects.length - 1];
		await endTypeSelect.vm.$emit('update:modelValue', 'count');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="number"][min="2"]').setValue('1');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('emits COUNT once a valid occurrence count is set', async () => {
		const wrapper = await mountWeekly();
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const endTypeSelect = selects[selects.length - 1];
		await endTypeSelect.vm.$emit('update:modelValue', 'count');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="number"][min="2"]').setValue('5');

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1;COUNT=5',
		});
	});

	it('emits UNTIL once an end date is set', async () => {
		const wrapper = await mountWeekly();
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const endTypeSelect = selects[selects.length - 1];
		await endTypeSelect.vm.$emit('update:modelValue', 'until');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="date"]').setValue('2027-01-01');

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1;UNTIL=20270101T235900Z',
		});
	});
});

describe('ScheduleField custom-rule fallback', () => {
	it('shows an unparseable existing rrule as a read-only custom rule', () => {
		const wrapper = mountField({ start: '2026-08-21T09:00', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15,20' });

		expect(wrapper.text()).toContain('FREQ=MONTHLY;BYMONTHDAY=15,20');
	});

	it('leaves a custom rule untouched when an unrelated field changes', async () => {
		const wrapper = mountField({ start: '2026-08-21T09:00', rrule: 'FREQ=MONTHLY;BYMONTHDAY=15,20' });

		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-22T10:00');

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=MONTHLY;BYMONTHDAY=15,20',
		});
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/ScheduleField.test.ts`
Expected: FAIL — repeat presets beyond "Doesn't repeat" don't exist yet, so selecting `'weekly'`/`'monthly'` leaves `repeat.value` unset and every recurrence assertion fails.

- [ ] **Step 4: Update the implementation**

Prepend a `<style>` block before the existing `<template>` in `src/components/ScheduleField.vue`:

```vue
<style lang="scss" module>
.weekdays {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}
</style>

```

In the `<template>`, replace:

```vue
		<v-select
			v-model="repeat"
			:items="repeatItems"
			item-title="title"
			item-value="value"
			:label="t('task.schedule.repeat')"
		/>
	</template>
</template>
```

with:

```vue
		<v-select
			v-model="repeat"
			:items="repeatItems"
			item-title="title"
			item-value="value"
			:label="t('task.schedule.repeat')"
		/>

		<template v-if="repeat !== 'none' && repeat !== 'custom'">
			<v-text-field
				v-model.number="interval"
				type="number"
				min="1"
				:label="t('task.schedule.interval')"
			/>

			<div v-if="repeat === 'weekly'" :class="$style.weekdays">
				<v-checkbox
					v-for="day in weekdayItems"
					:key="day.value"
					:model-value="byweekday.includes(day.value)"
					:label="day.title"
					density="compact"
					hide-details
					@update:model-value="toggleWeekday(day.value)"
				/>
			</div>

			<v-select
				v-model="endType"
				:items="endTypeItems"
				item-title="title"
				item-value="value"
				:label="t('task.schedule.endType')"
			/>

			<v-text-field
				v-if="endType === 'count'"
				v-model.number="count"
				type="number"
				min="2"
				:label="t('task.schedule.endCountField')"
			/>

			<v-text-field
				v-if="endType === 'until'"
				v-model="until"
				type="date"
				:label="t('task.schedule.endUntilField')"
			/>

			<p class="text-caption text-medium-emphasis">{{ preview }}</p>
		</template>

		<p v-if="repeat === 'custom'" class="text-caption text-medium-emphasis">
			{{ t('task.schedule.repeatCustom') }}: {{ customRRule }}
		</p>
	</template>
</template>
```

In the `<script setup>` block, replace the import line:

```ts
import { durationBetween, endTimeFromDuration } from '@/utils/schedule';
```

with:

```ts
import {
	buildRRule,
	describeRecurrence,
	durationBetween,
	endTimeFromDuration,
	formatWallClock,
	nextOccurrence,
	parseRRule,
	weekdayName,
	type RecurrenceRule,
} from '@/utils/schedule';
```

Replace:

```ts
type Repeat = 'none';
```

with:

```ts
type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type EndType = 'never' | 'count' | 'until';
```

Replace:

```ts
const { t } = useI18n();
```

with:

```ts
const { t, locale } = useI18n();
```

Replace:

```ts
const repeat = ref<Repeat>('none');
```

with:

```ts
const repeat = ref<Repeat>('none');
const interval = ref(1);
const byweekday = ref<number[]>([]);
const endType = ref<EndType>('never');
const count = ref(2);
const until = ref('');
const customRRule = ref<string>();
```

Replace:

```ts
	repeat.value = 'none';
}
```

with:

```ts
	if (value.rrule === undefined) {
		repeat.value = 'none';
		return;
	}

	const parsed = parseRRule(value.rrule);
	if (parsed === undefined) {
		repeat.value = 'custom';
		customRRule.value = value.rrule;
		return;
	}

	repeat.value = parsed.freq;
	interval.value = parsed.interval;
	byweekday.value = parsed.byweekday ?? [];
	endType.value = parsed.end.type;
	count.value = parsed.end.type === 'count' ? parsed.end.count : 2;
	until.value = parsed.end.type === 'until' ? parsed.end.until : '';
}
```

Replace:

```ts
	return {
		start: start.value,
		tzid: hasTzid.value ? tzid.value : undefined,
		duration,
		rrule: undefined,
	};
}

watch([hasSchedule, start, hasEndTime, endTime, hasTzid, tzid, repeat], () => {
```

with:

```ts
	const rrule = buildRRuleFromForm();
	if (rrule === 'invalid') {
		return undefined;
	}

	return {
		start: start.value,
		tzid: hasTzid.value ? tzid.value : undefined,
		duration,
		rrule,
	};
}

function buildRRuleFromForm(): string | undefined | 'invalid' {
	if (repeat.value === 'none') {
		return undefined;
	}

	if (repeat.value === 'custom') {
		return customRRule.value;
	}

	if (repeat.value === 'weekly' && byweekday.value.length === 0) {
		return 'invalid';
	}

	if (endType.value === 'count' && count.value < 2) {
		return 'invalid';
	}

	if (endType.value === 'until' && until.value === '') {
		return 'invalid';
	}

	const end: RecurrenceRule['end'] =
		endType.value === 'never'
			? { type: 'never' }
			: endType.value === 'count'
				? { type: 'count', count: count.value }
				: { type: 'until', until: until.value };

	return buildRRule({
		freq: repeat.value,
		interval: interval.value,
		byweekday: repeat.value === 'weekly' ? byweekday.value : undefined,
		end,
	});
}

watch(
	[hasSchedule, start, hasEndTime, endTime, hasTzid, tzid, repeat, interval, endType, count, until],
	() => {
```

Replace the closing of that watcher:

```ts
	const next = build();
	lastEmitted.value = next;
	schedule.value = next;
});
```

with:

```ts
		const next = build();
		lastEmitted.value = next;
		schedule.value = next;
	},
	{ deep: false },
);

watch(
	byweekday,
	() => {
		const next = build();
		lastEmitted.value = next;
		schedule.value = next;
	},
	{ deep: true },
);
```

Replace:

```ts
const repeatItems = computed(() => [{ value: 'none', title: t('task.schedule.repeatNone') }]);
```

with:

```ts
const repeatItems = computed(() => [
	{ value: 'none', title: t('task.schedule.repeatNone') },
	{ value: 'daily', title: t('task.schedule.repeatDaily') },
	{ value: 'weekly', title: t('task.schedule.repeatWeekly') },
	{ value: 'monthly', title: t('task.schedule.repeatMonthly') },
	{ value: 'yearly', title: t('task.schedule.repeatYearly') },
	...(repeat.value === 'custom' ? [{ value: 'custom', title: t('task.schedule.repeatCustom') }] : []),
]);

const weekdayItems = computed(() =>
	Array.from({ length: 7 }, (_, index) => {
		const iso = index + 1;
		return { value: iso, title: weekdayName(iso, locale.value) };
	}),
);

function toggleWeekday(iso: number): void {
	if (byweekday.value.includes(iso)) {
		if (byweekday.value.length === 1) {
			return;
		}

		byweekday.value = byweekday.value.filter((day) => day !== iso);
		return;
	}

	byweekday.value = [...byweekday.value, iso].sort((a, b) => a - b);
}

const endTypeItems = computed(() => [
	{ value: 'never', title: t('task.schedule.endNever') },
	{ value: 'count', title: t('task.schedule.endCountOption') },
	{ value: 'until', title: t('task.schedule.endUntilOption') },
]);

const preview = computed(() => {
	if (repeat.value === 'none' || repeat.value === 'custom' || start.value === '') {
		return '';
	}

	const end: RecurrenceRule['end'] =
		endType.value === 'never'
			? { type: 'never' }
			: endType.value === 'count'
				? { type: 'count', count: count.value }
				: { type: 'until', until: until.value };

	const rule: RecurrenceRule = {
		freq: repeat.value,
		interval: interval.value,
		byweekday: repeat.value === 'weekly' ? byweekday.value : undefined,
		end,
	};
	const description = describeRecurrence(rule, t, locale.value);

	const built = build();
	if (built === undefined) {
		return description;
	}

	const next = nextOccurrence(built, new Date());
	if (next === undefined) {
		return description;
	}

	return `${description} — ${t('task.schedule.nextOccurrence', { date: formatWallClock(next.start, locale.value) })}`;
});
```

Weekly defaults to the weekday of `start` the first time the user switches into it. `syncFromValue`'s weekly branch (`byweekday.value = parsed.byweekday ?? [];`, added above) doesn't need to change for this: an *existing* weekly `Schedule` always carries a non-empty `byweekday` produced by this same component, so `parsed.byweekday` is never `undefined` there in practice — the `?? []` is defensive only. The default is needed instead when the user *switches into* "Weekly" from another preset with no `byweekday` chosen yet — add a dedicated watcher right after the `weekdayItems` computed:

```ts
watch(repeat, (value) => {
	if (value === 'weekly' && byweekday.value.length === 0 && start.value !== '') {
		const startDate = new Date(`${start.value}:00Z`);
		const isoWeekday = ((startDate.getUTCDay() + 6) % 7) + 1;
		byweekday.value = [isoWeekday];
	}
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/ScheduleField.test.ts`
Expected: PASS (all tests, including the new ones). If the `endType`/`repeat` select index assumptions in the test (`selects[selects.length - 1]`) don't match the actual render order, adjust the test to select by the field's current `modelValue` (e.g. `selects.find(s => s.props('modelValue') === 'never')`) instead of a fixed index — the behavior under test is "the end-type select changes what gets built," not its position in the DOM.

- [ ] **Step 6: Commit**

```bash
git add src/components/ScheduleField.vue src/components/ScheduleField.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add recurrence sub-form to ScheduleField"
```

---

### Task 7: Wire `ScheduleField` into `TaskDialog.vue`

**Files:**

- Modify: `src/components/TaskDialog.vue`
- Modify: `src/components/TaskDialog.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `ScheduleField` (Tasks 5-6), `describeRecurrence`, `parseRRule`, `formatWallClock` (Tasks 2-3), `TaskDraft` (already has `schedule?: Schedule`, `src/stores/tasks.ts:8-15`, unchanged).
- Produces: `TaskDialog`'s emitted `save` draft now always includes a `schedule` key (possibly `undefined`). Consumed by `TaskList.vue`'s `handleSave` (Task 9), which passes the draft straight to `tasks.update()` unchanged.

- [ ] **Step 1: Add the read-view label key**

In `src/i18n/locales/en.json`, replace the `task.schedule` block's opening from Task 6:

```json
		"schedule": {
			"enabled": "Has a schedule",
```

with:

```json
		"schedule": {
			"label": "Schedule",
			"enabled": "Has a schedule",
```

In `src/i18n/locales/ru.json`, replace:

```json
		"schedule": {
			"enabled": "Есть расписание",
```

with:

```json
		"schedule": {
			"label": "Расписание",
			"enabled": "Есть расписание",
```

In `src/i18n/locales/pl.json`, replace:

```json
		"schedule": {
			"enabled": "Ma harmonogram",
```

with:

```json
		"schedule": {
			"label": "Harmonogram",
			"enabled": "Ma harmonogram",
```

- [ ] **Step 2: Write the failing tests**

Add to `src/components/TaskDialog.test.ts` (after the existing `describe` blocks):

```ts
describe('TaskDialog schedule', () => {
	it('round-trips an existing one-time schedule back out unchanged', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Water plants', schedule: { start: '2026-08-21T09:00' } },
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
					schedule: { start: '2026-08-21T09:00', tzid: undefined, duration: undefined, rrule: undefined },
				},
			],
		]);
	});

	it('emits schedule undefined after the schedule switch is turned off', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Water plants', schedule: { start: '2026-08-21T09:00' } },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input[type="checkbox"]').setValue(false);
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
				initial: {
					name: 'File the report',
					schedule: { start: '2026-08-21T09:00', rrule: 'FREQ=WEEKLY;BYDAY=FR;INTERVAL=1' },
				},
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
				initial: { name: 'Water plants', schedule: { start: '2026-08-21T09:00' } },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Aug 21, 2026');
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/TaskDialog.test.ts`
Expected: FAIL — no schedule field exists yet, and the emitted draft has no `schedule` key.

- [ ] **Step 4: Update the implementation**

Replace the full contents of `src/components/TaskDialog.vue` with:

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
import { describeRecurrence, formatWallClock, parseRRule } from '@/utils/schedule';
import type { Schedule } from '@/types';
import type { TaskDraft } from '@/stores/tasks';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TaskDraft>;
		mode?: 'add' | 'edit';
		goalOptions: Array<{ value: string; title: string }>;
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: TaskDraft]; cancel: [] }>();

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

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.initial.name ?? '';
		note.value = props.initial.note ?? '';
		important.value = props.initial.important ?? false;
		urgent.value = props.initial.urgent ?? false;
		goalId.value = props.initial.goalId ?? '';
		schedule.value = props.initial.schedule;
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/TaskDialog.test.ts`
Expected: PASS (all tests, including the four new ones — the existing tests still pass because `schedule: undefined` is what an empty `initial` already produces, and `toEqual` ignores `undefined`-valued keys).

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskDialog.vue src/components/TaskDialog.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add schedule field to TaskDialog"
```

---

### Task 8: Wire `ScheduleField` into `AddEntityDialog.vue`'s Task tab

**Files:**

- Modify: `src/components/AddEntityDialog.vue`
- Modify: `src/components/AddEntityDialog.test.ts`

**Interfaces:**

- Consumes: `ScheduleField` (Tasks 5-6).
- Produces: `AddEntityDialog`'s `save-task` event now always includes a `schedule` key. Consumed wherever `AddEntityDialog`'s `save-task` is handled (passes straight to `tasks.add()` — no change needed there since `TaskDraft.schedule` is already optional and `add()`/`build()` already forward it, `src/stores/tasks.ts:49-60`).

- [ ] **Step 1: Write the failing test**

Add to `src/components/AddEntityDialog.test.ts`, inside the existing `describe('AddEntityDialog saving a task', ...)` block:

```ts
	it('emits save-task with a schedule when one is set', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Water plants');
		await wrapper.get('input[type="checkbox"]').setValue(true); // has a schedule
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-task')).toEqual([
			[
				{
					name: 'Water plants',
					note: undefined,
					important: false,
					urgent: false,
					goalId: undefined,
					schedule: { start: '2026-08-21T09:00', tzid: undefined, duration: undefined, rrule: undefined },
				},
			],
		]);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/AddEntityDialog.test.ts`
Expected: FAIL — no schedule field exists on the Task tab yet, and `save-task` carries no `schedule` key. Note: `input[type="checkbox"]` on the Task tab today also matches the `important`/`urgent` switches — `ScheduleField`'s own "has a schedule" switch is not among them until this task adds it, so this new test's second checkbox interaction targets `.get('input[type="checkbox"]')` (the *first* checkbox match) only once `ScheduleField` is mounted after the flag switches in the DOM order chosen below; verify the checkbox order matches by running the test and adjusting the selector to `wrapper.findAll('input[type="checkbox"]')[2]` (after the important/urgent switches) if the first `.get()` resolves to `important` instead.

- [ ] **Step 3: Update the implementation**

In `src/components/AddEntityDialog.vue`, in the template's Task tab branch, replace:

```vue
					<v-select
						v-model="taskGoalId"
						:items="taskGoalSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.goalLabel')"
					/>
				</template>
```

with:

```vue
					<v-select
						v-model="taskGoalId"
						:items="taskGoalSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.goalLabel')"
					/>
					<schedule-field v-model="taskSchedule" />
				</template>
```

In the `<script setup>` block, add the import (alongside the existing component/type imports):

```ts
import ScheduleField from './ScheduleField.vue';
import type { Schedule } from '@/types';
```

Add the ref (next to `taskGoalId`):

```ts
const taskGoalId = ref('');
const taskSchedule = ref<Schedule | undefined>(undefined);
```

In the `watch(open, ...)` reset block, add a line next to `taskGoalId.value = '';`:

```ts
	taskGoalId.value = '';
	taskSchedule.value = undefined;
```

In `onSave()`'s task branch, add `schedule` to the emitted draft:

```ts
	emit('save-task', {
		name: taskName.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: taskImportant.value,
		urgent: taskUrgent.value,
		goalId: taskGoalId.value === '' ? undefined : taskGoalId.value,
		schedule: taskSchedule.value,
	});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/AddEntityDialog.test.ts`
Expected: PASS (all tests). If the checkbox-index assumption from Step 2's note was wrong, the test's `.get('input[type="checkbox"]')` call will need to become an indexed `findAll(...)[n]` lookup instead — fix the test to target the checkbox by its position after `important`/`urgent`, not by guessing further.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddEntityDialog.vue src/components/AddEntityDialog.test.ts
git commit -m "feat: add schedule field to AddEntityDialog's Task tab"
```

---

### Task 9: Fix `TaskList.vue`'s `initialDraft` dropping `schedule`

**Files:**

- Modify: `src/pages/TasksPage/containers/TaskList.vue`
- Modify: `src/pages/TasksPage/containers/TaskList.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing new — this task only fixes a data round-trip.

- [ ] **Step 1: Write the failing test**

Add to `src/pages/TasksPage/containers/TaskList.test.ts`, and add the import:

```ts
import type { Goal, Schedule, Task } from '@/types';
```

(replacing the existing `import { Status, type Goal, type Task } from '@/types';` line with `import { Status, type Goal, type Schedule, type Task } from '@/types';`)

Add a new `describe` block:

```ts
describe('TaskList schedule', () => {
	it('preserves an existing schedule when an unrelated field is edited', async () => {
		const schedule: Schedule = { start: '2026-08-21T09:00' };
		const { wrapper, tasksStore } = await mountWithData([], [makeTask({ schedule })]);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Do Duolingo (updated)');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(tasksStore.records[0].schedule).toEqual(schedule);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/TasksPage/containers/TaskList.test.ts`
Expected: FAIL — today `initialDraft` doesn't include `schedule`, so `TaskDialog`'s `schedule` ref starts `undefined` regardless of the record's real value, and the save wipes it.

- [ ] **Step 3: Update `TaskList.vue`**

In `src/pages/TasksPage/containers/TaskList.vue`, replace:

```ts
const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent, goalId } = editing.value;
	return { name, note, important, urgent, goalId };
});
```

with:

```ts
const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent, goalId, schedule } = editing.value;
	return { name, note, important, urgent, goalId, schedule };
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pages/TasksPage/containers/TaskList.test.ts`
Expected: PASS (all tests, including the new one).

- [ ] **Step 5: Commit**

```bash
git add src/pages/TasksPage/containers/TaskList.vue src/pages/TasksPage/containers/TaskList.test.ts
git commit -m "fix: preserve task schedule through unrelated edits in TaskList"
```

---

### Task 10: Full verification and manual browser check

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests pass, including every test added in Tasks 1-9.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the build (includes `vue-tsc --noEmit`)**

Run: `npm run build`
Expected: type-checks and builds cleanly. Pay particular attention to:

- `rrule`'s `Options`/`Weekday`/`Frequency` types flowing through `buildRRule`/`parseRRule` without `any`.
- `ScheduleField`'s `Repeat`/`EndType` unions matching what `ScheduleField.test.ts` and `TaskDialog.vue`/`AddEntityDialog.vue` expect.
- `Schedule`'s optional fields (`tzid`, `duration`, `rrule`) flowing through `ScheduleField`, `TaskDialog`, and `AddEntityDialog` without `any`.

- [ ] **Step 4: Run the e2e suite**

Run: `npm run test:e2e`
Expected: passes unchanged — check whether `e2e/todo-crud.spec.ts` (or any other e2e spec) exercises task creation/editing through `TaskDialog`/`AddEntityDialog`'s Task tab; if it does and now fails because `ScheduleField`'s "has a schedule" switch shifted the DOM (e.g. a checkbox-index assumption in the e2e spec), fix the e2e spec's selector the same way Task 8 anticipated for `AddEntityDialog.test.ts` — by targeting elements by role/label, not position.

- [ ] **Step 5: Manual browser verification (Edge)**

Per CLAUDE.md's storage trap — `toStorable()`/IndexedDB structured-clone failures never show up in tests that use the in-memory repository. Run `npm run build && npm run preview`, open in Edge, and:

1. Create a task with a one-time schedule (a start date/time, no repeat). Reload the page. Confirm the schedule is still shown in the dialog's read view.
2. Create a task with an end time (e.g. 09:00–11:00). Reload. Confirm the duration survived.
3. Create a task with a timezone anchor (e.g. `America/New_York`) and a weekly recurrence on two weekdays. Reload. Confirm both the anchor and the weekdays survived.
4. Create a task repeating monthly, ending after 5 occurrences. Reload. Confirm.
5. Create a task repeating yearly, ending on a specific date. Reload. Confirm.
6. Edit a schedule-bearing task, changing only its name (leave the schedule field untouched). Save, reload. Confirm the schedule is still present — this is the regression case for the `initialDraft` fix (Task 9).
7. Edit a schedule-bearing task, turn the "has a schedule" switch off, save. Confirm the task now shows no schedule in the dialog's read view.
8. With the browser's system clock in a timezone other than the schedule's anchor (or, more practically, just trust Task 4's automated DST test — this step is a sanity spot-check, not a full re-verification): confirm the preview line inside the edit form shows a sensible "next occurrence" date for an anchored weekly schedule.

- [ ] **Step 6: Report results**

No commit for this task — if all checks pass, the stage is done and ready for the user's own review before considering `main`. If step 5 surfaces a bug, fix it in a follow-up task (write a failing test first, per this project's standing TDD convention) before declaring the stage complete.
