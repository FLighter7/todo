# Design: dreams, goals and tasks (stage 6)

Date: 2026-08-16

## Context

The app has one entity, `Todo`, and two pages — a list and the Eisenhower matrix. This is stage 6, the data model rework that CLAUDE.md deferred to its own conversation.

A three-level hierarchy replaces the single entity: a **dream** sits at the top and usually has no deadline; a **goal** may belong to a dream and may carry a fuzzy deadline; a **task** may belong to a goal and carries a schedule expressed in iCalendar terms. Every link is optional — a goal without a dream and a task without a goal are ordinary, first-class records. A task never attaches to a dream directly; the ladder has no shortcuts.

The matrix stays what it already is: a view over tasks, not an entity of its own.

The result is four pages (Dreams, Goals, Tasks, Matrix), the first three carrying **Active** and **History** tabs, one add button with per-entity tabs, one view-and-edit dialog, and working recurrence with a completion history.

## Why the model changes

The current `Todo` cannot express any of the three things stage 6 is for.

**There is nowhere to put intent above a task.** "Visit Japan" is not a task and never becomes one; it is the reason a dozen tasks exist. Flattening it into the same list either loses it or pollutes the list of things to do this week.

**A single `done` flag cannot describe a recurring commitment.** "File the report by 13:00 every Friday" ticked once is ticked forever. Recurrence needs per-occurrence state, which a boolean on the series cannot hold.

**`period: 'one-time' | 'periodic'` carries no information.** It labels a task as recurring without saying how, so nothing can compute when the task is next due.

## Data model

### Shared base

```ts
// src/types/entity.ts
export enum Status {
	Opened = 1,
	Done = 2,
	Cancelled = 3,
}

export interface EntityBase {
	id: string;
	name: string;
	note?: string;
	/** ISO 8601 UTC. */
	created: string;
	/** ISO 8601 UTC, moved on every user-facing change. Drives sync merges. */
	updated: string;
	status: Status;
}
```

One status for all three entities. A dream can be given up on, not only fulfilled — "changed my mind" is its own state, not a flavour of completion. Numbers rather than strings keep stored records small; `const enum` is impossible because `isolatedModules` is on.

### Dream

```ts
// src/types/dream.ts
export interface Dream extends EntityBase {}
```

Nothing beyond the base yet. The distinct type earns its place by keeping stores and repositories from being interchangeable by accident.

### Goal

```ts
// src/types/goal.ts
export enum Season {
	Winter = 1,
	Spring = 2,
	Summer = 3,
	Autumn = 4,
}

export interface Deadline {
	year?: number;
	month?: number; // 1–12
	day?: number; // 1–31
	season?: Season;
}

export interface Goal extends EntityBase {
	dreamId?: string;
	deadline?: Deadline;
}
```

A goal's deadline is deliberately vague-capable: "in 2027", "summer 2027", "March 2027" and "15 March 2027" are all things people actually mean. The shape is validated in `utils/deadline.ts` rather than in the type, because the constraints are between fields:

- `day` requires `month`;
- `month`/`day` and `season` are mutually exclusive;
- an empty object is invalid — at least one field must be present;
- a missing year means the nearest future occurrence relative to now.

Season boundaries are meteorological: spring `01.03–31.05`, summer `01.06–31.08`, autumn `01.09–30.11`, winter `01.12.Y` through the end of February of `Y+1`. Winter is the one that crosses a year end, which is why the definition is written down rather than inferred.

`resolveDeadline(deadline, now)` returns `{ from, to }`. Sorting and the overdue test both use `to`.

A missing year makes a record's meaning drift with time — "in the summer" means a different summer next year. That is accepted: it is what the user means when they decline to name a year.

### Task

```ts
// src/types/task.ts
export interface Task extends EntityBase {
	goalId?: string;
	important: boolean;
	urgent: boolean;
	schedule?: Schedule;
	completions?: Completion[];
}

/** A miniature VEVENT: exactly the RFC 5545 fields a task needs. */
export interface Schedule {
	/** Wall-clock time, 'YYYY-MM-DDTHH:mm'. No zone. */
	start: string;
	/** IANA zone when the rule is anchored to one. Absent means floating. */
	tzid?: string;
	/** ISO 8601 duration of the completion window: 'PT4H', 'P6D'. Absent means an instant. */
	duration?: string;
	/** RRULE without the prefix: 'FREQ=WEEKLY;BYDAY=FR'. Absent means one-time. */
	rrule?: string;
	/** EXDATE: skipped occurrences, in the same format as start. */
	exdate?: string[];
	/** RDATE: extra one-off occurrences. */
	rdate?: string[];
}

export interface Completion {
	/** The occurrence's local start — the merge key. */
	occurrence: string;
	done: boolean;
	/** ISO UTC of when the mark was set. LWW key within one occurrence. */
	at: string;
}
```

