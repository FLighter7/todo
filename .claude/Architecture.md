# Architecture

The detailed reference for how this repository is organized. CLAUDE.md keeps only a summary and links here; this file is the one to update when the structure changes.

## Root

| Path                                  | What it is                                                                                                                        |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/`                            | Claude Code config: `CLAUDE.md` (working notes) and this file                                                                     |
| `dist/`                               | Build output, git-ignored                                                                                                         |
| `docs/`                               | `docs/superpowers/specs/` and `docs/superpowers/plans/` — design intent and step-by-step plans, see CLAUDE.md's "Process" section |
| `e2e/`                                | Playwright end-to-end tests, run against a built `npm run preview` server                                                         |
| `node_modules/`                       | Installed dependencies                                                                                                            |
| `public/`                             | Static assets copied verbatim into the build (PWA icons, favicon)                                                                 |
| `src/`                                | Application source — see below                                                                                                    |
| `index.html`                          | Vite's HTML entry point, loads `/src/index.ts`                                                                                    |
| `package.json`, `package-lock.json`   | npm manifest and lockfile                                                                                                         |
| `tsconfig.json`                       | TypeScript config; declares the `@/*` → `./src/*` path alias                                                                      |
| `vite.config.ts`                      | Vite config; also the Vitest config (single `test` block) and the PWA plugin config                                               |
| `playwright.config.ts`                | Playwright config: test directory, base URL, and the `webServer` that runs `npm run preview`                                      |
| `eslint.config.js`                    | Flat ESLint config, including the `vue/block-order` rule (style → template → script)                                              |
| `.prettierrc.json`, `.prettierignore` | Formatting config                                                                                                                 |
| `.gitignore`, `.gitattributes`        | git settings (the latter normalizes line endings to LF)                                                                           |
| `README.md`                           | Project overview for a human reader: commands, data durability, sync, install, deployment                                         |

## `src/` structure

```
src/
	index.ts                — entry point
	env.d.ts                — ambient types (vite/client, vite-plugin-pwa/client)
	vitest.setup.ts         — Vitest setupFiles entry: stubs ResizeObserver/matchMedia for component tests
	vitestHelpers.ts        — shared helpers for component tests (e.g. clickButtonByText)
	App.vue                 — Vue root; renders the active layout, nothing else

	layouts/                 — page frames (Nuxt-like): app chrome that wraps <router-view>

	pages/                   — one folder per route: [Page]/[Page].vue, optional page-local
	                            presentational files, and a containers/ subfolder for the
	                            page's business logic

	components/              — shared, presentational only: no store, no services
	containers/              — shared, business logic, not tied to one page

	stores/                  — Pinia stores; the only thing that touches repositories directly.
	                            createEntityStore.ts is the shared half every entity store (dreams,
	                            goals, tasks) is built from; storage.ts is the separate store for
	                            storage-wide state (`persistent`, `lastError`) they all report through

	services/                — business logic; one class per file, exported as a singleton
	repositories/            — data access only. Each backend implements EntityStorage:
	                            EntityDbRepository.ts (IndexedDB, a fresh connection per instance
	                            opened against AppDatabase.ts's one shared schema) and
	                            EntityMemoryRepository.ts (in-memory)

	types/                   — the entity shapes (EntityBase, Dream, Goal, Task) and the runtime
	                            code that validates them at a boundary — the Status enum and every
	                            parse* guard — not type declarations alone

	i18n/                    — vue-i18n setup and locales (`locales/ru.json` is the one non-English file)
	plugins/                 — Vuetify setup
	router/                  — vue-router setup, one route per page

	composables/             — Vue-tied reusable logic, e.g. useCascadeCancel.ts (cascading-cancel
	                            counting/execution, shared by the Dreams and Goals page containers)
	utils/                   — pure, Vue-independent utility functions, one per file, e.g.
	                            collectGarbage.ts (closed-record and stale-completion pruning)
	assets/                  — assets imported into the build, e.g. the self-hosted webfonts under
	                            fonts/
```

Test files (`*.test.ts`) are co-located next to the file they test — every layer has some today, `.vue` files included (e.g. `TaskForm.test.ts` next to `TaskForm.vue`).

## Dependency direction

```
pages → containers / components → stores → services / repositories → types
```

`layouts` and `App.vue` wrap `pages` via the router, outside this chain.

## Components vs. containers

- **`components/`** (shared) and a page's own folder (page-local) hold **presentational** `.vue` files: props and emits only, no store, no service/repository calls.
- **`containers/`** (shared, in `src/containers/`) and **`pages/[Page]/containers/`** (page-local) hold **business-logic** `.vue` files: anything that reads or writes the store, or calls a service/repository.
- A page-local file with no business logic sits directly in the page's folder (e.g. `pages/MatrixPage/TaskQuadrant.vue`), not inside `containers/` — `containers/` is reserved for logic, not for "belongs to this page."

## Pages are thin

`pages/[Page]/[Page].vue` answers one question: _what's on this page?_ It composes containers/components and lays them out — it does not itself call the store or a service. All of that lives in the page's `containers/`.

`layouts/` is exempt from this rule: a layout's chrome and its behavior (snackbar state, initial data load) stay together in one file, because there's no natural sub-widget to split it into the way a page's table or board can be split out. Theme and locale switching are the exception: they're self-contained enough to live as their own containers (`ThemeMenu.vue`, `LocaleMenu.vue`), leaving the layout to just render them.

## Services vs. repositories

- **`repositories/`** — data access only. Each backend implements the `EntityStorage` interface (`getAll/put/remove/clear`), so a store can swap `EntityDbRepository` for `EntityMemoryRepository` without knowing the difference — this is what keeps store tests free of a real browser. Both are generic over the entity type (`EntityDbRepository<Dream>`, `EntityMemoryRepository<Task>`, …); `AppDatabase.ts` defines the one shared schema (`AppDbSchema`, one `upgrade()` callback) that every `EntityDbRepository` instance opens its own IndexedDB connection against — three entities mean three separate connections, not one shared connection object — so a schema change happens in one place regardless of which entity is being read.
- **`services/`** — business logic: rules that span or interpret data, not just store it (backup envelope validation, sync merge/pairing). Each concern is one class.
- Neither layer knows about Vue or Pinia — that's what keeps them unit-testable without a browser environment.

## Classes and instantiation

Every `services/` and `repositories/` file exports a class. Most also export a ready-to-use singleton instance (`export const backupService = new BackupService()`), the same pattern the codebase already uses for Pinia stores (`useTasksStore()`). This keeps interface implementation working normally (`implements EntityStorage`, which only applies to instance methods) and leaves room for constructor parameters, which a static-only class couldn't support.

Two documented exceptions:

- **`EntityDbRepository`** has no module-level singleton. Opening a connection is async, so construction goes through `static async create<T>(storeName, parse): Promise<EntityDbRepository<T>>` instead of `new` — there's nothing to export until that resolves, and the result is generic per entity besides. Each entity store supplies its own `createRepository` option instead (e.g. `EntityDbRepository.create('dreams', parseDream)` in `stores/dreams.ts`); the shared `load()` in `createEntityStore.ts` is what calls it.
- **`SyncConnection`** has no singleton either, deliberately: it's stateful per pairing attempt (one peer connection, one data channel), and a fresh `new SyncConnection()` is created every time `SyncFlow.vue` starts or restarts a sync.
- **`EntityMemoryRepository`** has no singleton for the same reason as `SyncConnection`: it's meant to hold independent, disposable state (a fallback instance, or a seeded instance in tests), not to be shared.

Tests construct their own instances directly (`new EntityMemoryRepository<Dream>(seed)`, `new BackupService()`) rather than importing the shared singleton, so test state never leaks between cases.

## Naming

camelCase/PascalCase throughout — `.vue` files and class files (`EntityDbRepository.ts`) are PascalCase, matching the class/component name. No kebab-case, unless a filename is mandated by a tool outside this project's control (`package-lock.json`).

Imports inside `src` use the `@/` alias; a file only uses a relative import for a sibling in the same page folder (e.g. `pages/MatrixPage/containers/MatrixBoard.vue` importing `../TaskQuadrant.vue`).

## Exports and index files

Prefer named exports over default exports wherever possible. The one exception is `.vue` Single File Components: Vue's compiler requires the component to be the file's default export, so that part is out of our control.

Every folder re-exports the files inside it through an `index.ts` barrel, so consumers import from the folder rather than reaching into individual files. For a `.vue` file, the barrel aliases the default export to the component's name:

```ts
export { default as ComponentName } from './ComponentName.vue';
```

For plain `.ts` files, it re-exports their named exports directly:

```ts
export * from './backupService';
```
