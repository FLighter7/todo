# Design: completion history (stage 7)

Date: 2026-08-19

## Context

`Task.completions` has existed in the data model since the stage 6 data-layer
cutover, including its parsing (`parseCompletion` in `src/types/task.ts`),
its garbage collection (`pruneCompletions` in `src/utils/collectGarbage.ts`),
and its sync merge (`SyncMerger.mergeCompletions` in
`src/services/sync/SyncMerger.ts`, per-occurrence, tie-broken by `at` — see
`docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md`). All three
are already tested and load-bearing. No UI has ever set a completion: there is
no store action that touches `completions`, and no component displays or
edits one. This stage closes that gap — the last piece of the stage 6
dreams/goals/tasks rework, and the one CLAUDE.md has flagged as outstanding
since the tasks-page rework shipped.

`docs/superpowers/specs/2026-08-18-stage-6-recurrence-ui-design.md` explicitly
deferred two things to this stage: showing a concrete list of occurrences on
screen, and editing `exdate`/`rdate` (skipping or moving a single occurrence)
— both "belong with completion history," in that spec's words, because both
need the occurrence list this stage introduces. That spec also left a named
debt in `nextOccurrence` (`src/utils/schedule.ts`): the function ignores
`schedule.exdate`/`schedule.rdate` entirely, with a doc comment saying "the
completion-history stage, when it starts editing those fields, will need to
fold them into this function." This design pays that debt.

## Scope

**In scope:**

- Marking an individual occurrence of a **periodic task** (`isPeriodic(task)
  === true`) done or not done, and skipping or un-skipping one, from inside
  `TaskDialog.vue`.
- A new adapter function, `listOccurrences`, enumerating a fixed window of
  occurrences around now for that UI.
- Fixing `nextOccurrence` to honor `schedule.exdate`/`schedule.rdate`.
- Two new task-store actions that own the write side: computing the full
  patch (`completions`, `schedule.exdate`, and — for the last occurrence of a
  bounded series — `status`) and writing it in one `update()` call.
- Pruning `schedule.exdate` in `collectGarbage.ts`, mirroring the existing
  `pruneCompletions`, now that this stage makes `exdate` a live-written field
  instead of dead code.
- Tightening `parseCompletion`'s validation to match `Schedule`'s fields, now
  that this stage makes it the first real write path for user-entered
  completions.

**Explicitly out of scope** (deferred or deliberately excluded):

- **One-time tasks.** A task with no `rrule` has exactly one moment, and
  `status: Done` already answers "is it done" for that case. Per-occurrence
  completion tracking is meaningless for a task with only one occurrence.
- **Any UI outside `TaskDialog.vue`.** No inline toggle in `TaskList.vue` or
  `TaskQuadrant.vue`, no dedicated page. Marking or skipping an occurrence
  requires opening the task.
- **Authoring `rdate`.** This stage's skip action only ever writes to
  `exdate`. `rdate` is honored when reading (see Adapter) for the same reason
  `ScheduleField`'s "Custom" fallback honors an `rrule` no preset could have
  produced — a hand-edited or future-authored record shouldn't be silently
  misread — but nothing in this app ever creates an `rdate` entry.
  authoring a matching "add a one-off occurrence" affordance stays a future
  stage.
- **Any streak/statistics view.** The occurrence list is a flat window of
  states, not a dashboard.
- **A configurable window size.** Past/future occurrence counts are a fixed
  constant, not a setting.

## Adapter — `src/utils/schedule.ts`

```ts
export interface OccurrenceEntry {
	/** Wall-clock start — the same value `Completion.occurrence` keys on. */
	start: string;
	end: string;
	state: 'pending' | 'done' | 'skipped';
}

export function listOccurrences(
	schedule: Schedule,
	completions: Completion[] | undefined,
	from: Date,
	pastCount: number,
	futureCount: number,
): OccurrenceEntry[];
```