**The completion window is `start` + `duration`, not a structure of its own.** That is `DTSTART` + `DURATION` from iCalendar, and it expresses everything asked for with one shape:

- "file the report every Friday between 09:00 and 13:00" → `start` on a Friday at 09:00, `duration: 'PT4H'`, `rrule: 'FREQ=WEEKLY;BYDAY=FR'`;
- "pay the tax between the 10th and the 15th" → `start` on the 10th, `duration: 'P6D'`, `rrule: 'FREQ=MONTHLY;BYMONTHDAY=10'`;
- a one-time task with a deadline → the same, plus `COUNT=1`.

A deadline is the end of the window, so "one-time with a due date" needs no separate field. There is no stored `periodType`: a task is one-time when `rrule` is absent or carries `COUNT=1`, and a getter says so. Two fields encoding the same fact drift apart eventually; one does not.

The rule is stored as an RFC 5545 string rather than a bespoke object. `RRule.fromString` parses it directly, `RRuleSet` applies `EXDATE`/`RDATE`, and `RRule.fromString(s).origOptions` reconstructs the editor's form fields. The data is also self-describing and portable to a real calendar. The stated hour-to-year limit therefore lives in the editor, not the type — the editor refuses to build `SECONDLY` or `MINUTELY`.

## Time: floating versus zone-anchored

Two modes, exactly as in RFC 5545, toggled by a "bind to timezone" checkbox in the schedule editor:

- **off** → no `tzid`, the time floats. "Every day by 10:00" stays ten in the morning wherever the device travels;
- **on** → `tzid: 'Europe/Moscow'`. "By 13:00 Moscow time" stays one in the afternoon Moscow time no matter where the device is.

**UTC is never stored in a schedule**, and this is not a stylistic preference — it is wrong in both modes:

- floating: storing UTC inverts the intent. `10:00 MSK` becomes `07:00Z` and renders as `09:00` in Warsaw;
- anchored: storing UTC breaks on daylight saving. "13:00 local" is a different UTC offset in winter and summer, so a recurring rule pinned to one UTC time slides by an hour twice a year. Only a named zone survives, because only a named zone knows its own transitions.

UTC stays where it belongs — in `created` and `updated`, which denote instants rather than appointments on a wall clock.

`rrule` supports both modes itself: it works in wall-clock terms by default and implements `TZID` through the Intl API, so luxon is not needed.

## Lifecycle and garbage collection

There is no `deleted` flag. A closed record — `Done` or `Cancelled` — stays in storage with an honest `updated`, and that _is_ the tombstone: a merge sees it alongside every other edit and cannot resurrect what was closed.

Physical deletion is automatic only: a record whose `status !== Opened` and whose `updated` is older than the cleanup window is removed for good. `utils/collectGarbage.ts` holds the rule as a pure function, taking `now` as an argument rather than reading the clock:

```ts
export function collectGarbage<T extends EntityBase>(
	records: T[],
	windowDays: number,
	now: Date,
): { keep: T[]; purge: string[] };

export function pruneCompletions(task: Task, windowDays: number, now: Date): Task;
```

It runs in `createEntityStore.load()` right after reading storage, and again after a merge in `SyncFlow` before `replaceAll`, so freshly collected records never land back on disk.

`pruneCompletions` drops marks whose `occurrence` is older than the window. A recurring task is always `Opened` and so is never collected by the general rule; without pruning its array would grow without bound — a daily task over five years is roughly 1800 entries, about 110 KB, against a sync payload cap of 200 000 bytes for everything at once.

The cleanup window is a setting: 30, 60 or 90 days, defaulting to 30.

### Three rules that are easy to break

**Collection does not move `updated`.** Neither purging a record nor pruning completions is a user-facing change. If `updated` moved, every device would stamp itself an unearned win in the next merge simply by starting up. This is the one exception to "`updated` moves on every change".

**There is no physical delete in the interface.** The dialog's delete button sets `Cancelled`. A record erased from disk before its window expires comes back alive on the next sync — preventing exactly that is what the window is for.

**The effective window is the larger of the two devices'.** The setting is device-local. If the phone keeps 30 days and the desktop 90, the phone purges first, receives the record back on the next sync, and it disappears for good only on day 91. Content never changes in the process, so there is nothing to diverge, and no negotiation between devices is needed.

