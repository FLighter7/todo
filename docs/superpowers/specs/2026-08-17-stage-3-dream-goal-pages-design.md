# Design: dream & goal pages (stage 6, stage 3)

Date: 2026-08-17

## Context

Stage 6 reworks the todo app's data model into Dream/Goal/Task. Stage 1
(1a/1b) built the data layer and cut the existing UI over to the new `Task`
store. Stage 2 built Settings — theme/locale/start page/cleanup window plus
per-entity list preferences (`rows`, `confirmDone`, `confirmReopen`) for
`dreams`/`goals`/`tasks` — wired into backup and sync, but with **no reader
yet**: the settings spec explicitly deferred the dream/goal pages that would
read those per-entity blocks to "stages 3–5."

This is stage 3. An investigation of the current codebase confirmed the
umbrella design (`docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md`)
already sketches the target UI in its `## Interface` section — shared
primitives `EntityListItem`/`EntityListGroup`/`EntityList`/`EntityDialog`/
`ConfirmDialog`, routes `/dreams` `/goals` `/tasks` `/matrix`, a single add
button with per-entity tabs, inline grouping (goals under their dream, tasks
under their goal), and a cascading-cancel confirmation — but none of it is
built. Recurrence (`Task.schedule`, RFC 5545-shaped, fully validated) and
deadlines (`Goal.deadline`, a fuzzy season/month/day structure, fully
validated) are complete in the data layer with zero UI surface anywhere, and
`Task.completions` (per-occurrence marks, already merged correctly by
`SyncMerger`) likewise has no producer or consumer in the UI. `Dream` itself
is `EntityBase` with nothing added.

That is more than one stage's worth of work. This stage is scoped
deliberately narrow: **get Dream and Goal onto their own pages, on shared
primitives, with cascading cancel** — and nothing about deadlines, recurrence,
completion history, or migrating the existing Tasks table. Later stages build
on top of what this one ships:

- **Stage 4** (not designed yet): migrate the existing `TasksTable` onto the
  same shared primitives, add the unified add dialog with Dream/Goal/Task
  tabs, rename `/list` → `/tasks`, add task-under-goal grouping and a
  `goalId` picker to the task form.
- **Stage 5+** (not designed yet): deadline UI, recurrence UI, completion
  history — each its own stage, each building on the pages this stage ships.

## Scope

**In scope:**

