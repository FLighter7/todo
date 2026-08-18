# Design: deadline UI (stage 6, stage 5)

Date: 2026-08-18

## Context

`Goal.deadline` has existed in the data model since the stage 6 data-layer
cutover (`docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md`),
including its parsing/validation (`parseDeadline` in `src/types/goal.ts`) and
its round-trip through `GoalDraft`/`stores/goals.ts`'s `build()`. No UI has
ever set, edited, or displayed it — every dialog and list built through
stage 4 explicitly deferred it (`2026-08-17-stage-3-dream-goal-pages-design.md:79-81,170-171`,
`2026-08-17-stage-4-tasks-page-design.md:66,266`). This stage closes that gap.

Two further gaps remain on the stage 6 roadmap after this one — recurrence UI
(`Task.schedule`) and completion history UI (`Task.completions`) — each gets
its own brainstorm → spec → plan cycle once this one ships.

## Scope

**In scope:**
- Setting and clearing a goal's `deadline` from `GoalDialog.vue` (edit) and
  `AddEntityDialog.vue`'s Goal tab (create).
- Displaying a goal's `deadline`, formatted, in `GoalDialog.vue`'s read view
  and in the goal list (`GoalList.vue` via `EntityList`/`EntityListItem`).
- A pure formatting function, `formatDeadline()`, covering every field
  combination `parseDeadline` accepts.
- A new composite input component, `DeadlineField.vue`, covering the same
  combinations on the way in.
- Fixing `GoalList.vue`'s `initialDraft`, which today drops `deadline` on the
  floor when opening the edit dialog (see Edge cases).

**Explicitly out of scope** (deferred):
- `resolveDeadline()` (the `{from, to}` resolution against "now" promised by
  the stage-6 umbrella spec) — needed only for sorting and overdue detection,
  neither of which this stage adds.
- Any overdue/urgency visual treatment (color, icon, badge) on a goal.
- Sorting the goal list by deadline proximity — list order is unchanged.
- Recurrence UI, completion history UI — separate later stages.
- Real calendar-length validation on the day picker (rejecting e.g.
  "31 February") — `parseDeadline` itself doesn't enforce this either; the UI
  stays exactly as permissive.

## Data & formatting — `src/utils/deadline.ts`

`formatDeadline(deadline: Deadline, locale: string): string`, pure, no
dependency on the current time. Chosen over baking formatting into a
component so it's independently unit-testable and reusable from both
`GoalDialog`'s read view and `GoalList`'s list-item formatter.

