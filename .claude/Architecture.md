# Architecture

The detailed reference for how this repository is organized. CLAUDE.md keeps only a summary and links here; this file is the one to update when the structure changes.

## Root

| Path | What it is |
| --- | --- |
| `.claude/` | Claude Code config: `CLAUDE.md` (working notes) and this file |
| `dist/` | Build output, git-ignored |
| `docs/` | `docs/superpowers/specs/` and `docs/superpowers/plans/` — design intent and step-by-step plans, see CLAUDE.md's "Process" section |
| `node_modules/` | Installed dependencies |
| `public/` | Static assets copied verbatim into the build (PWA icons, favicon) |
| `src/` | Application source — see below |
| `index.html` | Vite's HTML entry point, loads `/src/index.ts` |
| `package.json`, `package-lock.json` | npm manifest and lockfile |
| `tsconfig.json` | TypeScript config; declares the `@/*` → `./src/*` path alias |
| `vite.config.ts` | Vite config; also the Vitest config (single `test` block) and the PWA plugin config |
| `eslint.config.js` | Flat ESLint config, including the `vue/block-order` rule (style → template → script) |
| `.prettierrc.json`, `.prettierignore` | Formatting config |
| `.gitignore`, `.gitattributes` | git settings (the latter normalizes line endings to LF) |
| `README.md` | Project overview for a human reader: commands, data durability, sync, install, deployment |

## `src/` structure

```
src/
	index.ts                — entry point
	env.d.ts                — ambient types (vite/client, vite-plugin-pwa/client)
	App.vue                 — Vue root; renders the active layout, nothing else

	layouts/                 — page frames (Nuxt-like): app chrome that wraps <router-view>

	pages/                   — one folder per route: [Page]/[Page].vue, optional page-local
	                            presentational files, and a containers/ subfolder for the
	                            page's business logic

	components/              — shared, presentational only: no store, no services
	containers/              — shared, business logic, not tied to one page

	stores/                  — Pinia stores; the only thing that touches repositories directly

	services/                — business logic; one class per file, exported as a singleton
	repositories/            — data access only, implement TodoStorage

	types/                   — shared type definitions, e.g. the shape of a Todo

	i18n/                    — vue-i18n setup and locales (`locales/ru.json` is the one non-English file)
	plugins/                 — Vuetify setup
	router/                  — vue-router setup, one route per page

	composables/             — Vue-tied reusable logic (currently empty — nothing qualifies yet)
	utils/                   — pure, Vue-independent utility functions, one per file (currently empty)
	assets/                  — assets imported into the build, e.g. inline SVGs (currently empty)
```

Empty folders (`composables/`, `utils/`, `assets/`) are kept in git with a `.gitkeep` placeholder. Don't populate them just to have something in them — wait until code actually fits the definition.

Test files (`*.test.ts`) are co-located next to the file they test, for every layer that has tests today (`repositories/`, `services/`). `.vue` files don't have tests yet; when they do, the same co-location convention applies.

## Dependency direction

```
pages → containers / components → stores → services / repositories → types
```

`layouts` and `App.vue` wrap `pages` via the router, outside this chain.

## Components vs. containers

- **`components/`** (shared) and a page's own folder (page-local) hold **presentational** `.vue` files: props and emits only, no store, no service/repository calls.
- **`containers/`** (shared, in `src/containers/`) and **`pages/[Page]/containers/`** (page-local) hold **business-logic** `.vue` files: anything that reads or writes the store, or calls a service/repository.
- A page-local file with no business logic sits directly in the page's folder (e.g. `pages/MatrixPage/TodoQuadrant.vue`), not inside `containers/` — `containers/` is reserved for logic, not for "belongs to this page."

## Pages are thin

`pages/[Page]/[Page].vue` answers one question: *what's on this page?* It composes containers/components and lays them out — it does not itself call the store or a service. All of that lives in the page's `containers/`.

`layouts/` is exempt from this rule: a layout's chrome and its behavior (theme toggle, locale toggle, snackbar state, initial data load) stay together in one file, because there's no natural sub-widget to split it into the way a page's table or board can be split out.

## Services vs. repositories

- **`repositories/`** — data access only. Each backend implements the `TodoStorage` interface (`getAll/put/remove/clear`), so the store can swap `IndexedDbRepository` for `InMemoryRepository` without knowing the difference — this is what keeps store tests free of a real browser.
- **`services/`** — business logic: rules that span or interpret data, not just store it (backup envelope validation, sync merge/pairing). Each concern is one class.
- Neither layer knows about Vue or Pinia — that's what keeps them unit-testable without a browser environment.

## Classes and instantiation

Every `services/` and `repositories/` file exports a class. Most also export a ready-to-use singleton instance (`export const backupService = new BackupService()`), the same pattern the codebase already uses for Pinia stores (`useTodosStore()`). This keeps interface implementation working normally (`implements TodoStorage`, which only applies to instance methods) and leaves room for constructor parameters, which a static-only class couldn't support.

Two documented exceptions:

- **`IndexedDbRepository`** has no module-level singleton. Opening a connection is async, so construction goes through `static async create(): Promise<IndexedDbRepository>` instead of `new` — there's nothing to export until that resolves. The store's `load()` calls it directly.
- **`SyncConnection`** has no singleton either, deliberately: it's stateful per pairing attempt (one peer connection, one data channel), and a fresh `new SyncConnection()` is created every time `SyncFlow.vue` starts or restarts a sync.
- **`InMemoryRepository`** has no singleton for the same reason as `SyncConnection`: it's meant to hold independent, disposable state (a fallback instance, or a seeded instance in tests), not to be shared.

Tests construct their own instances directly (`new InMemoryRepository(seed)`, `new BackupService()`) rather than importing the shared singleton, so test state never leaks between cases.

## Naming

camelCase/PascalCase throughout — `.vue` files and class files (`IndexedDbRepository.ts`) are PascalCase, matching their default export. No kebab-case, unless a filename is mandated by a tool outside this project's control (`package-lock.json`).

Imports inside `src` use the `@/` alias; a file only uses a relative import for a sibling in the same page folder (e.g. `pages/MatrixPage/containers/MatrixBoard.vue` importing `../TodoQuadrant.vue`).
