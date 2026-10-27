# Architecture

The detailed reference for how this repository is organized. CLAUDE.md keeps only a summary and links here; this file is the one to update when the structure changes.

## Root

| Path                                  | What it is                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `.claude/`                            | Claude Code config: `CLAUDE.md` (working notes) and this file                                                         |
| `dist/`                               | Build output, git-ignored                                                                                             |
| `docs/`                               | `docs/decisions.md` — durable rationale and conventions from finished build stages, see CLAUDE.md's "Process" section |
| `e2e/`                                | Playwright end-to-end tests, run against a built `npm run preview` server                                             |
| `node_modules/`                       | Installed dependencies                                                                                                |
| `public/`                             | Static assets copied verbatim into the build (PWA icons, favicon)                                                     |
| `src/`                                | Application source — see below                                                                                        |
| `index.html`                          | Vite's HTML entry point, loads `/src/index.ts`                                                                        |
| `package.json`, `package-lock.json`   | npm manifest and lockfile                                                                                             |
| `tsconfig.json`                       | TypeScript config; declares the `@/*` → `./src/*` path alias                                                          |
| `vite.config.ts`                      | Vite config; also the Vitest config (single `test` block) and the PWA plugin config                                   |
| `playwright.config.ts`                | Playwright config: test directory, base URL, and the `webServer` that runs `npm run preview`                          |
| `eslint.config.js`                    | Flat ESLint config, including the `vue/block-order` rule (style → template → script)                                  |
| `.prettierrc.json`, `.prettierignore` | Formatting config                                                                                                     |
| `.gitignore`, `.gitattributes`        | git settings (the latter normalizes line endings to LF)                                                               |
| `README.md`                           | Project overview for a human reader: commands, data durability, sync, install, deployment                             |

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
	                            items.ts holds every item of every type and the views over them
	                            (per-type lists, quadrants, sections by parent); storage.ts is the
	                            separate store for storage-wide state (`persistent`, `lastError`);
	                            announcer.ts holds what the layout's one live region says

	services/                — business logic; one class per file, exported as a singleton
	repositories/            — data access only. Each backend implements ItemStorage:
	                            ItemDbRepository.ts (IndexedDB, the one `items` object store that
	                            AppDatabase.ts defines) and ItemMemoryRepository.ts (in-memory)

	types/                   — the item shapes (ItemBase, Task, Group, Goal, Dream, their drafts,
	                            the Item union in itemUnion.ts) and the runtime code that validates
	                            them at a boundary — the Status and ItemType enums and every parse*
	                            guard — not type declarations alone

	i18n/                    — vue-i18n setup and locales (`locales/ru.json` is the one non-English file)
	plugins/                 — Vuetify setup; theme.ts holds both palettes apart from Vuetify, so
	                            the palette contrast test can read them
	router/                  — vue-router setup, one route per page

	composables/             — Vue-tied reusable logic, e.g. useCascadeCancel.ts (cascading-cancel
	                            counting/execution, shared by the Dreams and Goals page containers)
	                            and useToggleConfirm.ts (Done/Reopen confirm gating, shared by all
	                            three page containers), and useKeepFocus.ts (focus back to a
	                            dialog's trigger, or to the next row when a row leaves a list)
	utils/                   — pure, Vue-independent utility functions, one per file, e.g.
	                            collectGarbage.ts (closed-record and stale-completion pruning),
	                            quadrants.ts, sectionByParent.ts and intl.ts (one shared
	                            Intl.DateTimeFormat per locale and options — use it for any
	                            formatter a list calls per row)
	assets/                  — assets imported into the build, e.g. the self-hosted webfonts under
	                            fonts/
```

Test files (`*.test.ts`) live in a `__tests__/` subfolder next to the file they test — every layer has some today, `.vue` files included (e.g. `src/components/__tests__/TaskDialog.test.ts` next to `src/components/TaskDialog.vue`).

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

- **`repositories/`** — data access only. Each backend implements the `ItemStorage` interface (`getAll/put/remove/clear/replaceAll`), so the store can swap `ItemDbRepository` for `ItemMemoryRepository` without knowing the difference — this is what keeps store tests free of a real browser. `ItemDbRepository` reads and writes every type through the one `items` object store, so the app holds one IndexedDB connection; `replaceAll` runs as a single transaction, so a failed restore or sync leaves the old list in place. `ItemMemoryRepository` is generic over the item type (`ItemMemoryRepository<Item>`, `ItemMemoryRepository<Task>`, …) for tests that only need one. `AppDatabase.ts` defines the schema (`AppDbSchema`, one `upgrade()` callback) in one place.
- **`services/`** — business logic: rules that span or interpret data, not just store it (backup envelope validation, sync merge/pairing). Each concern is one class.
- Neither layer knows about Vue or Pinia — that's what keeps them unit-testable without a browser environment.

## Classes and instantiation

Every `services/` and `repositories/` file exports a class. Most also export a ready-to-use singleton instance (`export const backupService = new BackupService()`), the same pattern the codebase already uses for Pinia stores (`useItemsStore()`). This keeps interface implementation working normally (`implements ItemStorage`, which only applies to instance methods) and leaves room for constructor parameters, which a static-only class couldn't support.

Two documented exceptions:

- **`ItemDbRepository`** has no module-level singleton. Opening a connection is async, so construction goes through `static async create(parse = parseItem): Promise<ItemDbRepository>` instead of `new` — there's nothing to export until that resolves. The items store's `load()` calls it by default; tests pass their own repository to `load()` instead.
- **`SyncConnection`** has no singleton either, deliberately: it's stateful per pairing attempt (one peer connection, one data channel), and a fresh `new SyncConnection()` is created every time `SyncFlow.vue` starts or restarts a sync.
- **`ItemMemoryRepository`** has no singleton for the same reason as `SyncConnection`: it's meant to hold independent, disposable state (a fallback instance, or a seeded instance in tests), not to be shared.

Tests construct their own instances directly (`new ItemMemoryRepository<Item>(seed)`, `new BackupService()`) rather than importing the shared singleton, so test state never leaks between cases. Component and container tests seed the items store through `loadItems(records)` in `src/vitestHelpers.ts`.

## Naming

camelCase/PascalCase throughout — `.vue` files and class files (`ItemDbRepository.ts`) are PascalCase, matching the class/component name. No kebab-case, unless a filename is mandated by a tool outside this project's control (`package-lock.json`).

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
