# Design: tasks page & unified add dialog (stage 6, stage 4)

Date: 2026-08-17

## Context

Stage 3 shipped `DreamsPage`/`GoalsPage` on shared primitives
(`EntityListItem`/`EntityListGroup`/`EntityList`/`EntityDialog`/
`ConfirmDialog`), Active/History tabs, dream-under-goal grouping, cascading
cancel, and a route-aware `QuickAddFab`. It deliberately left the existing
`TasksTable` (a `v-data-table`) untouched, deferring "migrate `TasksTable`
onto the same primitives, unified add dialog, `/list` → `/tasks` rename,
task-under-goal grouping, `goalId` picker" to this stage — see that spec's
`## Out of scope`.

Reading `DreamList.vue`/`GoalList.vue` in full during this stage's
brainstorming surfaced one more thing worth fixing alongside the migration:
both containers duplicate an identical ~50-line block (`pendingToggle`,
`toggleConfirmOpen`, `toggleConfirmTitle`/`Body`/`Actions`, `onToggle`,
`onToggleChoice`) for the Done/Reopen confirm flow, differing only in which
store and which `settings.<entity>` block they read. Adding `TaskList.vue`
without extracting that first would create a third copy of the same code, so
this stage extracts it as part of the migration rather than after.

## Scope

**In scope:**

- `TasksPage`/`TaskList` (renamed from `TodoListPage`/`TasksTable`), folder
  renamed to `src/pages/TasksPage/` to match `DreamsPage`/`GoalsPage`,
  rebuilt on `EntityList` instead of `v-data-table`.
- Active/History tabs on the tasks page, matching Dreams/Goals (the existing
  "History tab arrives in stage 5" code comment is superseded — it arrives
  now).
- Tasks grouped under their Goal (flat tail for goal-less tasks), via a new
  `groupedByGoal` getter on the tasks store mirroring `groupedByDream` on the
  goals store.
- `useToggleConfirm`, a composable extracting the duplicated Done/Reopen
  confirm logic out of `DreamList.vue`/`GoalList.vue`, consumed by both plus
  the new `TaskList.vue`.
- `TaskDialog.vue` (replacing `TaskForm.vue`): wraps `EntityDialog` the same
  way `DreamDialog`/`GoalDialog` do (pencil/checkmark, "Cancel this record"),
  adds a `goalId` picker mirroring `GoalDialog`'s Dream picker.
- `MatrixBoard.vue`, which opens `TaskForm` directly (independent of
  `QuickAddFab`) when a quadrant's "+" is clicked, pre-filling
  `important`/`urgent` via `quadrantFlags(quadrant)` — switches to
  `TaskDialog` in `mode="add"` alongside the `TaskForm` → `TaskDialog`
  migration, since it's a second, separate consumer of the component being
  replaced.
- `AddEntityDialog.vue`: one dialog frame with a Dream/Goal/Task tab strip,
  replacing `QuickAddFab`'s current per-route `v-if`/`else-if`/`else` chain
  of three separate dialogs. Tab defaults to match the current route, same
  as today's dialog choice; the user can switch tabs.
- `goalId` picker on the Task tab of `AddEntityDialog` and on `TaskDialog`.
- `/list` → `/tasks` route rename (path, name, `meta.startPage.labelKey`,
  `BottomNav` label/highlight, i18n keys, test route stubs).
- `important`/`urgent` remain visible only in the Matrix page and in a
  task's own detail dialog — not added to `EntityListItem`/`EntityList` in
  this stage.

**Explicitly out of scope** (deferred to later stages):

- Any change to `EntityListItem`/`EntityListGroup`/`EntityList`/
  `EntityDialog`/`ConfirmDialog`'s own props/slots — the primitives built in
  stage 3 already cover everything this stage needs.
- Deadline UI, recurrence UI (`Task.schedule`), completion history UI
  (`Task.completions`) — stage 5+, per the umbrella spec's ordering.