- `DreamsPage`, `GoalsPage` (thin page → containers, mirroring
  `TodoListPage`'s existing split).
- Shared presentational primitives, sized for what this stage actually
  needs: `EntityListItem`, `EntityListGroup`, `EntityList`, `EntityDialog`,
  `ConfirmDialog`. They will likely need small, additive extensions later
  (a date slot for deadline/schedule) — this stage doesn't build that ahead
  of time.
- Routes `/dreams`, `/goals`, both `meta.startPage`-tagged like the existing
  four routes.
- `BottomNav` moves to its final five-item layout: `Dreams · Goals · [+] ·
Tasks · Matrix` (the existing `list`/`matrix` routes and labels are
  untouched — the `/list` → `/tasks` rename is stage 4's job, so it doesn't
  get tangled with this stage's routing change).
- `QuickAddFab` becomes route-aware: opens a Dream-create dialog on
  `/dreams`, a Goal-create dialog on `/goals`, and keeps opening `TaskForm`
  everywhere else, exactly as today.
- Active/History tabs on both new pages, backed by the existing
  `active`/`closed` store getters.
- Goals grouped under their Dream (flat tail for goal-less goals); Dreams
  page has no grouping (nothing above a Dream).
- Cascading-cancel confirmation for both Dream→Goal and Goal→Task.
- Per-entity settings (`rows`, `confirmDone`, `confirmReopen`) from stage 2
  get their first real reader here.

**Explicitly out of scope** (deferred to later stages):

- Any change to the existing `TasksTable`/`MatrixBoard`/`TaskQuadrant` beyond
  what's needed for cascade-cancel counting (read-only queries into the
  tasks store — no UI changes there).
- `TaskForm` gaining a `goalId` picker — a Goal's task list stays empty in
  this stage's UI, since nothing can create that link from either side yet.
- The unified add dialog with Dream/Goal/Task tabs (stage 4).
- `/list` → `/tasks` rename, "Tasks" label in the nav bar (stage 4).
- Deadline UI (`Goal.deadline`, `resolveDeadline()`), recurrence UI
  (`Task.schedule`), completion history UI (`Task.completions`) — all later
  stages. Neither `DreamDialog` nor `GoalDialog` gets a deadline field in
  this stage.

## Components

Shared primitives are pure presentational components with no store access,
built first, against the interface the umbrella spec already describes:

- `EntityListItem` — checkbox, name, optional note on a second line, an
  optional date slot on the right (left empty by both `DreamsPage` and
  `GoalsPage` in this stage — nothing to put there yet).
- `EntityListGroup` — a `fieldset`/`legend`-style wrapper for a named group.
- `EntityList` — renders groups, then the ungrouped tail, then an empty
  state.
- `EntityDialog` — the popup frame: title, a pencil that toggles to a
  checkmark for read-only ↔ editing, a cancel action, and a slot for
  entity-specific fields. Every record opens read-only; editing starts on
  the pencil.
- `ConfirmDialog` — generic confirm/cancel prompt, parameterized by body
  text and button labels, reused for cascade-cancel, plain confirmDone, and
  plain confirmReopen prompts.

`DreamsPage` and `GoalsPage` are two separate, thin container sets (mirroring
`TodoListPage`'s `page.vue` → `containers/*.vue` split) rather than one
parameterized "EntityPage" for all entity types. Goals need grouping and
Dreams don't, so a single generic page component would have to branch on
entity type internally anyway — two small containers sharing the same
primitives is cleaner than one component with conditional branches.

## Routing & navigation

`router/index.ts` gains `/dreams` (name `dreams`) and `/goals` (name
`goals`), both carrying `meta.startPage: true` like the existing four routes,
so the start-page selector in Settings picks them up with no extra wiring.

`BottomNav.vue` moves from its current `List · [+] · Matrix` to the final
`Dreams · Goals · [+] · Tasks · Matrix` (five nav targets plus the FAB) —
this is a navigation-only change; `list`/`matrix` keep their current route
names and labels. `QuickAddFab.vue` reads the current route: on `/dreams` it
opens a Dream-create `EntityDialog`, on `/goals` a Goal-create one, on every
other route it keeps opening `TaskForm` as it does today. The FAB's position
and click-to-open shape don't change; stage 4 later swaps its target dialog
for the unified tabbed one, defaulting the tab to match the current route —
a small change once it lands, not a rewrite.

## Data & grouping

The `goals` store gains a `groupedByDream` getter, mirroring the existing
precedent set by the `tasks` store's `quadrants` getter (which splits
`active` by important×urgent): it splits `active` (and separately `closed`,
for the History tab) into groups keyed by `dreamId`, plus one ungrouped tail
for goals with no `dreamId`. The group label is the Dream's name, shown
regardless of the Dream's own status — a Goal can outlive its Dream being
marked Done or Cancelled, and hiding the grouping in that case would lose
information for no reason.

## Cascading cancel

Only **Cancel** cascades — not Done, not Reopen. Cancelling a branch is an
active decision to abandon it; marking something Done or reopening it
implies nothing about what should happen to its relatives (reopening a Dream
to add new goals under it shouldn't resurrect old cancelled ones).

Child-counting lives at the container level, not inside the entity stores —
consistent with `dreams`/`goals`/`tasks` staying mutually independent and
unit-testable in isolation today (the same way `DefaultLayout.vue` already
imports all three stores together without the stores themselves knowing
about each other). For a Goal: count of its active Tasks. For a Dream: count
of its active Goals, plus (transitively) the active Tasks under those Goals.

If the record being cancelled has zero active descendants, cancellation
proceeds immediately — no `ConfirmDialog`, nothing to decide. If it has
active descendants, `ConfirmDialog` shows the count(s) and offers two
choices: cancel only this record (descendants keep their current status,
now pointing at a cancelled parent), or cancel the whole branch (the record
and every active descendant become Cancelled). Cancelling a branch is a
pure consequence of the active/closed split already in place — the
now-cancelled records simply move from their page's Active tab to History,
no new mechanism required.

## Forms

`DreamDialog` wraps `EntityDialog` around `name`/`note` only — `Dream` adds
nothing to `EntityBase`. `GoalDialog` wraps the same around `name`/`note`
plus a Dream picker: a `select` listing active Dreams, plus a "no parent"
option. A closed Dream is never offered as a _new_ choice — but if the Goal
being edited already points to one, that Dream stays present as the
currently-selected option so editing doesn't silently clear an existing link
just because its target closed in the meantime; it only drops out of the
list once the user picks something else. No deadline field on either dialog
in this stage.

## Edge cases

- Done and Reopen use the existing plain `ConfirmDialog` gated by
  `settings.{dreams,goals}.confirmDone` / `confirmReopen` — no child
  counting, this isn't a cascade.
- Sync and backup need no new code: `Dream` and `Goal` already flow through
  the generic `EntityBase` pipeline the same way `Task` does (built in
  stages 1a/1b) — this stage only adds UI that reads/writes through the
  existing stores.

## i18n

New keys needed (all three locale files: `en.json`, `ru.json`, `pl.json`):
`nav.dreams`/`nav.goals` labels; `EntityDialog`'s pencil/checkmark/cancel
labels (if not already generic); Active/History tab labels; empty-state text
for `EntityList`; the Dream picker's label and "no parent" option; the
cascade-cancel dialog's body text (singular/plural counts) and its two
action labels ("cancel only this" / "cancel the whole branch").

## Verification

No manual QA in this stage — per the user's stated preference, manual
browser verification for stage 6 as a whole is deferred to the end, once the
full feature set is built; bugs found then get fixed then, on this branch.

1. Unit tests for the `groupedByDream` getter (goals store), against
   `EntityMemoryRepository`: dreamless goals land in the tail, multiple
   goals under one dream group correctly, a goal under a closed dream still
   groups and shows the dream's name.
2. Unit tests for the cascade-count logic: zero descendants (no dialog
   needed), Goal with N active tasks, Dream with N active goals and M active
   tasks transitively, closed descendants excluded from the count.
3. Unit tests for cascade-cancel execution: "this record only" leaves
   descendants' status untouched; "whole branch" cancels every active
   descendant; both leave already-closed descendants alone.
4. Component tests for `EntityList`/`EntityListItem`/`EntityListGroup`/
   `EntityDialog`/`ConfirmDialog` in isolation, following the existing
   pattern (e.g. `SettingsPage.test.ts`): grouped vs. ungrouped rendering,
   empty state, read-only ↔ editing toggle, confirm/cancel callbacks.
5. Component tests for `DreamsPage`/`GoalsPage` containers: add/edit/close/
   cancel/reopen flows, Active/History tab switching, the Dream picker
   offering only active dreams as new choices while preserving an existing
   closed-dream assignment when editing.
6. `BottomNav.test.ts`/`QuickAddFab.test.ts` (or equivalent): FAB opens the
   right dialog per current route; nav highlights the active route among all
   five targets.

## Out of scope

Migrating `TasksTable`/`MatrixBoard` onto the shared primitives; the unified
add dialog with Dream/Goal/Task tabs; `/list` → `/tasks` rename; a `goalId`
picker on `TaskForm`; deadline UI; recurrence UI; completion history UI —
all later stages, per the umbrella spec's own page ordering (Settings before
Dreams/Goals pages before the rest).