Returns `pastCount` occurrences strictly before `from` and up to `futureCount`
occurrences at or after `from` (fewer at either end once the series itself
runs out — a new task or the tail of a bounded series never gets padded).
`from` is a real moment, converted into the schedule's own wall-clock domain
the same way `nextOccurrence` already does (`deviceLocalWallClock` when
floating, `instantAsWallClockInZone` when anchored). `state` per entry:
`'done'` when `completions` has an entry for that occurrence with
`done: true`; `'skipped'` when the occurrence is in `schedule.exdate`;
`'pending'` otherwise (including a `completions` entry with `done: false` —
see Store actions for why that's a real, distinct value from "no entry").

**`listOccurrences` never filters by `exdate` — it tags.** This is the
opposite of what `nextOccurrence` needs to do. `nextOccurrence` answers "when
does this really next happen," so an excluded date must be skipped over
entirely. `listOccurrences` answers "what can the user act on," and a skipped
occurrence is exactly the kind of row that needs to stay on screen with an
un-skip affordance — omitting it would make skipping irreversible through this
UI. Both functions still need every *other* piece of `nextOccurrence`'s
machinery: `dtstart` always derived from `schedule.start` and never trusted
from the `rrule` string, `tzid` never passed to `RRule` itself (see that
function's existing implementation note on the rrule 2.8.1 host-timezone
bug), and `rdate` entries merged in as extra standalone candidates alongside
whatever the `RRULE` itself generates.

**Reusing `nextOccurrence`'s machinery for a wall-clock-domain probe needs
care.** `nextOccurrence(schedule, from)` takes `from` as a real moment and
converts it into the schedule's wall-clock domain before comparing — correct
when `from` genuinely is "the current instant," wrong for a caller that
already holds a value in that same wall-clock domain (running it through
`deviceLocalWallClock` a second time would reinterpret a wall-clock reading as
if it were a real moment in the device's own OS timezone, silently shifting
it). Both `listOccurrences` and the last-occurrence check below are exactly
that second kind of caller — they start from an existing occurrence string,
not from "now." The fix factors `nextOccurrence`'s body into a shared core
that takes an already-wall-clock-domain comparison point (`dtstart`
derivation, `rdate` merging, `rule.after()`/`rule.before()`), with
`nextOccurrence` itself becoming a thin wrapper that does the
moment-to-wall-clock conversion and calls that core. `listOccurrences` and the
last-occurrence check call the core directly.

**Last-occurrence check** (used by the store actions, not exported
separately as its own public function unless the implementation finds that
cleaner): whether a given occurrence is the last one of a bounded series is
answered empirically, not by re-deriving COUNT/UNTIL arithmetic — probe the
shared wall-clock-domain core one minute past that occurrence's `start`
(occurrences are minute-granularity, so one minute strictly clears it); an
`undefined` result means nothing follows. This works identically for
`COUNT`-bounded and `UNTIL`-bounded rules, and correctly accounts for
`exdate`, since the core already skips excluded dates when answering "is
there really a next one" — no separate reasoning about how `EXDATE`
interacts with `COUNT` is needed.

## Store actions — `src/stores/tasks.ts`

```ts
setOccurrenceDone(taskId: string, occurrence: string, done: boolean): Promise<void>;
setOccurrenceSkipped(taskId: string, occurrence: string, skipped: boolean): Promise<void>;
```

Both actions look up the current record, compute a full patch, and write it
through the existing `update(id, patch)` in one call — one `updated` bump,
not one per touched field.

**Mutual-exclusion invariant.** An occurrence never carries both an `exdate`
entry and a `completions` entry at once. Each action clears the other side
for that occurrence before writing its own:

- `setOccurrenceDone(id, occurrence, done)` writes `{occurrence, done, at:
  now}` into `completions` (replacing any existing entry for that
  `occurrence`), and removes `occurrence` from `schedule.exdate` if present.
- `setOccurrenceSkipped(id, occurrence, true)` adds `occurrence` to
  `schedule.exdate`, and removes any `completions` entry for that
  `occurrence`. `setOccurrenceSkipped(id, occurrence, false)` removes it from
  `schedule.exdate` and writes nothing to `completions` — the occurrence
  returns to `pending` with no completion record, the same state a
  never-touched occurrence has.

**"Not done" is a write, not a deletion.** `setOccurrenceDone(id, occurrence,
false)` still writes `{occurrence, done: false, at: now}` — it does not
remove the array entry. `SyncMerger.mergeCompletions` merges per `occurrence`
with the newer `at` winning; if unmarking deleted the local entry instead,
a device that never saw the unmark would still hold its old `done: true`
entry, and after a sync there would be nothing on the unmarking side to
outrank it — the unmark would silently vanish. This is the same shape as
CLAUDE.md's "no `deleted` flag, a closed record is its own tombstone" rule,
scoped down to a single occurrence instead of a whole record.

**Auto status transition.** Both actions apply the same rule after computing
their patch: if the toggled `occurrence` is the last occurrence of the series
(per the adapter's last-occurrence check, evaluated against the
already-patched `schedule`) —

- and the new state is resolved (`done` or `skipped`) — `status: Opened →
  Done`;
- and the new state is `pending` (an undone or an un-skip) — `status: Done →
  Opened`.

The rule only ever moves between `Opened` and `Done`, and only ever fires
when the *current* status is the one it moves away from — in particular, a
`Cancelled` task is never touched by either action, regardless of what
happens to its occurrences. Cancelling is a manual decision distinct from "the
series ran out," and a stray tap on the last occurrence of a cancelled task
sitting in History must not silently resurrect it as Done or reopen it. This
also means it's symmetric with no confirmation: unlike the manual
close/reopen flow (gated by the `confirmDone`/`confirmReopen` settings), this
is a side effect of an occurrence action the user already took deliberately,
not a standalone close/reopen action of its own.

A task with an unbounded series (`schedule.rrule`'s end is `{type: 'never'}`)
never triggers this — the last-occurrence check never returns "no next
occurrence" for it.

## `parseCompletion` validation — `src/types/task.ts`

Today `parseCompletion` only checks `occurrence`/`at` are strings — no format
check, unlike `Schedule.start`/`exdate`/`rdate`, which all run through
`assertWallClock`. That was safe while `completions` were only ever written
by sync (already-validated data crossing the wire) and GC (never rewriting
values, only filtering). This stage's store actions are the first code path
that constructs a `Completion` from scratch, so `occurrence` gets the same
`assertWallClock` check `Schedule`'s wall-clock fields already use.

`at` stays a plain string check. It would be tempting to add a "parses as a
valid instant" check for symmetry, but `EntityBase.created`/`updated` — the
other UTC-moment fields in this codebase — carry no format validation either
(`parseEntityBase` runs them through the same bare `readString` as `name` or
`id`). Giving `Completion.at` a stricter check than `Task.updated` gets would
be a new, one-off validation depth with no precedent, not a consistent
application of an existing one.

## UI component — `src/components/TaskCompletions.vue`

Presentational, no store or service access (per Architecture.md's
components-vs-containers split).

```ts
defineProps<{ occurrences: OccurrenceEntry[]; locale: string }>();
defineEmits<{
	'toggle-done': [occurrence: string, done: boolean];
	'toggle-skip': [occurrence: string, skipped: boolean];
}>();
```

One row per `OccurrenceEntry`, formatted via the existing `formatWallClock`.
A `pending` row shows a "mark done" affordance and a "skip" affordance. A
`done` row shows the same slot as a checked/undo control ("mark not done") and
no skip action — skipping only ever applies to a `pending` occurrence, past or
future alike (both directions are meaningful: a future skip is "won't do
this one," a past skip is "this one didn't need doing"). A `skipped` row
shows only "un-skip." The component owns none of this state — every click
just emits the corresponding event with the occurrence's `start` as the key;
the container decides what happens next.

## Integration points

- **`TaskDialog.vue`**: the `initial: Partial<TaskDraft>` prop
  (`TaskDialog.vue:72-79`) becomes `record: Task | null`. The `watch(open,
  ...)` block that currently seeds the draft refs from `props.initial`
  (`TaskDialog.vue:122-138`) seeds them from `props.record` instead — same
  copy-on-open pattern, one source instead of two. This also removes the
  entire class of bug the recurrence and deadline stages each hit once
  already (a field present on the record but missing from a hand-maintained
  "initial draft" subset silently drops on the next unrelated edit) for every
  current and future `Task` field, not just this stage's own concern with
  `id`/`completions`.
  A new `<task-completions>` block is added to the read-view template
  (`TaskDialog.vue:45-58`, the `v-else` branch — not the editing form), gated
  on `record !== null && isPeriodic(record)`, right after the existing
  schedule summary line (`TaskDialog.vue:51-53`). Its `occurrences` prop is
  computed as `listOccurrences(record.schedule, record.completions, new
  Date(), PAST_WINDOW, FUTURE_WINDOW)` with `PAST_WINDOW = FUTURE_WINDOW = 5`
  declared locally. `TaskDialog` re-emits the component's two events upward
  unchanged (`toggle-completion-done`, `toggle-completion-skip`), carrying
  `record.id` alongside the occurrence so the container doesn't need to track
  which record is open.
- **`TaskList.vue`**: `editing` (`TaskList.vue:85`) changes from `ref<Task |
  null>` — a snapshot taken once in `openEdit` (`TaskList.vue:109-112`) — to
  `ref<string | null>` holding just the id, paired with `const editingTask =
  computed(() => tasks.records.find((task) => task.id === editing.value) ??
  null)`. `initialDraft` (`TaskList.vue:86-93`) and the new `record` prop
  passed to `<task-dialog>` both read from `editingTask`. Without this
  change, the dialog would keep showing the pre-action snapshot after
  `setOccurrenceDone`/`setOccurrenceSkipped` fires — the checkbox the user
  just pressed wouldn't visibly update until they closed and reopened the
  dialog. `TaskList.vue` adds two handlers for the new events, calling
  `tasks.setOccurrenceDone`/`tasks.setOccurrenceSkipped` — the only place in
  this feature that touches the store, matching every other write in this
  file (`handleSave`, `onCancel`, `useToggleConfirm`'s `onToggle`).
- `EntityList.vue`/`TaskQuadrant.vue`: unchanged — see Scope.

## Edge cases

- **A skipped-then-later-edited schedule.** If the user changes the
  recurrence rule itself (still out of this stage's UI reach except through
  `ScheduleField` in the editing form) such that a previously generated
  occurrence no longer matches the new rule, any stray `completions`/`exdate`
  entry for it simply stops being visible — `listOccurrences` only ever
  enumerates around a window of *currently valid* candidate dates. Nothing
  deletes the stray entry; it ages out through the existing
  `pruneCompletions`/the new `exdate` pruning, same "invisible now, physically
  removed later" shape the rest of this app already uses for closed records.
- **Sync and a stale completion behind a skip.** Whole-record fields
  (including `schedule`, hence `exdate`) merge by last-write-wins on
  `updated`; `completions` merges per-occurrence. If one device skips an
  occurrence (removing its local completion entry) while the other device
  independently left an older completion entry for that same occurrence
  untouched, a sync can end up with the winning `schedule` excluding the
  occurrence while a `completions` entry for it still lingers from the
  losing side. This is harmless: `listOccurrences` always tags state from
  `exdate` membership first, so an excluded occurrence never surfaces as
  anything but `skipped` regardless of what `completions` says about it, and
  the orphaned entry is cleared the next time it ages past the
  `pruneCompletions` window.
- **Fewer than the window size exist.** A brand-new periodic task has no past
  occurrences; the tail of a bounded series eventually has no future ones.
  `listOccurrences` returns however many are actually there — no padding, no
  placeholder rows.
- **A `record` of `null`.** `TaskDialog` mounts before `TaskList` has
  anything selected, or a caller opens it without a task. The draft-seeding
  watcher already defends against `props.initial` being absent today; the
  same guard covers `record` being `null` (empty draft, no
  `<task-completions>` block rendered).

## i18n

New keys in `en.json`/`ru.json`/`pl.json`, namespaced under
`task.completions.*` next to the existing `task.schedule.*`:

- Section label ("Completions").
- Aria-labels for the four row actions: mark done, mark not done, skip,
  un-skip.
- A short caption summarizing the visible window's done count, pluralized
  through the existing `slavicPluralRule` registration (`src/i18n/index.ts`)
  the same way `task.schedule.recurrence.endAfterCount` already is
  (`"{n} time | {n} times"` in `en.json`, three pipe-separated forms in
  `ru.json`/`pl.json`).

## Testing

- `schedule.test.ts` (extended):
  - `listOccurrences`: correct counts on both sides of `from`; an `exdate`
    entry appears as `skipped`, never omitted; an `rdate` entry appears
    merged in chronologically; state mapping from `completions` (`done`,
    explicit `done: false`, and no entry at all all read as expected); fewer
    results than requested at either end when the series doesn't have that
    many.
  - `nextOccurrence`: new cases for `exdate` (an excluded date is skipped,
    the next non-excluded one returned) and `rdate` (an extra one-off
    occurrence is considered, including when it sorts earlier than the next
    `RRULE`-generated one).
  - The last-occurrence check (however it ends up exposed): true for the
    final occurrence of a `COUNT`- or `UNTIL`-bounded series, false for every
    earlier one and for an unbounded series, correct once `exdate` removes
    what would otherwise have been the last one.
- `tasks.test.ts` (extended): `setOccurrenceDone`/`setOccurrenceSkipped` —
  the mutual-exclusion invariant in both directions; unmarking writes
  `done: false` rather than deleting; `Opened → Done` on marking/skipping the
  last occurrence, `Done → Opened` on undoing/un-skipping it; a `Cancelled`
  task's status is never touched by either action; toggling a non-last
  occurrence never touches status; one `update()` call per action (single
  `updated` bump).
- `collectGarbage.test.ts` (extended): `exdate` pruning by the same
  `cleanupDays` window `pruneCompletions` already uses, mirroring its
  existing test shapes (boundary-inclusive, doesn't move `updated`, doesn't
  rewrite a task whose `exdate` didn't change).
- `types/task.test.ts` (extended): `parseCompletion` rejects a
  non-wall-clock `occurrence` (trailing `Z`, numeric offset, seconds — the
  same shapes `Schedule.start` already rejects).
- `TaskCompletions.test.ts` (new): correct action set rendered per state
  (`pending`/`done`/`skipped`); `toggle-done`/`toggle-skip` emit with the
  right occurrence key.
- `TaskDialog.test.ts` (extended): `record` drives both the draft form and
  the read view (replacing the `initial`-based assertions); `<task-completions>`
  renders only for a periodic `record`; its events are re-emitted with the
  record's id attached.
- `TaskList.test.ts` (extended): the new event handlers call
  `tasks.setOccurrenceDone`/`setOccurrenceSkipped`; the dialog reflects a
  store-driven change to the open record without being closed and reopened
  (regression test for the `editing`-as-id change).
- After implementation, manual verification in a real browser (per
  CLAUDE.md's storage trap): mark, unmark, skip, and un-skip an occurrence,
  reload, confirm `completions`/`exdate` survive IndexedDB; mark the last
  occurrence of a bounded series done and confirm the task moves to History;
  undo it and confirm it moves back.

## Out of scope

One-time-task completion tracking, any UI outside `TaskDialog.vue` (inline
list/matrix toggles, a dedicated page), `rdate` authoring, a configurable
window size, and any streak/statistics view — see Scope above.