- Cascading cancel for tasks: tasks are leaves (no descendants), so
  cancelling one is a direct `close(id, Status.Cancelled)` with no count and
  no `ConfirmDialog` — the same as today's behavior, just moved from a table
  row icon into `TaskDialog`'s "Cancel this record" action.

## Components

- **`useToggleConfirm<T extends EntityBase>(store, settingsEntity, tab)`** —
  a composable, not a component. Takes a minimal structural type
  (`{ records: T[]; close(id, status): Promise<void>; reopen(id): Promise<void> }`,
  satisfied by any entity store as-is), a `SettingsEntity` key
  (`'dreams' | 'goals' | 'tasks'`), and the container's own `tab` ref, and
  returns `{ toggleConfirmOpen, toggleConfirmTitle, toggleConfirmBody,
  toggleConfirmActions, onToggle, onToggleChoice }`. Internally identical to
  the block it replaces: `onToggle` derives `markingDone` from
  `tab.value === 'active'` (the History-tab fix from commit `941ccc5`),
  looks up `needsConfirm` from `settings[settingsEntity]`, and either applies
  immediately or opens the confirm dialog. Modeled on the existing
  `useCascadeCancel` composable's shape and doc-comment style.
- **`TaskDialog.vue`** — wraps `EntityDialog`, mirroring `GoalDialog.vue`.
  Editing view: `name`, `note`, `important`/`urgent` switches, a `goalId`
  `v-select` fed by a `goalOptions` prop (`Array<{ value, title }>`) the
  container builds, exactly like `GoalDialog`'s `dreamOptions`. A closed goal
  the task already points at stays selectable even though it's not offered
  as a new choice (same rule as `GoalDialog`'s Dream picker). Read-only view:
  resolved goal name, plus `important`/`urgent` shown as chips (only when
  true). Empty selection encodes as `''` in the UI, `undefined` on save.
- **`AddEntityDialog.vue`** — a new, self-contained dialog (not built on
  `EntityDialog`, which is shaped for view/edit-toggle + cancel-record, not
  a tab strip). One `v-dialog`/`v-card`, `v-tabs` (Dream/Goal/Task) at the
  top, one field area that swaps per active tab, one Save action.
  - Props: `defaultTab: 'dream' | 'goal' | 'task'`, `dreamOptions`,
    `goalOptions` (both `Array<{ value, title }>`, built by the caller).
  - Emits: `save-dream: [DreamDraft]`, `save-goal: [GoalDraft]`,
    `save-task: [TaskDraft]` — one per tab, so `QuickAddFab`'s existing three
    handlers (`handleDreamSave`/`handleGoalSave`/`handleTaskSubmit`) barely
    change.
  - Each tab keeps its own local field refs, so switching tabs doesn't
    discard partially-typed input in another tab.
  - Field markup (name/note, +`dreamId` for Goal, +`important`/`urgent`/
    `goalId` for Task) is written per-tab rather than factored into a shared
    fragment — the duplication is the same couple of fields
    `DreamDialog`/`GoalDialog` already duplicate today; not worth a new
    abstraction for two text fields.
- **`TaskList.vue`** (renamed from `TasksTable.vue`) — mirrors
  `GoalList.vue`: `v-btn-toggle` for Active/History, `EntityList` fed by
  `tasks.groupedByGoal.active`/`.closed`, `labelFor(goalId)` resolving the
  goal's name from `useGoalsStore()` at the container level (the tasks store
  itself never imports the goals store — same reasoning as
  `groupedByDream`), `showNote` from `settings.tasks.rows === 2`, toggle
  handling via `useToggleConfirm(tasks, 'tasks', tab)`. `onCancel` (from
  `TaskDialog`'s "Cancel this record") calls `tasks.close(id,
  Status.Cancelled)` directly — no cascade dialog, tasks have no children.

## Routing & navigation

`router/index.ts`: the `/list` route's `path` and `name` become `/tasks` /
`tasks`; `meta.startPage.labelKey` becomes `settings.startPageTasks`;
`readStoredStartPage()`'s hardcoded fallback (`options[0]?.value ?? 'list'`)
becomes `'tasks'`. `getStartPageOptions()` itself needs no change — it
already derives its list from `routes` at runtime, keyed by name.

`BottomNav.vue`: the nav target's `:to`, its active-route highlight check,
and its label (`t('nav.list')` → `t('nav.tasks')`) all move to `tasks`. No
other route in `BottomNav` changes.

`src/pages/TodoListPage/` is renamed to `src/pages/TasksPage/`
(`TasksPage.vue`, `containers/TaskList.vue`), matching the
`DreamsPage`/`GoalsPage` folder convention set in stage 3.

`QuickAddFab.vue` drops its `v-if="route.name === 'dreams'"` /
`v-else-if="route.name === 'goals'"` / `v-else` chain of three dialogs in
favor of one `<add-entity-dialog>`, with `defaultTab` computed the same way
the current dialog choice is (`dreams` → `'dream'`, `goals` → `'goal'`,
everything else → `'task'`). It gains a `goalOptions` computed
(`goalsStore.active` mapped to `{ value, title }`), mirroring its existing
`dreamOptions`.

## Data & grouping

`stores/tasks.ts` gains a `groupedByGoal` getter, mirroring `groupedByDream`
on `stores/goals.ts` field-for-field: a `GoalGroup { goalId: string; items:
Task[] }`, a `GroupedTasks { groups: GoalGroup[]; ungrouped: Task[] }`, a
`groupByGoal()` function bucketing by `goalId` (goalless tasks go to
`ungrouped`), and a `groupedByGoal: computed<{ active: GroupedTasks; closed:
GroupedTasks }>` added to the store's `storeToRefs`-composed return value
alongside the existing `quadrants`. Same rule as goals-under-dream: the
group label is the Goal's name regardless of the Goal's own status, resolved
by the container, not the store.

## Cascading cancel

Not applicable to tasks — they're the leaf entity, with no descendants to
count or cascade into. `TaskDialog`'s "Cancel this record" action (the same
`EntityDialog` mechanism `DreamDialog`/`GoalDialog` already use) calls
straight through to `tasks.close(id, Status.Cancelled)` in `TaskList.vue`,
with no `ConfirmDialog` — this matches today's behavior (the existing row
icon cancels instantly), just relocated from a table-row icon into the
dialog for consistency with Dream/Goal. Cancelling a Goal already
cascade-cancels its active Tasks (`useCascadeCancel.cancelGoalTasks`, built
in stage 3) — unchanged by this stage.

## Forms

`TaskDialog` follows `GoalDialog`'s exact pattern for its `goalId` picker:
active goals only as new choices, plus the task's current goal preserved as
a selectable option even if that goal has since closed; `''` in the UI maps
to `undefined` in the saved draft. `important`/`urgent` stay simple
`v-switch` toggles in the editing view (unchanged from `TaskForm` today);
the read-only view renders them as `v-chip`s, shown only when `true` (an
unset flag renders nothing, not a "false" chip). `schedule` remains
untouched by this stage — no field for it anywhere yet.

`AddEntityDialog`'s Task tab reuses the same field set and the same
`goalOptions` prop shape as `TaskDialog`, but does not need the
"currently-assigned closed goal" carve-out, since there is no existing
record being edited when adding.

`MatrixBoard.vue` gets its own `goalOptions` computed (`useGoalsStore().active`
mapped to `{ value, title }`, the same shape everywhere else) and switches
its `<task-form>` for `<task-dialog mode="add" :initial :goal-options
@save="store.add($event)">`. `initial` keeps being set from
`quadrantFlags(quadrant)` on the "+" click — unchanged. The `@submit` event
`TaskForm` used becomes `@save`, matching `EntityDialog`'s emit name.
One behavior change falls out of reusing `EntityDialog`'s chrome instead of
`TaskForm`'s own: the explicit "Cancel" button in `TaskForm`'s
`v-card-actions` disappears, since `EntityDialog` shows its bottom action
row only in `mode="edit"`. This matches how `DreamDialog`/`GoalDialog`
already behave when `QuickAddFab` opens them in `mode="add"` today — an
add-mode dialog is dismissed via the backdrop/Escape, not a button — so it's
parity with the existing pattern, not a one-off regression for tasks.

## Edge cases

- Reopening a task from the History tab, or marking one Done from Active,
  goes through `useToggleConfirm` exactly like Dream/Goal — gated on
  `settings.tasks.confirmDone`/`confirmReopen`, with the same History-tab
  `markingDone` derivation that `941ccc5` fixed for Dream/Goal.
- A task with no `goalId` renders in `TaskList`'s ungrouped tail, same as a
  goal with no `dreamId` today.
- Switching `AddEntityDialog`'s tab after typing into one tab's fields does
  not clear that tab's input — each tab's refs are independent, so the user
  can freely explore tabs while filling the form.

## i18n

New/renamed keys, all three locale files (`en.json`, `ru.json`, `pl.json`):

- `nav.tasks` (replaces `nav.list`)
- `settings.startPageTasks` (replaces `settings.startPageList`)
- `task.empty` (replaces `list.empty`, matching `dream.empty`/`goal.empty`)
- `task.title` (matching `dream.title`/`goal.title`, used as `TaskDialog`'s
  `EntityDialog` title)
- `task.goalLabel`, `task.noGoal` (matching `goal.dreamLabel`/`goal.noDream`)

`task.name`/`task.note`/`task.important`/`task.urgent` already exist and are
reused as-is. `form.edit`/`form.add`, previously used as `TaskForm`'s ad hoc
dialog title, are no longer needed for that purpose once `TaskDialog` uses
`entity.edit`/`t('task.title')` like the other two dialogs — no other caller
of those two keys is affected.

## Verification

No manual QA in this stage either, per the same standing preference as
stage 3 — deferred to the end of stage 6 as a whole.

1. Unit tests for `useToggleConfirm`: immediate apply when the relevant
   `confirmDone`/`confirmReopen` setting is off, confirm-then-apply when on,
   the History-tab `markingDone` derivation, cancelling the confirm leaves
   status untouched.
2. Unit tests for `groupedByGoal` (tasks store): goalless tasks land in the
   tail, multiple tasks under one goal group correctly, a task under a
   closed goal still groups and shows the goal's name, active/closed split
   independently.
3. Component tests for `TaskDialog`: `goalId` picker offers only active
   goals as new choices, preserves an existing closed-goal assignment,
   empty selection saves as `undefined`, important/urgent switches round-trip,
   "Cancel this record" closes the task directly with no confirm dialog.
4. Component tests for `AddEntityDialog`: default tab matches the route
   passed in, each `save-*` event carries the right draft shape, switching
   tabs preserves each tab's in-progress fields, name validation is
   per-tab.
5. Component tests for `TaskList`: Active/History tab switching, grouping
   under a goal vs. ungrouped tail, Done/Reopen confirm flow (via
   `useToggleConfirm`), cancel-from-dialog closes immediately.
6. `DreamList.test.ts`/`GoalList.test.ts` updated only insofar as they now
   exercise `useToggleConfirm` instead of inline logic — behavior itself is
   unchanged, so existing assertions should still pass unmodified.
7. `BottomNav.test.ts`/`QuickAddFab.test.ts` updated for the `tasks` route
   name/path and the new `AddEntityDialog` (tab defaults per route, three
   `save-*` handlers).
8. `TaskForm.test.ts` is retired in favor of `TaskDialog.test.ts` (item 3).
   `MatrixBoard.test.ts` updated for `TaskDialog`'s `@save` event and the new
   `goalOptions` prop — the quadrant-click-prefills-flags behavior itself is
   unchanged and should still assert the same `initial` values.

## Out of scope

Deadline UI, recurrence UI, completion history UI (stage 5+); any new prop/
slot on the stage-3 shared primitives; showing `important`/`urgent` inline
in list view (stays Matrix- and detail-dialog-only); cascading cancel for
tasks (not applicable — tasks have no descendants).
