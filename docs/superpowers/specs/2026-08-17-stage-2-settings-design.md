# Design: settings (stage 6, stage 2)

Date: 2026-08-17

## Context

This is stage 2 of stage 6's eight sub-stages (see `docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md`, "Settings"). Stages 1a/1b built the dream/goal/task data layer and cut the UI over to it. Settings is next, ahead of the dream and goal pages, because those pages will read the per-entity list preferences (`rows`, `confirmDone`, `confirmReopen`) this stage introduces.

Today, settings are three unrelated facts scattered across the app:

- theme lives in `localStorage['todo.theme']`, read/written by `src/plugins/vuetify.ts`;
- locale lives in `localStorage['todo.locale']`, read/written by `src/i18n/index.ts`;
- start page lives in `localStorage['todo.startPage']`, read/written by `src/router/index.ts`.

And one setting the design already calls for does not exist as a setting at all: `cleanupDays` is a `ref(DEFAULT_CLEANUP_DAYS)` created independently inside every one of the three `createEntityStore` instances (`src/stores/createEntityStore.ts:66`) — never persisted, never exposed for editing, and only accidentally consistent across `dreams`/`goals`/`tasks` because all three start from the same constant and nothing ever changes any of them.

The three per-entity blocks (`dreams`/`goals`/`tasks` → `rows`/`confirmDone`/`confirmReopen`) have no code today; their consumers (the dream/goal pages, the reworked task page) arrive in stages 3–5.

`SyncConnection.ts` already carries a `kind` discriminator on its payload with a comment naming this: "a later stage adds a `'settings'` variant alongside it."

## Data model and validation

```ts
// src/types/settings.ts
export type AppTheme = 'light' | 'dark' | 'system';

export interface PageSettings {
	rows: 1 | 2;
	confirmDone: boolean;
	confirmReopen: boolean;
}

export interface AppSettings {
	general: { theme: AppTheme; locale: string; startPage: string; cleanupDays: 30 | 60 | 90 };
	dreams: PageSettings;
	goals: PageSettings;
	tasks: PageSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
	general: { theme: 'system', locale: 'en', startPage: 'list', cleanupDays: 30 },
	dreams: { rows: 1, confirmDone: false, confirmReopen: false },
	goals: { rows: 1, confirmDone: false, confirmReopen: false },
	tasks: { rows: 1, confirmDone: false, confirmReopen: false },
};

export class SettingsFormatError extends Error {}
export function parseSettings(value: unknown): AppSettings; // throws SettingsFormatError
```

`AppTheme` moves here from `plugins/vuetify.ts`, which will import it from `@/types` instead of declaring it — it is a stored field now, so it belongs with the rest of the shape validation, matching how `parseDream`/`parseGoal`/`parseTask` already live next to their types rather than in the modules that consume them.

`locale` and `startPage` stay plain `string`, not `AppLocale` (`src/i18n`) or `StartPage` (`src/router`). `types/` is the dependency chain's terminal node — nothing in it may import from `i18n` or `router` — so `parseSettings` only checks that these are non-empty strings. Validity against the *current* set of supported locales or registered routes is exactly what `i18n/index.ts` and `router/index.ts` already check today (`isSupported`, `getStartPageOptions().some(...)`), and they keep doing it, just against a different storage source.

`DEFAULT_SETTINGS.general.startPage: 'list'` matches the current first `meta.startPage`-tagged route; it is a static fallback, not derived, because `types/settings.ts` cannot see the route table.

## SettingsService

```ts
// src/services/settings/SettingsService.ts
export class SettingsService {
	/** Null only when no settings have ever been saved on this device. */
	loadRaw(): AppSettings | null;
	/** loadRaw() with DEFAULT_SETTINGS substituted for null or a parse failure. */
	load(): AppSettings;
	save(settings: AppSettings): void;
}
export const settingsService = new SettingsService();
```

Knows nothing about Vue, per the existing `services/` rule. Reads/writes one `localStorage['todo.settings']` JSON document. A parse failure (corrupt JSON, a shape `parseSettings` rejects) is treated the same as "nothing stored" for `load()` — full fallback to `DEFAULT_SETTINGS`, no partial repair, matching how `readStoredTheme()` and `resolveTheme()` already fail toward a safe default today rather than trying to salvage a broken value.

**Why two methods.** `i18n/index.ts`'s locale detection needs to tell "nothing has ever been saved here" apart from "a value was saved, and it happens to be `'en'`" — only the first case should fall through to scanning `navigator.languages`. Collapsing that distinction would mean a device's very first run reads `DEFAULT_SETTINGS.general.locale = 'en'` from `load()`, sees that `'en'` is a supported locale, and stops — the user's actual OS language preference would never be consulted, breaking today's auto-detect-on-first-run behavior. `loadRaw()` preserves the distinction; `load()` is what every other caller wants, since `theme: 'system'` and the other defaults need no such detection dance.

