# Design: recurrence UI (stage 6, stage 6)

Date: 2026-08-18

## Context

`Task.schedule` has existed in the data model since the stage 6 data-layer
cutover (`docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md`),
including its parsing/validation (`parseSchedule` in `src/types/task.ts`),
the `isPeriodic()` helper, and its round-trip through `TaskDraft`/
`stores/tasks.ts`'s `build()`. No UI has ever set, edited, or displayed it —
every dialog built through stage 5 leaves `schedule` untouched. This stage
closes that gap.

`toStorable()` in `stores/createEntityStore.ts` already walks every nested
level of a record before writing to storage, so `schedule` surviving
IndexedDB's structured-clone requirement needs no special handling the way
`GoalDialog`'s `deadline` field once did — that trap is already paid for
generically.

One further gap remains on the stage 6 roadmap after this one — completion
history UI (`Task.completions`) — which gets its own brainstorm → spec → plan
cycle once this one ships.

## Scope

**In scope:**
- Setting and clearing a task's `schedule` from `TaskDialog.vue` (edit) and
  `AddEntityDialog.vue`'s Task tab (create): start date/time, an optional end
  time (→ `duration`), an optional timezone anchor (→ `tzid`), and an
  optional recurrence rule (→ `rrule`) built from a fixed set of presets
  (daily / weekly / monthly / yearly) with an interval and an end condition
  (never / after N occurrences / until a date).
- Displaying the schedule, described in words plus its next occurrence, in
  `TaskDialog.vue`'s read view and live inside the edit form as the user
  builds the rule.
- A pure recurrence adapter, `src/utils/schedule.ts` — the "our adapter, not
  the library" layer the stage-6 umbrella spec calls out for testing:
  structured-rule ⇄ RRULE-string conversion, a human-readable description,
  and next-occurrence computation across wall-clock/tzid/duration.
- A new composite input component, `ScheduleField.vue`, covering the same
  fields on the way in.
- Fixing `TaskList.vue`'s `initialDraft`, which today drops `schedule` on
  the floor when opening the edit dialog (same bug class `GoalList.vue` had
  for `deadline`, fixed in 41c1b50) — this would otherwise silently erase a
  task's schedule on any unrelated edit once `TaskDialog` gains the field.

**Explicitly out of scope** (deferred):
- `exdate`/`rdate` — skipping or moving a single occurrence. Needs a list of
  concrete occurrences on screen, which belongs with completion history
  (the next stage), not with editing the series' own rule.
- Showing schedule information in the task list (`TaskList.vue` /
  `EntityList`) or in the matrix (`TaskQuadrant.vue`) — both stay unchanged;
  the schedule is visible only inside the task's own dialog.
- Multi-day `duration`. The end-time control only ever produces a
  same-day `duration` (`PTnHnM`); a range like `P6D` remains constructible
  only by hand (or a future UI), never by `ScheduleField`.
- Free-form RRULE text entry as an authoring method. The only way `rrule` is
  *written* by this stage is through the four presets. A raw string can
  still be *read back* (see Edge cases) — that's a safety net, not an
  authoring path.

## Adapter — `src/utils/schedule.ts`

Pure, no Vue dependency, mirroring `deadline.ts`'s shape.

```ts
export interface RecurrenceRule {
	freq: 'daily' | 'weekly' | 'monthly' | 'yearly';
	interval: number; // "every N days/weeks/months/years"
	byweekday?: number[]; // weekly only; ISO weekday numbers, 1=Mon..7=Sun
	// `until` is a bare calendar date, 'YYYY-MM-DD' — the field only ever
	// offers a date picker, no time. `buildRRule` turns it into the RRULE's
	// UNTIL at 23:59 wall-clock on that date, so the picked date is always
	// fully included regardless of `start`'s own time-of-day, without
	// relying on an exact-match inclusive-boundary comparison.
	end: { type: 'never' } | { type: 'count'; count: number } | { type: 'until'; until: string };
}
```

