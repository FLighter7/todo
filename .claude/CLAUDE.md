# Todo — working notes

A personal todo list with an Eisenhower matrix. No backend: a web client only, everything lives in the browser. Targets desktop and phone (iPhone, Android), installs as a PWA, works offline, and syncs between devices manually over WebRTC via QR codes.

Stack: Vite 8 (Rolldown), Vue 3.5, TypeScript, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4, SCSS modules, `idb`, `flag-icons`.

Every file in the repository is written in English — code, comments, docs, commit messages. The only exception is the localization files under `src/i18n/locales/`. Chat with the user happens in their language, which is Russian.

## Commands

| Command            | What it does                          |
| ------------------ | ------------------------------------- |
| `npm run dev`      | Dev server                            |
| `npm run build`    | `vue-tsc --noEmit` + build to `dist/` |
| `npm run preview`  | Serve the build on `localhost:4173`   |
| `npm test`         | Unit tests, single run                |
| `npm run lint`     | ESLint                                |
| `npm run format`   | Prettier                              |
| `npm run test:e2e` | Playwright e2e tests                  |
| `npm run test:sr`  | NVDA screen reader scenarios          |

Before calling work finished, run all four: `npm test`, `npm run lint`, `npm run build`, and `npm run test:e2e`. Work that changes what a screen reader hears (names, roles, headings, dialogs, announcements) also runs `npm run test:sr`, on Windows only, with the machine left alone: see [docs/accessibility-audit.md](../docs/accessibility-audit.md#rerunning-the-audit).

## Conventions

Everything is English except `src/i18n/locales/ru.json`.

Formatting lives in [.prettierrc.json](../.prettierrc.json): tabs (`tabWidth: 2`), single quotes, `printWidth: 100`, `trailingComma: all`.

SFC sections go **style → template → script**, enforced by the `vue/block-order` rule in [eslint.config.js](../eslint.config.js). Always `<style lang="scss" module>` and `<script setup lang="ts">`. Reaching into Vuetify internals from a CSS module needs `:deep()` and `:global()`.

Imports inside `src` use the `@/` alias.

## Architecture

Full reference — folder tree, dependency direction, components-vs-containers, services-vs-repositories, naming — lives in [.claude/Architecture.md](Architecture.md). Read it before restructuring anything.

The short version: `pages → containers/components → stores → services/repositories → types`. **`services`/`repositories` know nothing about Vue or Pinia** — that is what keeps their tests free of a browser environment and the storage swappable. `ItemStorage` ([src/repositories/ItemStorage.ts](../src/repositories/ItemStorage.ts)) is the key boundary: `getAll / put / remove / clear / replaceAll`. The store does not know IndexedDB sits underneath; tests substitute `ItemMemoryRepository`.

The pages are **views of one collection**: `useItemsStore()` ([src/stores/items.ts](../src/stores/items.ts)) holds every item, and `tasks`, `groups`, `goals`, `dreams` are filters by `type`. The Eisenhower matrix is one more view: the store's `quadrants` getter splits the open tasks by `important` × `urgent` into `do / schedule / delegate / eliminate`.

## Data model

Every record is an **item** in one collection — one array in the store, one IndexedDB object store, one list in a backup or a sync payload — told apart by `type: ItemType`. `ItemType` is a numeric enum, `Task = 1 | Group = 2 | Goal = 3 | Dream = 4`, and it is **append-only**: those numbers are on disk, in backups and on the wire, so a value is never renumbered or reused. All items share an `ItemBase`: `id`, `type`, `name`, `note?`, `created`, `updated`, `status`. `Task` adds `important`, `urgent`, `schedule?`, `completions?`; `Goal` adds `deadline?`; `Dream` and `Group` carry nothing more. A group is deliberately a name only: its dialog offers no note, and its builder sets none. `Item` is the union, tied to its drafts and parsers in [src/types/itemUnion.ts](../src/types/itemUnion.ts).

Links stay explicit fields rather than a generic parent: `Goal.dreamId`, `Task.goalId` and `Task.groupId`, all genuinely optional — a goal or a task can stand on its own with no parent, and a task can sit in a goal and a group at once. The tasks page still sections by goal only; a task's group shows in its own dialog.

`Status` is a real enum shared by every type: `Opened | Done | Cancelled`.

A separate document, `AppSettings`, lives beside the items but is not itself one: `general: {theme, scheme, accent, locale, startPage, cleanupDays, fontScale, pages}` plus per-page `dreams/goals/groups/tasks: {rows, confirmDone, confirmReopen, sortOrder}`. The groups section keeps `rows` for a uniform shape, but the Settings page offers no rows toggle for it, since a group has no note to show on a second row; and `parseSettings` defaults a missing `groups` section, which every document saved before the Groups page lacks. `general.pages` says which of the five pages are shown, and all five may be off: then the bottom bar holds the add button alone, and Tasks is the one page that can still be opened — the start page, which nothing leads away from. A hidden page is gone from the whole interface (bottom bar, start page choices, its address, the add dialog's tab, its picker in other dialogs, its sections on other pages; the task tab goes once neither Tasks nor the matrix is shown), but no record changes: a task keeps the goal it sits in through an edit, and the cascade on cancel still follows the links. `isPageHidden` holds that exception, so the router guard, the start page choices and the add dialog all follow it, while the bottom bar reads the flags themselves. `keepStartPageShown` hands a hidden start page to the first page still shown, in the order Tasks, matrix, Goals, Dreams, Groups, and runs in `parseSettings` for any document and in `setPageVisible`, so the start page is never one the app refuses to show. A missing `pages`, or a missing key in it, shows that page. It persists to `localStorage['todo.settings']` via `SettingsService` (see Traps), not IndexedDB, and is wrapped in `useSettingsStore()`. It rides along in backup/restore (`Backup.settings?`, optional so a backup without one still validates) and in sync, but — unlike the items — sync does not merge it: each side sends its whole document and the receiving side chooses Accept (replace) or Decline (keep), because two devices' preferences have no natural merge. The exceptions are `general.fontScale`, `general.scheme` and `general.accent`: Accept keeps this device's own text size, colour scheme and accent, since what reads well depends on the screen; a backup restore still replaces them.

Several things are easy to break without knowing them:

- **`updated` moves on every user change** — sync merges on it, and the later version wins — and **never** on garbage collection. A device that moved it on startup would win the next merge for free, just for having started.
- **There is no `deleted` flag.** A closed record (`Done` or `Cancelled`) is its own tombstone. Physical deletion happens only in `collectGarbage`, only once the record is older than the cleanup window — closing a record is the only deletion action the interface offers directly. `cleanupDays` (30/60/90, set in Settings) is user-editable, and shortening it does make more records eligible for the next `collectGarbage` sweep — but that sweep only removes records that are already closed and already past the (new, shorter) window, never an open one, never on the spot. That's why shortening it ships with a hint under the selector and deliberately no confirmation dialog: nothing disappears at the moment of the click, only later, and only what closing had already marked for eventual removal.
- **`completions` merge per `occurrence`, not as a value.** Whole-record last-write-wins would silently drop a mark made on the other device: two devices out of contact, one marking the 7th and the other the 14th, would otherwise produce two records neither of which holds both.
- **The effective cleanup window is the larger of the two devices'.** Each device purges past its own `cleanupDays` independently; a closed record keeps surviving somewhere in the system until the more generous device also purges it. That needs no negotiation and no code — it falls out of both sides doing the same local thing.

The IndexedDB schema is at version 4: one object store, `items`, keyed by `id`, with no indexes — the whole collection is read into memory and filtered there. Upgrading to version 4 drops whatever stores an older version left (`todos`, or version 3's `dreams`/`goals`/`tasks`) instead of migrating them. The app opens one `ItemDbRepository`, so one connection; nothing pools or caches it. A new item type needs no schema change at all. Changing a record's shape in a way old rows cannot parse means raising `APP_DB_VERSION` in [src/repositories/AppDatabase.ts](../src/repositories/AppDatabase.ts) and writing a migration that backfills old records without granting them an undeservedly fresh `updated`. `AppSettings` sits outside this schema entirely — it has its own format guard, `parseSettings()`, instead of a version-numbered migration.

## Traps already paid for

**Anything new that writes data has to be exercised at least once in a real browser.** Unit tests do not catch this: the in-memory storage silently accepts Vue's reactive proxies while IndexedDB rejects them — structured clone throws. The symptom is data that renders correctly and vanishes on reload. Write only plain copies (`{ ...record }`) to storage.

**Chrome on this machine cannot verify the PWA.** Build 150.0.7871.189 has a broken Cache API: `caches.open(...).put(...)` fails with `InvalidAccessError: Entry already exists` even on a clean profile. Use Edge. The diagnostic snippet is in the [README](../README.md#testing-the-pwa-locally).

**Vuetify 4 has no MD2 typography classes.** `text-h6`, `text-body-2`, `text-caption`, `text-subtitle-*` match nothing and fail silently; use the MD3 names (`text-title-large`, `text-body-medium`, `text-body-small`, …). Those classes set their own `font-family` from `--v-font-body`/`--v-font-heading`, which [fonts.scss](../src/assets/fonts/fonts.scss) points at Manrope/Alegreya — unset, they fall back to Roboto.

**Vuetify theme names are `${scheme}-${mode}`** (`standard-light`, `contrast-dark`, …), never `light` or `dark`. Vuetify's own `light` and `dark` themes are still registered, unused, so a selector or a `theme` prop aimed at them silently gets Vuetify's default blue palette. Target `[class*='v-theme--']`, or read `theme.current.value.dark`. Every colour drawn comes from the palettes in [src/plugins/theme.ts](../src/plugins/theme.ts), which the contrast test holds to WCAG; a literal colour in a component escapes it.

**Text size scales the root font size, so size new styles in rem.** The setting writes one multiplier to `--app-font-scale` on `<html>`; a px font size will not follow it, and a px box around em-sized content (Vuetify's icons) overflows at 150%. Vuetify's own px exceptions — fields, field messages, counters, checkbox boxes — are patched in [font-scale.scss](../src/assets/styles/font-scale.scss), and fields deliberately never drop below 16px: iOS Safari zooms into any input with smaller text. The bottom bar's labels are the one deliberate exception: five pages and the add button leave a phone no room for them at 150%, so each label stops growing at `22cqi` of its own button, while the icons still scale. Check new screens at 87.5% and 150%.

**Vuetify's own strings** (pagination, "Items per page") are localized through Vuetify's locale system in [src/plugins/vuetify.ts](../src/plugins/vuetify.ts), not vue-i18n: the adapter would need the runtime message compiler that precompilation removes.

**The service worker precache must contain no duplicates.** A URL listed twice fails the install with `Entry already exists`, and offline mode silently does not work at all. Hence `includeManifestIcons: false` and no `includeAssets` in [vite.config.ts](../vite.config.ts).

**`npm run dev` never has a service worker.** `registerSW()` no-ops under the dev server unless `devOptions.enabled` is set, which this project deliberately does not do — dev mode precaches Vite's unbundled, HMR-versioned module graph rather than anything resembling the production bundle, and only matches `/` in its `navigateFallback`, so it cannot predict real offline behaviour anyway. "Nothing is cached, the page dies when the dev server stops" during `npm run dev` is expected, not a regression. Verify offline behaviour only through `npm run build && npm run preview`.

**The IndexedDB connection must close on `versionchange`**, otherwise a second tab carrying a new schema version hangs.

**Sync only works within one network.** There are deliberately no ICE servers — that would be an internet dependency — so the address in the code is an mDNS `*.local` name. Guest Wi-Fi with client isolation will not pass it.

**Nested reactive values reach storage through the draft.** `toRaw()` unwraps a record but not its fields; a form-bound `schedule` or `deadline` arrives as a proxy, and structured clone rejects it. The items store's `toStorable()` walks every level, and every write — `add`, `update`/`close`/`reopen`, `replaceAll` — goes through it, for the in-memory copy as much as for storage. A later write of a plain copy can cover up an earlier one that failed, which is why [e2e/items-persistence.spec.ts](../e2e/items-persistence.spec.ts) checks IndexedDB after each write.

**The store's `records` is a `shallowRef`, replaced on every write and never changed in place.** Pushing into the array or editing a record's field directly reaches neither the screen nor storage. Every change goes through a store action.

**`update()` takes the item type: `update(ItemType.Task, id, patch)`.** `Omit` does not distribute over a union, so a patch typed against `Item` alone would allow only the shared fields, and a draft held in a variable would slip past the excess-property check anyway. The type argument lets the patch be checked against that type's fields. A mismatched type is a no-op, and `id`, `type` and `created` are restored after the patch at runtime. A record's `type` never changes through a patch: a future type change has to rebuild the record with the target type's builder.

**Schedules store wall-clock time, never UTC.** A floating `10:00` must stay 10:00 in another country, and a zone-anchored one must survive its own daylight-saving change; a stored UTC instant breaks both. `created`, `updated` and `Completion.at` stay UTC — they are moments, not appointments.

**Backup files of versions 1–3 are refused, not migrated.** Versions 1 and 2 carry a single `todos` list, version 3 separate `dreams`/`goals`/`tasks` lists whose records have no `type`. Version 4 carries one `items` list, and moving to it deliberately started clean. Sync is at schema 4 for the same reason, and a device on an older build is refused — settings sync included, since both modes share the envelope.

**Ids share one key space across every type.** Two items with the same id collapse into one record in IndexedDB without a word, so `BackupService.parse` refuses a file that repeats one. Keep fixture ids distinct across types in tests.

**Settings persist to `localStorage`, not IndexedDB.** `SettingsService.load()` never returns the shared `DEFAULT_SETTINGS` object directly — it clones it first, so nothing accidentally mutates the default. `loadRaw()` returns `null` for both a missing key and corrupt JSON alike, and that ambiguity is load-bearing: `detectLocale()` calls `loadRaw()`, never `load()`, because first-run OS-locale detection has to see a real `null` to know it's a first run — `load()`'s fallback would mask that behind `DEFAULT_SETTINGS`'s hardcoded `'en'`.

**Settings sync is accept/decline, not merge.** `SyncFlow.vue` closes the WebRTC connection immediately once the settings exchange resolves — before the user has chosen Accept or Decline — because there's nothing left to negotiate over that connection: both sides already hold full copies, and the choice of which one wins is purely local.

**The mock-data content pools must stay out of vue-i18n's precompilation.** `vite.config.ts`'s `vueI18n({ include: [...] })` glob for the locale message catalogs has to stay non-recursive (`./src/i18n/locales/*.json`), never `**` — `src/i18n/locales/mockData/{en,ru,pl}.json` (consumed by `src/services/mockData/pools.ts`) are plain sample-content word pools, not vue-i18n message catalogs, and a recursive glob would silently precompile every pool string into vue-i18n's compiled-message AST format instead of leaving it a plain string, corrupting the mock-data generator's output with no compile-time signal — JSON-import typing doesn't catch it. Separately, the generator's GC-safety (a page reload right after generating must never silently drop what the user just saw, regardless of `cleanupDays`) is enforced by `withinLastDays` in `src/services/mockData/MockDataService.ts` re-validating every emitted timestamp/occurrence/exdate entry against the true `now` at generation time — not by an argument that the recurrence math is naturally bounded, which turned out to be a documentation trap of its own.

**`npm run test:sr` drives the real keyboard.** Guidepup presses Tab, Enter, Escape and Alt+Esc at the OS level for the length of the run, so whatever window has the focus gets them too — an editor or a terminal included, where an Escape interrupts what is running. Start it only with the machine left alone, and never alongside other work in the same session.

## Process

Rationale and durable conventions from finished build stages live in [docs/decisions.md](../docs/decisions.md) — read it before touching sync, recurrence, completions, deadlines, settings, theming, or PWA/offline behaviour, since it records tradeoffs and invariants that aren't obvious from the code alone.

Stages 1–5 are done and merged into `main`: core, list, matrix, PWA/offline, export-import, sync. Stage 6 — reworking the data model into dreams, goals and tasks — is on `main` too; work now happens directly on `main`. The data layer and UI cutover onto it are done, and so is the settings sub-project (theme, locale, start page, cleanup window, per-page list preferences, wired into backup and sync), dedicated dream and goal pages, the tasks page rework (`/tasks` replaces `/list` with Active/History tabs, task-under-goal grouping, a `goalId` picker, and a single tabbed `AddEntityDialog`), deadline UI (`DeadlineField` in `GoalDialog`/`AddEntityDialog`), recurrence UI (`ScheduleField` in `TaskDialog`/`AddEntityDialog`, backed by the `src/utils/schedule.ts` adapter), and completion history (`TaskCompletions` in `TaskDialog`'s read view, backed by the `setOccurrenceDone`/`setOccurrenceSkipped` store actions). On top of that, the three collections were folded into the one `Item` collection described above; the reasoning, the 10 000-record load analysis and the follow-ups it surfaced are in [docs/decisions.md](../docs/decisions.md#single-item-collection). Of those, sync now sends payloads in pieces with no size cap, and parsing, deadline labels and sorting are cached; list virtualization is deliberately deferred. Groups have their page too — `/groups`, between Goals and the add button in the bottom bar — with a `Task.groupId` picker in the task dialogs, the cascade on cancel, and their own tab in Settings; see [docs/decisions.md](../docs/decisions.md#dreamgoalgrouptask-pages--dialogs). Every page can be switched off in Settings, down to the add button alone with Tasks as the one page left; see [docs/decisions.md](../docs/decisions.md#settings). Settings itself is tabbed — General, then one tab per page, each starting with that page's switch. Theming is done too: five colour schemes, each light and dark (high contrast held to AAA among them), and an accent picked from swatches or by hand and fitted into each palette; see [docs/decisions.md](../docs/decisions.md#theming).

The app was audited against WCAG 2.2 AA on 2026-10-27 and the serious findings fixed: the report and its backlog are in [docs/accessibility-audit.md](../docs/accessibility-audit.md), the conventions it settled in [docs/decisions.md](../docs/decisions.md#accessibility).

Deployment is live: the `deploy` job in [.github/workflows/ci.yml](../.github/workflows/ci.yml) publishes `dist/` to GitHub Pages via `actions/deploy-pages` on every push to `main`, after `test` passes. See [README.md#deployment](../README.md#deployment).