**Why the service runs before Pinia exists.** `plugins/vuetify.ts` and `src/i18n/index.ts` resolve their startup values (`defaultTheme`, `initialLocale`) at module-evaluation time — before `src/index.ts` even calls `createPinia()`, since imports execute before the code that follows them. Both call `settingsService.load()`/`loadRaw()` directly rather than `useSettingsStore()`, exactly as they read `localStorage` directly today. `router/index.ts`'s `readStoredStartPage()`/`persistStartPage()` do the same, for consistency with the other two and because `router/` does not otherwise depend on a Pinia store.

## Pinia store

```ts
// src/stores/settings.ts
useSettingsStore(): {
	general: { theme; locale; startPage; cleanupDays };  // reactive
	dreams: PageSettings; goals: PageSettings; tasks: PageSettings;  // reactive
	setTheme(theme: AppTheme): void;
	setLocale(locale: string): void;
	setStartPage(startPage: string): void;
	setCleanupDays(days: 30 | 60 | 90): void;
	updatePageSettings(entity: 'dreams' | 'goals' | 'tasks', patch: Partial<PageSettings>): void;
	replaceAll(settings: AppSettings): void;  // backup restore, sync accept
}
```

Built with `reactive(settingsService.load())` + `toRefs()` (the pattern Pinia setup stores use to return live refs), not a plain object spread — Task 6's ledger already found that a naive spread freezes reactivity in this codebase. Every mutating action ends by calling `settingsService.save(...)`; unlike the entity stores' writes to IndexedDB, this needs no `toStorable()`/`toRaw()` — `JSON.stringify` reads a reactive proxy's properties the same as a plain object, and `structuredClone`'s Proxy rejection is specific to `IndexedDB.put`, not `localStorage`. This is the one write path in the app where that trap does not apply.

This is the layer every component uses: `SettingsPage`, `ThemeMenu`, `LocaleMenu`, and — for `cleanupDays` — `createEntityStore`.

## `cleanupDays` becomes a real setting

`createEntityStore`'s `setup()` drops its own `const cleanupDays = ref(DEFAULT_CLEANUP_DAYS)` and instead reads `useSettingsStore().general.cleanupDays` wherever it currently reads the local ref (`load()`'s `collectGarbage`/`prune` calls). The store no longer exposes a `cleanupDays` field of its own — there is exactly one now, on the settings store — so `SyncFlow.vue`'s `sweep()` switches from `tasks.cleanupDays` to `useSettingsStore().general.cleanupDays`. This removes the previously-accidental "the three stores happen to agree" property in favor of there being only one value to agree with.

## No migration

`todo.theme`, `todo.locale` and `todo.startPage` stop being read or written anywhere; their read/write helpers are deleted along with the keys. Per the earlier decision: this app has no deployed users yet, so a device that already has those three keys set simply starts over at `DEFAULT_SETTINGS` and the user re-picks theme/language/start page once. A migration would be real code kept forever to smooth over a transition that, on inspection, nobody needs smoothed.

## UI

`ThemeMenu.vue` and `LocaleMenu.vue` stay exactly where they are, in the app bar — per the decision above, settings that already have a fast, discoverable one-tap UI don't move just because their storage moved underneath them. Both switch their internal state from a locally-read/persisted value to `useSettingsStore()`: `ThemeMenu`'s `preference` ref and `persistTheme()` call are replaced by reading `settings.general.theme` and calling `settings.setTheme(value)`; same shape for `LocaleMenu` and `setLocale`. The imperative side effects that only a component can perform — `theme.change(resolveTheme(value))` via Vuetify's `useTheme()`, and keeping Vuetify's own locale in step — stay in these components, unchanged in spirit.

