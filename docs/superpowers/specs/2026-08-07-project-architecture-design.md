# Design: project architecture rework

Date: 2026-08-07

## Context

The project had no standalone document describing its folder structure — CLAUDE.md's "Architecture" section was deliberately kept short, as working notes. A detailed, persistent reference was needed for both a human developer and Claude, and the target structure differed enough from what existed (`views/` vs `pages/`, no `layouts/`, no split between presentational and business-logic components, `services/storage` mixing data access with business logic, factory functions instead of classes) that the codebase needed to change to match it, not just gain a new document describing the old one.

The target structure, and every rule below, was worked out interactively with the user rather than proposed unilaterally — each boundary (services vs. repositories, page vs. container, naming, instantiation pattern) was a specific point of back-and-forth, not a default.

## Decisions

**`repositories/` vs `services/`.** `repositories/` is data access only — the `TodoStorage` interface and its two implementations (`IndexedDbRepository`, `InMemoryRepository`), plus `StoragePersistence`, which is about the same storage layer without implementing the interface. `services/` is business logic that spans or interprets data rather than just storing it: backup envelope validation, sync pairing and merge. This wasn't obvious from the original `services/storage|backup|sync` layout, where all three sat at the same level.

**Every `services`/`repositories` file is a class.** The user's own framing was "each service is a clearly bounded class" — read literally, not as a metaphor for "module." Factory functions (`createInMemoryStorage`, `createSyncConnection`, etc.) became classes. Most export a singleton instance, matching the existing `useTodosStore()` pattern, with two deliberate exceptions documented in `.claude/Architecture.md`: `IndexedDbRepository` needs async construction, so it exposes `static create()` instead of a `new`-able singleton; `SyncConnection` and `InMemoryRepository` are intentionally _not_ singletons, since each needs independent, disposable state (one peer connection per pairing attempt; one fallback/test instance at a time).

**Pages are thin, containers hold logic.** `pages/[Page]/[Page].vue` answers "what's on this page" and nothing else; the page's actual logic (store calls, service calls) lives in `pages/[Page]/containers/`. A page-local file with _no_ business logic (e.g. `TodoQuadrant.vue`, `SyncCode.vue`) sits directly in the page's folder rather than in `containers/`, since that folder is defined by "has business logic," not "belongs to this page." `layouts/` is exempt from the thinness rule: there's no natural sub-widget to split a layout's chrome from its behavior the way a page's table or board can be split out, so `DefaultLayout.vue` keeps both together.

**Naming has no kebab-case.** The project already used PascalCase for `.vue` files; the two outliers were `services/storage/in-memory.ts` and `indexed-db.ts`. Both disappeared anyway once converted to classes (`InMemoryRepository.ts`, `IndexedDbRepository.ts`), so the class rewrite and the naming rule reinforce each other rather than conflict.

## Architecture

Full tree and rules: [.claude/Architecture.md](../../../.claude/Architecture.md). Summary of what moved:

```
src/main.ts                         → src/index.ts
src/views/TodoListView.vue          → src/pages/TodoListPage/TodoListPage.vue (thin)
                                     → src/pages/TodoListPage/containers/TodoTable.vue (logic)
src/views/MatrixView.vue            → src/pages/MatrixPage/MatrixPage.vue (thin)
                                     → src/pages/MatrixPage/containers/MatrixBoard.vue (logic)
src/components/TodoQuadrant.vue     → src/pages/MatrixPage/TodoQuadrant.vue (presentational)
src/views/SyncView.vue              → src/pages/SyncPage/SyncPage.vue (thin)
                                     → src/pages/SyncPage/containers/SyncFlow.vue (logic)
src/components/SyncCode.vue         → src/pages/SyncPage/SyncCode.vue (presentational)
src/components/SyncScanner.vue      → src/pages/SyncPage/SyncScanner.vue (presentational)
src/components/TodoForm.vue         → src/components/TodoForm.vue (shared, presentational, unchanged)
src/components/BackupMenu.vue       → src/containers/BackupMenu.vue (shared, business logic)

src/services/storage/*.ts           → src/repositories/*.ts (classes implementing TodoStorage)
src/services/backup/format.ts       → src/services/backup/BackupService.ts (class)
src/services/backup/file.ts         → src/services/backup/BackupFile.ts (class)
src/services/sync/connection.ts     → src/services/sync/SyncConnection.ts (class, per-attempt)
src/services/sync/merge.ts          → src/services/sync/SyncMerger.ts (class)
src/services/sync/signal.ts         → src/services/sync/SyncSignal.ts (class)

App.vue's app-bar/tabs/snackbar     → src/layouts/DefaultLayout.vue
```

`stores/todos.ts`, `types/todo.ts`, `i18n/`, `plugins/`, `router/` kept their content, only their imports changed. `composables/`, `utils/`, `assets/` were created empty (`.gitkeep`), since nothing in the current codebase fits their definitions yet.

## Verification

Automated: `npm test`, `npm run lint`, `npm run build` (the last includes `vue-tsc --noEmit`, which catches stale import paths after this many file moves).

Manual, in a real browser (Edge, per CLAUDE.md's Chrome caveat): add/edit/delete a todo, toggle and add from a matrix quadrant, export/import a backup, run a sync pairing between two tabs. This is not optional — the class rewrite touches every code path that writes to IndexedDB, and reactive-proxy writes are exactly the class of bug CLAUDE.md notes unit tests won't catch.

## Out of scope

Redesigning the test strategy or coverage (tests were relocated and mechanically adapted to the new class APIs, not rethought), extracting `SyncScanner`'s camera handling into a composable, populating `utils/`/`assets/` speculatively, and stage 6 (the data-model rework) — all deferred, none blocking this change.