Behavior by field combination (all combinations `parseDeadline` accepts —
see `src/types/goal.ts`):
- `day` set (`month` therefore set too) →
  `Intl.DateTimeFormat(locale, {day:'numeric', month:'long', year:
  deadline.year !== undefined ? 'numeric' : undefined})`, applied to a `Date`
  built from `deadline.year ?? 2000` (a leap year, chosen so a bare Feb 29
  doesn't throw) / `deadline.month - 1` / `deadline.day`. The placeholder
  year never reaches the formatted string when `deadline.year` is
  `undefined` — only the format option controls that.
- `month` set, no `day` → same formatter without `day`.
- `year` only → the year as a plain string.
- `season` set → a localized season name (`goal.deadline.season.*` i18n key)
  plus the year if present.

## Input component — `src/components/DeadlineField.vue`

`v-model<Deadline | undefined>`. Structure:
1. A leading switch/toggle, "has a deadline" — off means `undefined`,
   collapses the rest.
2. A precision selector (`v-btn-toggle` or `v-select`) with four values:
   exact day / month / year / season.
3. Precision-dependent sub-fields:
   - exact day: Year (optional, `v-text-field type="number"`), Month
     (`v-select`, required), Day (`v-select` 1–31, required)
   - month: Year (optional), Month (required)
   - year: Year (required)
   - season: Year (optional), Season (`v-select`, required, localized
     labels)
4. The component only ever emits combinations `parseDeadline` accepts — it
   never lets `day` exist without `month`, or `season` coexist with
   `month`/`day`.

Month names come from `Intl.DateTimeFormat(locale, {month:'long'}).format()`,
not twelve more hand-translated strings per locale — the same reasoning
`BackupActions.vue:75-82` already applies to `exportedAt` via
`toLocaleString(locale.value)`. `locale` is read from `useSettingsStore()`/
`useI18n()`, matching that precedent.

Day options are always 1–31 regardless of the selected month (see Scope — no
real calendar-length validation).

## Integration points

- **`GoalDialog.vue`**: editing view gets `<deadline-field v-model="deadline" />`
  after the `dreamId` select; read view gets a
  `formatDeadline(deadline, locale)` line next to the existing `dreamName`
  line, same pattern (`<p v-if>`).
- **`AddEntityDialog.vue`** (Goal tab): the same field, added the same way
  the tab already duplicates `GoalDialog`'s name/note/dreamId fields — no new
  shared sub-component beyond `DeadlineField` itself.
- **`GoalList.vue`**: `initialDraft` (`GoalList.vue:87-94`) currently
  destructures only `{name, note, dreamId}` off the record being edited.
  Because `stores/createEntityStore.ts`'s `update()` spreads the patch object
  over the existing record (`{...toRaw(existing), ...patch, updated: now}`),
  a key present in the patch with value `undefined` really does overwrite
  the stored field — so leaving `deadline` out of `initialDraft` while
  `GoalDialog` now has a deadline field would silently erase an existing
  deadline on any unrelated edit (renaming a goal, say). `initialDraft`
  gains `deadline` alongside the three existing fields; this is part of the
  integration, not a separate bug-fix task.
- **`EntityList.vue`**: gains an optional prop
  `dateLabel?: (item: T) => string | undefined`, threaded down to
  `EntityListItem` as a new `date` prop, following exactly the pattern
  `showNote` already uses for optional per-caller behavior on an otherwise
  entity-agnostic generic component. `DreamsPage`/`TasksPage` don't pass
  it — their list items are unaffected.
- **`EntityListItem.vue`**: gains the right-aligned date slot the stage-3
  spec described but never built
  (`2026-08-17-stage-3-dream-goal-pages-design.md:90-91`), rendered only
  when `date` is provided.
- **`GoalList.vue`** passes
  `:date-label="(g) => g.deadline && formatDeadline(g.deadline, locale)"` to
  `EntityList`.

## Edge cases

- Clearing an existing deadline: the "has a deadline" toggle in
  `DeadlineField` going off emits `undefined`, which round-trips through
  `GoalDialog`'s `deadline` ref into the saved draft as `deadline: undefined`
  — an explicit clear, distinct from the "field never touched" case only
  because `initialDraft` now seeds the ref from the real record first.
- A goal with no `deadline` shows no date in the list and no deadline line
  in the dialog's read view — unchanged from today.
- `AddEntityDialog`'s Goal tab needs no "existing value" round-trip (there's
  no existing record when creating), unlike `GoalDialog`.

## i18n

New keys in `en.json`/`ru.json`/`pl.json`, namespaced under
`goal.deadline.*` next to the existing `goal.dreamLabel`/`goal.noDream`:
- toggle label ("has a deadline")
- precision option labels (exact day / month / year / season)
- Year/Month/Day/Season field labels
- four season names (`goal.deadline.season.winter/spring/summer/autumn`)

## Testing

- `deadline.test.ts` — unit tests for `formatDeadline` across every field
  combination `parseDeadline` accepts, in more than one locale.
- `DeadlineField.test.ts` — new component test: toggling the "has a
  deadline" switch, switching precision resets/reveals the right
  sub-fields, emitted value is always a combination `parseDeadline` accepts,
  year-omitted cases work for month/season/day precisions.
- `GoalDialog.test.ts` — extended: deadline round-trips from `initial` into
  the field and back out on save; clearing it emits `deadline: undefined`.
- `AddEntityDialog.test.ts` — extended: Goal tab's `save-goal` event carries
  `deadline` when set.
- `GoalList.test.ts` — extended: editing a goal that already has a deadline
  without touching the deadline field preserves it (regression test for the
  `initialDraft` fix); `dateLabel` passed to `EntityList` formats as
  expected.
- `EntityList.test.ts`/`EntityListItem.test.ts` — extended:
  `dateLabel`/`date` prop renders when provided, renders nothing when
  omitted (covers `DreamsPage`/`TasksPage` staying unaffected).
- After implementation, manual verification in a real browser (per
  CLAUDE.md's storage trap): create a goal with each precision level,
  reload, confirm it survived IndexedDB's structured clone; edit an
  unrelated field on a goal with a deadline and confirm the deadline
  survives.

## Out of scope

`resolveDeadline()`, overdue/urgency indication, deadline-based sorting,
recurrence UI, completion history UI, real calendar-length day validation —
see Scope above.