A consequence worth stating plainly: **history is bounded by the cleanup window.** A fulfilled dream disappears thirty days after it is closed, the same as a cancelled chore. This is a deliberate choice, not an oversight.

## Validation at the boundary

Because the enums are real `enum`s, the compiler will happily accept `entry.status as Status` and let a `7` into storage. Checks are therefore written by hand and covered by tests.

They live next to their types, in `src/types/`, and that is deliberate: the folder stops being declarations-only, but enums already emit runtime code, and a type guard is inseparable from the type it guards. `types` is the terminal node of the dependency chain, so `BackupService` and `IndexedDbRepository` can both import the parsing without inverting the direction or duplicating the work.

```ts
// src/types/entity.ts
export function isStatus(value: unknown): value is Status;
export class EntityFormatError extends Error {}

// src/types/dream.ts | goal.ts | task.ts
export function parseDream(value: unknown): Dream; // throws EntityFormatError
export function parseGoal(value: unknown): Goal;
export function parseTask(value: unknown): Task;
```

There is no `isFreq` guard: `parseTask` runs `schedule.rrule` through `RRule.fromString` and treats a throw as an invalid record. `tzid` is checked by the same Intl that renders it — an unknown zone makes `Intl.DateTimeFormat` throw `RangeError`.

Two consumers:

- **`BackupService`** replaces `readTodo` with the three parsers and wraps `EntityFormatError` in `BackupFormatError` with the record's index. A file is still parsed in full before storage is touched: a malformed file must never cost the user their list.
- **`IndexedDbRepository.getAll`** runs the same parsing. Invalid records are **skipped and counted**, not fatal; the count surfaces through `lastError`. Nothing on disk is altered, so a damaged record can still be recovered through export.

## Storage

`TodoStorage` becomes `EntityStorage<T extends EntityBase>` with the same `getAll / put / remove / clear` contract, so a store still cannot tell IndexedDB from the in-memory fallback.

The database schema goes to version 3 with three object stores — `dreams`, `goals`, `tasks` — and drops `todos`. Existing data is not migrated: the user has none worth keeping, and backup files of versions 1 and 2 are rejected for the same reason.

The schema and config are defined **once**, in `repositories/AppDatabase.ts`, shared by all three stores. Connections themselves are not pooled — each caller opens its own — but because they all go through this one `openAppDatabase()`, the `versionchange` handler only has to be attached in the one place, not once per caller. Three hand-rolled `openDB` calls would mean three copies of that handler, and forgetting one of them is the documented trap where a second tab carrying a new schema hangs forever.

## Stores

The shared half of every store — `records` (everything in storage; sync needs it), `active` (`status === Opened`), `closed` (the rest), and `load / add / update / close / reopen / replaceAll` — moves into a `createEntityStore` factory. Three stores use it: `dreams`, `goals` and `tasks`, the last holding the `quadrants` getter.

`persistent` and `lastError` do not belong to any one entity and must not be tripled, so they move to a small `stores/storage.ts` that all three write into and `DefaultLayout` reads.

## Sync

The payload gains a schema version. Without it a device running an older build would merge silently and destroy data:

```ts
type SyncPayload =
	| { schema: 3; kind: 'data'; dreams: Dream[]; goals: Goal[]; tasks: Task[] }
	| { schema: 3; kind: 'settings'; settings: AppSettings };
```

A mismatch is refused with a message telling the user to update the other device.

`SyncMerger.merge<T extends EntityBase>` keeps the existing last-write-wins rule by `id`, with local winning ties for determinism. `mergeTasks` adds the one exception, and it is named rather than hidden inside the generic merge:

**`completions` merge per occurrence, not as a value.** Whole-record LWW would discard them. Two devices out of contact, one marking August 7th and the other August 14th, produce two records neither of which contains both marks; the newer one wins entirely and a mark vanishes. Merging by `occurrence` and taking the larger `at` loses nothing: different dates never collide, and clearing a mark wins because its `at` is newer. This is the same reasoning that makes a plain array-union wrong — a union can add but never subtract, so an un-mark made offline would be undone by the other device's stale copy.

Settings sync is a separate mode rather than part of the same exchange. `SyncPage` gets a Data/Settings toggle before pairing; in Settings mode both sides send theirs and each shows a "replace local settings with the received ones?" dialog. Whoever needs them accepts. The flow is symmetric, so no role negotiation is required.

## Backup