`SettingsPage.vue` keeps its existing start-page selector (now backed by the settings store instead of `router`'s own storage functions) and adds:

- a `cleanupDays` select — 30/60/90, mirroring the start-page select's shape;
- three identical sections, one each for Dreams/Goals/Tasks: a rows toggle (1/2) and two switches, `confirmDone`/`confirmReopen`, all bound to `settings.updatePageSettings(entity, patch)`.

These three sections have no reader yet — the dream/goal pages and the reworked task page arrive in stages 3–5 — which matches the source spec's own page ordering (Settings before Dreams/Goals/Tasks).

## Backup

```ts
interface Backup {
	version: 3;
	exportedAt: string;
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
	settings?: AppSettings;
}
```

`BackupService.create()` always includes the caller's current settings; `BackupService.parse()` validates them through `parseSettings` when the field is present (wrapping `SettingsFormatError` in `BackupFormatError`, the same pattern `readAll()` already uses for `EntityFormatError`), and leaves the field `undefined` when absent — an older export or a hand-edited file without it. `BackupFormatError`'s existing per-record addressing (`"tasks[3] is invalid: ..."`) extends to `"settings is invalid: ..."`.

`BackupActions.vue`'s import flow already frames itself as "replace everything" (`backup.confirmTitle` = "Replace everything?"). Settings ride along on the same confirmation: if `pending.value.settings` is present, `confirmImport()` calls `settings.replaceAll(backup.settings)` alongside the three `replaceAll` calls it already makes. No settings field in the file means no change to local settings. `incomingCount`/`currentCount` stay record-counts only — settings are not counted, since there is exactly one document, not a collection.

`BACKUP_VERSION` stays 3: `settings` is an optional addition, not a breaking shape change, so no version bump.

## Sync

```ts
export type SyncPayload = SyncDataPayload | SyncSettingsPayload;

export interface SyncSettingsPayload {
	schema: number;
	kind: 'settings';
	settings: AppSettings;
}
```

`SyncConnection.exchange()` widens from `SyncDataPayload` to `SyncPayload`, and its message-handler validation branches on `parsed.kind`: the existing `dreams`/`goals`/`tasks` array + per-record parse checks for `'data'`, a `parseSettings` check for `'settings'`.

`SyncPage.vue` gains a Data/Settings toggle shown before pairing starts (a `v-btn-toggle` above the existing "start here"/"join here" buttons), passed down to `SyncFlow.vue` as a prop that decides which `kind` it sends.

Settings sync is deliberately **not** a merge. Unlike `dreams`/`goals`/`tasks`, there is no last-write-wins rule and no `updated` timestamp to compare — `AppSettings` carries no `EntityBase` fields at all. Per the source spec: both sides send their document, and each independently sees a "replace local settings with the received ones?" confirmation and decides. Accepting calls `settings.replaceAll(theirs)`; declining leaves the local document untouched. The flow is symmetric on purpose — neither device needs to know whether it is the initiator or the responder to decide whether it wants the other side's settings.

## i18n

New keys needed under `settings.*` for: the cleanup-days section label and its three options, the three per-entity section headers (Dreams/Goals/Tasks — likely reusable across the nav labels already present), the rows toggle's two options, and the confirm-done/confirm-reopen switch labels. Under `sync.*`: the Data/Settings toggle labels and the settings-replace confirmation dialog's title/body/accept/decline strings. All three locale files (`en.json`, `ru.json`, `pl.json`) gain the same keys, per the existing rule.

## Verification

1. Unit tests for `parseSettings`: every field individually wrong-typed or missing, `cleanupDays` outside `{30, 60, 90}`, `rows` outside `{1, 2}`, an empty object, a non-object.
2. Unit tests for `SettingsService`: `loadRaw()` returns `null` on a genuinely empty key and on corrupt JSON alike being distinguished correctly from a validly-stored value; `load()` falls back to `DEFAULT_SETTINGS` in both the missing and the corrupt case; `save()` round-trips through `load()`.
3. Unit tests for `stores/settings.ts`: every setter persists (spy on `settingsService.save`), `replaceAll` overwrites all four sections at once, reactivity survives the `reactive()`/`toRefs()` composition (the same regression class Task 6 guarded — a scalar and a nested object both still update a computed/watch after a mutation).
4. `ThemeMenu.test.ts`/`LocaleMenu.test.ts`/`detectLocale.test.ts` need a Pinia instance added to their mount's `global.plugins` (they currently mount without one) and their direct `localStorage.setItem('todo.theme', ...)`/`'todo.locale'` seeding switched to seeding `localStorage['todo.settings']` (or calling `settingsService.save()`) — both break the moment these components read through the settings store instead of their own keys.
5. `createEntityStore.test.ts`/`tasks.test.ts`: whatever exercises `cleanupDays` today needs a settings store present in the test's Pinia instance instead of relying on the entity store's own field, which no longer exists.
6. `BackupService.test.ts`: round-trip with and without `settings` present; a corrupt `settings` block rejects the whole backup with an addressed error, matching the existing per-collection behavior.
7. `SyncConnection.test.ts`/`SyncFlow.test.ts`: a `'settings'`-kind payload is sent, received and validated the same way `'data'` is today; a mismatched `kind` on either side is rejected clearly.
8. In a real browser (Edge): change theme/language/start page, reload, confirm they survive; open Settings, change `cleanupDays` and a per-entity toggle, reload, confirm they survive; export a backup, wipe `localStorage`, import it back, confirm settings return with it.

## Out of scope

Reading or migrating the old `todo.theme`/`todo.locale`/`todo.startPage` keys — a deliberate decision, not an oversight (see "No migration" above). Any UI for the dream/goal/task pages that will eventually *read* `rows`/`confirmDone`/`confirmReopen` — those pages do not exist yet and arrive in stages 3–5. Negotiating or merging settings between two devices — sync replaces wholesale or not at all, per device, per the source spec.
