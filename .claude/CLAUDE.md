# Todo — working notes

A personal todo list with an Eisenhower matrix. No backend: a web client only, everything lives in the browser. Targets desktop and phone (iPhone, Android), installs as a PWA, works offline, and syncs between devices manually over WebRTC via QR codes.

Stack: Vite 8 (Rolldown), Vue 3.5, TypeScript, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4, SCSS modules, `idb`, `flag-icons`.

Every file in the repository is written in English — code, comments, docs, commit messages. The only exception is the localization files under `src/i18n/locales/`. Chat with the user happens in their language, which is Russian.

## Commands

| Command             | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Dev server                            |
| `npm run build`     | `vue-tsc --noEmit` + build to `dist/` |
| `npm run preview`   | Serve the build on `localhost:4173`   |
| `npm test`          | Unit tests, single run                |
| `npm run lint`      | ESLint                                |
| `npm run format`    | Prettier                              |
| `npm run test:e2e`  | Playwright e2e tests                  |

Before calling work finished, run all four: `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`.

## Conventions

Everything is English except `src/i18n/locales/ru.json`.

Formatting lives in [.prettierrc.json](../.prettierrc.json): tabs (`tabWidth: 2`), single quotes, `printWidth: 100`, `trailingComma: all`.

SFC sections go **style → template → script**, enforced by the `vue/block-order` rule in [eslint.config.js](../eslint.config.js). Always `<style lang="scss" module>` and `<script setup lang="ts">`. Reaching into Vuetify internals from a CSS module needs `:deep()` and `:global()`.

Imports inside `src` use the `@/` alias.

## Architecture

Full reference — folder tree, dependency direction, components-vs-containers, services-vs-repositories, naming — lives in [.claude/Architecture.md](Architecture.md). Read it before restructuring anything.

The short version: `pages → containers/components → stores → services/repositories → types`. **`services`/`repositories` know nothing about Vue or Pinia** — that is what keeps their tests free of a browser environment and the storage swappable. `EntityStorage` ([src/repositories/EntityStorage.ts](../src/repositories/EntityStorage.ts)) is the key boundary: `getAll / put / remove / clear`. The store does not know IndexedDB sits underneath; tests substitute `EntityMemoryRepository`.

The Eisenhower matrix is **a view of the same data**, not a separate entity: the tasks store's `quadrants` getter splits its `active` tasks by `important` × `urgent` into `do / schedule / delegate / eliminate`.

## Data model

Three entities — `Dream`, `Goal`, `Task` — share an `EntityBase`: `id`, `name`, `note?`, `created`, `updated`, `status`. Two optional links thread them together, `Goal.dreamId` and `Task.goalId`, and both are genuinely optional — a goal or a task can stand on its own with no parent. `Task` adds `important`, `urgent`, `schedule?`, `completions?`; `Goal` adds `deadline?`.

`Status` is a real enum shared by all three: `Opened | Done | Cancelled`.

Several things are easy to break without knowing them:

- **`updated` moves on every user change** — sync merges on it, and the later version wins — and **never** on garbage collection. A device that moved it on startup would win the next merge for free, just for having started.
- **There is no `deleted` flag.** A closed record (`Done` or `Cancelled`) is its own tombstone. Physical deletion happens only in `collectGarbage`, only once the record is older than the cleanup window, and never from the interface — closing is the only kind of deletion the app offers.
- **`completions` merge per `occurrence`, not as a value.** Whole-record last-write-wins would silently drop a mark made on the other device: two devices out of contact, one marking the 7th and the other the 14th, would otherwise produce two records neither of which holds both.
- **The effective cleanup window is the larger of the two devices'.** Each device purges past its own `cleanupDays` independently; a closed record keeps surviving somewhere in the system until the more generous device also purges it. That needs no negotiation and no code — it falls out of both sides doing the same local thing.

The IndexedDB schema is at version 3: three stores (`dreams`, `goals`, `tasks`) behind one shared connection. Changing a record's shape means raising `APP_DB_VERSION` in [src/repositories/AppDatabase.ts](../src/repositories/AppDatabase.ts) and writing a migration that backfills old records without granting them an undeservedly fresh `updated`.

## Traps already paid for

**Anything new that writes data has to be exercised at least once in a real browser.** Unit tests do not catch this: the in-memory storage silently accepts Vue's reactive proxies while IndexedDB rejects them — structured clone throws. The symptom is data that renders correctly and vanishes on reload. Write only plain copies (`{ ...record }`) to storage.

**Chrome on this machine cannot verify the PWA.** Build 150.0.7871.189 has a broken Cache API: `caches.open(...).put(...)` fails with `InvalidAccessError: Entry already exists` even on a clean profile. Use Edge. The diagnostic snippet is in the [README](../README.md#testing-the-pwa-locally).

**Vuetify's own strings** (pagination, "Items per page") are localized through Vuetify's locale system in [src/plugins/vuetify.ts](../src/plugins/vuetify.ts), not vue-i18n: the adapter would need the runtime message compiler that precompilation removes.

**The service worker precache must contain no duplicates.** A URL listed twice fails the install with `Entry already exists`, and offline mode silently does not work at all. Hence `includeManifestIcons: false` and no `includeAssets` in [vite.config.ts](../vite.config.ts).

**`npm run dev` never has a service worker.** `registerSW()` no-ops under the dev server unless `devOptions.enabled` is set, which this project deliberately does not do — dev mode precaches Vite's unbundled, HMR-versioned module graph rather than anything resembling the production bundle, and only matches `/` in its `navigateFallback`, so it cannot predict real offline behaviour anyway. "Nothing is cached, the page dies when the dev server stops" during `npm run dev` is expected, not a regression. Verify offline behaviour only through `npm run build && npm run preview`.

**The IndexedDB connection must close on `versionchange`**, otherwise a second tab carrying a new schema version hangs.

**Sync only works within one network.** There are deliberately no ICE servers — that would be an internet dependency — so the address in the code is an mDNS `*.local` name. Guest Wi-Fi with client isolation will not pass it.

**Nested reactive values reach storage through the draft.** `toRaw()` unwraps a record but not its fields; a form-bound `schedule` or `deadline` arrives as a proxy, and structured clone rejects it. The store factory's `toStorable()` walks every level, and all three write sites go through it.

**Schedules store wall-clock time, never UTC.** A floating `10:00` must stay 10:00 in another country, and a zone-anchored one must survive its own daylight-saving change; a stored UTC instant breaks both. `created`, `updated` and `Completion.at` stay UTC — they are moments, not appointments.

**Backup files of versions 1 and 2 are refused, not migrated.** They carry a single `todos` list against a model that no longer exists, and a migration would have to invent the dreams and goals that were never written.

## Process

Intent and decisions live in `docs/superpowers/specs/`, step-by-step plans in `docs/superpowers/plans/`. Before changing behaviour, read the matching spec: it records why something was built the way it was.

Stages 1–5 are done and merged into `main`: core, list, matrix, PWA/offline, export-import, sync. Stage 6 — reworking the data model into dreams, goals and tasks — is under way: the data layer and the UI cutover onto it are done (see `docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md`). Dedicated dream and goal pages, deadline and recurrence UI, and completion history are not built yet; today the list and matrix pages just read and write the new `Task` store where they used to read and write `Todo`.

Remote and deployment are deliberately postponed; the user reviews the architecture themselves. Do not add a git remote or deploy without being asked.