```ts
interface Backup {
	version: 3;
	exportedAt: string;
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
	settings?: AppSettings;
}
```

Closed records are included, exactly as tombstones were before: a backup must restore a complete state, and omitting them would resurrect everything ever finished or abandoned.

## Settings

Settings live in `localStorage` under `todo.settings` as one JSON document, read and validated by a `SettingsService` that knows nothing about Vue, and exposed through a Pinia store.

```ts
interface AppSettings {
	general: { theme: AppTheme; locale: string; startPage: string; cleanupDays: 30 | 60 | 90 };
	dreams: PageSettings;
	goals: PageSettings;
	tasks: PageSettings;
}

interface PageSettings {
	rows: 1 | 2;
	confirmDone: boolean;
	confirmReopen: boolean;
}
```

Theme, locale and start page move here from their own keys. They are device-local by nature — a list that reads well on a phone is not the one that reads well on a desktop — which is why settings are not part of the ordinary data sync, but they are included in backups so a move to a new device carries them.

## Interface

Three list pages share their primitives, all presentational:

- `EntityListItem` — checkbox on the left, name, optional `note` on a second line, optional date on the right;
- `EntityListGroup` — a `fieldset`/`legend` wrapper for grouping;
- `EntityList` — groups, then the ungrouped tail, then the empty state;
- `EntityDialog` — the popup frame: title, a pencil that toggles to a checkmark for read-only ↔ editing, cancel action, and a slot for fields;
- `ConfirmDialog` — shared by completion confirmation, reopen confirmation and cascading cancellation.

Every record opens read-only. Editing starts when the user presses the pencil, and the pencil becomes a checkmark that saves. Changing recurrence edits the same record rather than splitting the series: past `completions` are keyed by occurrence date, not by rule, so they stay valid when the rule changes, and a single moved occurrence is expressed with `exdate` + `rdate`. iCalendar's `THIS-AND-FUTURE` split exists for invited participants, which this app does not have.

Each page carries **Active** (`status === Opened`) and **History** (`Done` and `Cancelled`, until collected) tabs. History is where a record returns to `Opened`, and where the reopen confirmation setting applies.

Lists are ordered newest first by `created`. A group sorts by the newest `created` inside it, so adding a goal to a dream lifts the whole group, and ordering within the group follows the same rule.

Goals group under their dream; goals without one form a flat tail. Tasks group under their goal the same way. Cancelling a parent opens a dialog that counts the children and offers cancelling the parent alone or the whole branch — the choice is the user's, because one keystroke silently closing a dozen records is not a default anyone should get by accident.

The single add button opens a dialog with Dream / Goal / Task tabs. Important and urgent become checkboxes rather than radio buttons.

Routes are `/dreams`, `/goals`, `/tasks` (renamed from `/list`) and `/matrix`, all four marked `meta.startPage` so the existing start-page selector picks them up with no extra wiring. The bottom bar reads Dreams, Goals, [+], Tasks, Matrix.

## Verification

1. Unit tests for the guards and parsers: a number outside the enum, a missing field, a wrong type, an unparseable `rrule` string, an unknown `tzid`.
2. Unit tests for `collectGarbage`: window boundaries, `updated` left untouched, completions pruned by `occurrence`, `Opened` records never collected.
3. Unit tests for `SyncMerger`: marks on two different dates both survive; an un-mark made offline wins; a closed record beats an older edit and loses to a newer one.
4. Unit tests for `deadline`: every valid field combination, a missing year, season boundaries including winter's year crossing, sorting, overdue.
5. Unit tests for the recurrence adapter — our layer, not the library: wall-clock conversion in both directions, `duration` applied to each occurrence, range boundaries, behaviour with and without `tzid`, and a daylight-saving crossing in anchored mode.
6. In a real browser (Edge — Chrome on this machine cannot verify the PWA): create a record of each type, reload, confirm it survives. The in-memory repository silently accepts Vue's reactive proxies while IndexedDB rejects them, so anything new that writes data has to be exercised at least once for real.

## Out of scope

Writing an RRULE expander by hand — month-end clamping, negative `BYMONTHDAY`, `COUNT` against `UNTIL`, leap years — is a known pit, and the tests needed to fill it cost more than `rrule`'s 13.6 KB gzipped. Luxon is not needed either: `rrule` implements `TZID` through Intl.

Also out of scope: a separate `completions` table (merging by `occurrence` inside the task gives the same correctness without a fourth entity), a `deleted` flag, negotiating the cleanup window between devices, migrating old data, reading version 1 and 2 backup files, and any remote or deployment work.