- `buildRRule(rule: RecurrenceRule): string` — the inverse of `parseRRule`;
  produces exactly the RRULE grammar `parseSchedule`'s
  `RRule.fromString(rule)` check accepts.
- `parseRRule(rrule: string): RecurrenceRule | undefined` — maps an existing
  `rrule` string back to structured form. Returns `undefined` when the
  string doesn't match the shape any preset can produce (multiple
  `BYMONTHDAY`, `BYSETPOS`, `BYYEARDAY`, an `INTERVAL` combined with fields
  no preset sets, etc.) — see Edge cases for what the field does with that.
- `describeRecurrence(rule: RecurrenceRule, t, locale): string` — a
  human-readable summary ("Every 2 weeks on Mon, Wed", "Every month, 6
  times"). Weekday names come from
  `Intl.DateTimeFormat(locale, {weekday:'short'})`, not hand-translated
  strings, the same reasoning `DeadlineField` already applies to month
  names.
- `nextOccurrence(schedule: Schedule, from: Date): { start: string; end: string } | undefined` —
  resolves the next occurrence at or after `from`, both fields wall-clock
  strings in the same `'YYYY-MM-DDTHH:mm'` shape as `Schedule.start` /
  `Completion.occurrence` (`start === end` when there's no `duration`).
  Returning wall-clock strings rather than `Date` instants matches how this
  app already models an occurrence — `Completion.occurrence` is a string for
  exactly this reason — and sidesteps a real bug this design ran into (see
  below): a `Date` claiming to be "the occurrence, as a moment" is
  ambiguous for a floating schedule, which has no moment, only a wall-clock
  reading. Deliberately unaware of `exdate`/`rdate`: this stage's UI never
  writes them, so a schedule this form produces never has any to consider.
  The completion-history stage, when it starts editing those fields, will
  need to fold them into this function.

  **Implementation note — do not pass `tzid` to `RRule`'s own constructor
  option.** Verified empirically against the installed `rrule` 2.8.1
  (`node_modules/rrule/dist/esm/dateutil.js`'s `dateInTimeZone`): its native
  `tzid` support computes the anchor offset via
  `Intl.DateTimeFormat().resolvedOptions().timeZone` — the **host
  machine's** own system zone, not the schedule's `tzid` — and shifts every
  occurrence by the difference between the two. On any host not itself
  running in UTC (a Vitest run, a developer's machine, a user's browser in
  almost any timezone), every anchored occurrence comes out wrong by a
  host-dependent, non-obvious amount; on a Europe/Warsaw host, a schedule
  anchored to `America/New_York` at 09:00 rendered as 10:00 across a whole
  month, DST transition included. RRULE iteration in this adapter always
  happens in the tzid-oblivious wall-clock-encoded domain (`RRule` never
  receives `tzid`); when `schedule.tzid` is set, `from` is converted into
  "what wall-clock reading is this instant in `tzid`" via
  `Intl.DateTimeFormat`'s `formatToParts` (two passes, to converge across a
  DST transition) before being handed to `rule.after()`, and the result's
  UTC-getter components are read directly as the wall-clock occurrence —
  no further zone conversion needed, since the desired output is already a
  wall-clock string. This was verified directly against the DST scenario in
  Edge cases below before being written into this spec.

## Input component — `src/components/ScheduleField.vue`

`v-model<Schedule | undefined>`. Same `lastEmitted`-echo-suppression pattern
`DeadlineField.vue` uses, for the same reason: the toggle can be on while the
currently-selected preset's fields are incomplete (e.g. switching from
weekly to monthly, or clearing the interval to retype it), and `build()`
legitimately returns `undefined` during that window — that must not read as
an external clear and collapse the form.

Structure:
1. A leading switch, "has a schedule" — off means `undefined`, collapses
   everything below.
2. Start date + time (`start`), required once the switch is on.
3. A switch, "add an end time" — off means no `duration`; on reveals a
   second time picker (same day as `start`) and the difference is
   serialized as `PTnHnM`.
4. A switch, "anchor to a timezone" — off means `tzid` absent (floating); on
   reveals a `v-select` populated from `Intl.supportedValuesOf('timeZone')`.
5. A `v-select`, "Repeat", with five values: Doesn't repeat / Daily / Weekly
   / Monthly / Yearly / *Custom* (the last one only ever appears as a
   read-only fallback — see Edge cases, never user-selectable to create a
   new schedule).
6. When a repeating preset is selected:
   - `interval`: a number input, "every N days/weeks/months/years".
   - Weekly only: weekday checkboxes/chips, ISO Mon–Sun, defaulting to the
     weekday of `start`; the last checked day cannot be unchecked (mirrors
     `DeadlineField`'s validity guards — the field never emits a weekly rule
     with an empty `byweekday`).
   - Monthly/Yearly: no extra control — the day-of-month / month-and-day
     come from `start` itself.
   - End condition, a `v-select`: Never / After N occurrences / Until a
     date. "After N occurrences" has a minimum of 2 (see Edge cases for
     why); "Until a date" reveals a date picker.
7. A caption line under the repeat section, live: `describeRecurrence()`
   plus the formatted result of `nextOccurrence()` from now. Present
   whenever a repeating preset is selected; absent for "Doesn't repeat" and
   for the "Custom" fallback (nothing to describe confidently there).

The component only ever emits a `Schedule` that `parseSchedule` accepts, and
— specifically for the recurring case — only ever an `rrule` string
`buildRRule` produced from a complete `RecurrenceRule`.

## Integration points

- **`TaskDialog.vue`**: editing view gets `<schedule-field v-model="schedule" />`
  after the `goalId` select; read view gets a line with
  `describeRecurrence`/formatted `start` next to the existing `goalName`
  line, following the same `<p v-if>` pattern `GoalDialog` uses for
  `deadline`.
- **`AddEntityDialog.vue`** (Task tab): the same field, added the same way
  the tab already duplicates `TaskDialog`'s other fields — no new shared
  sub-component beyond `ScheduleField` itself.
- **`TaskList.vue`**: `initialDraft` (`TaskList.vue:86-93`) currently
  destructures only `{name, note, important, urgent, goalId}` off the record
  being edited. Because `stores/createEntityStore.ts`'s `update()` spreads
  the patch object over the existing record, a key present in the patch with
  value `undefined` overwrites the stored field — so leaving `schedule` out
  of `initialDraft` while `TaskDialog` now has a schedule field would
  silently erase an existing schedule on any unrelated edit (toggling
  `important`, say). `initialDraft` gains `schedule` alongside the four
  existing fields; this is part of the integration, not a separate bug-fix
  task.
- `EntityList.vue`/`EntityListItem.vue`/`TaskQuadrant.vue`: unchanged — see
  Scope.

## Edge cases

- **"After N occurrences" minimum is 2.** `COUNT=1` is indistinguishable
  from a one-time task: `isPeriodic()` treats any `rrule` whose `count===1`
  as *not* periodic. Allowing N=1 here would let the user build a rule that
  silently behaves like "Doesn't repeat" through a different control,
  producing a confusing round-trip (the description would say "repeats
  once" while the rest of the app treats the task as non-recurring). The
  end-condition number input enforces a floor of 2; a user who wants exactly
  one occurrence picks "Doesn't repeat" instead.
- **An existing `rrule` that fits no preset.** `parseRRule` returning
  `undefined` on load selects the "Custom" option in the Repeat dropdown,
  shows the raw `rrule` string read-only (no caption line, no editable
  sub-fields), and leaves it completely untouched unless the user explicitly
  picks a different Repeat value — which then replaces the rule outright,
  same as switching between any other two presets. This case is close to
  unreachable today, since this form is the only thing that ever writes an
  `rrule` — the safety net is for the future (an import path, a hand-edited
  IndexedDB record, a later richer editor), not a case this stage's own
  round-trip can hit.
- **Clearing an existing schedule.** The "has a schedule" switch going off
  emits `undefined`, which round-trips through `TaskDialog`'s `schedule` ref
  into the saved draft as `schedule: undefined` — an explicit clear, the
  same shape `DeadlineField`'s clear already takes.
- **A task with no `schedule`** shows no schedule line in the dialog's read
  view — unchanged from today.
- **`AddEntityDialog`'s Task tab** needs no "existing value" round-trip
  (there's no existing record when creating), unlike `TaskDialog`.
- **Daylight saving.** An anchored (`tzid` set) weekly/monthly/yearly rule
  whose occurrences straddle a DST transition keeps firing at the same local
  wall-clock time before and after the transition; a floating rule (no
  `tzid`) has no timezone to shift relative to and is unaffected by
  definition. Both behaviors are `nextOccurrence`'s responsibility and are
  covered directly by its unit tests, not by anything `ScheduleField` does
  itself.

## i18n

New keys in `en.json`/`ru.json`/`pl.json`, namespaced under `task.schedule.*`
next to the existing `task.goalLabel`/`task.noGoal`:
- "has a schedule" / "add an end time" / "anchor to a timezone" switch
  labels.
- Start/end time field labels, timezone select label.
- Repeat select label and its five option labels (Doesn't repeat / Daily /
  Weekly / Monthly / Yearly / Custom).
- Interval label ("every N …"), with the unit depending on `freq`.
- Weekday selection label (the day names themselves come from `Intl`, not
  i18n keys).
- End-condition select label and its three option labels, plus the
  "occurrences" unit label and the "until" date label.
- The caption line's template strings for `describeRecurrence` (interpolated
  with interval/weekday/day-of-month/count/until as needed).

## Testing

- `schedule.test.ts` — unit tests for the adapter:
  - `buildRRule`/`parseRRule` round-trip for each of the four presets
    crossed with each of the three end conditions, including non-default
    `interval` values.
  - `parseRRule` returns `undefined` for a rule with `BYSETPOS`, multiple
    `BYMONTHDAY`, or any other shape no preset produces.
  - `nextOccurrence`: wall-clock conversion in both directions; `duration`
    applied to the resulting occurrence window; range boundaries (an
    occurrence exactly at `from`); behavior with and without `tzid`; a
    daylight-saving crossing in anchored mode keeps the local time fixed.
  - `describeRecurrence` across each preset/end-condition combination, in
    more than one locale.
- `ScheduleField.test.ts` — new component test: toggling "has a schedule";
  switching Repeat presets resets/reveals the right sub-fields; the weekly
  weekday guard (can't uncheck the last day); the "after N occurrences"
  floor of 2; the end-time toggle producing a correct `duration`; the tzid
  toggle revealing the timezone picker; the "Custom" fallback staying inert
  until the user explicitly changes the Repeat value; emitted value always a
  `Schedule` `parseSchedule` accepts.
- `TaskDialog.test.ts` — extended: `schedule` round-trips from `initial`
  into the field and back out on save; clearing it emits
  `schedule: undefined`; the read view shows the recurrence description.
- `AddEntityDialog.test.ts` — extended: Task tab's `save-task` event carries
  `schedule` when set.
- `TaskList.test.ts` — extended: editing a task that already has a schedule
  without touching the schedule field preserves it (regression test for the
  `initialDraft` fix, mirroring the deadline one).
- After implementation, manual verification in a real browser (per
  CLAUDE.md's storage trap): create a recurring task, reload, confirm it
  survives IndexedDB; edit an unrelated field on a task with a schedule and
  confirm the schedule survives.

## Out of scope

`exdate`/`rdate` editing, schedule display in the task list and matrix,
multi-day `duration`, free-form RRULE text entry, completion history UI —
see Scope above.
