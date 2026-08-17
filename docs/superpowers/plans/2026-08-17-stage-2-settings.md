# Stage 6, Stage 2 — Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate theme, locale, start page and a real `cleanupDays` setting into one `AppSettings` document with a Vue-agnostic service and a Pinia store, add per-entity list preferences (`rows`, `confirmDone`, `confirmReopen`) for the dream/goal/task pages that arrive in stages 3–5, and extend backup and sync to carry settings alongside data.

**Architecture:** `src/types/settings.ts` (shape + `parseSettings`) → `src/services/settings/SettingsService.ts` (Vue-agnostic `localStorage['todo.settings']` reader/writer, usable before Pinia exists) → `src/stores/settings.ts` (reactive Pinia store every component uses). `plugins/vuetify.ts`, `i18n/index.ts` and `router/index.ts` read the service directly at module-evaluation time, the same way they read `localStorage` today. `ThemeMenu.vue`, `LocaleMenu.vue` and `SettingsPage.vue` read the Pinia store. `BackupService` and `SyncConnection` both widen to carry an optional/alternate settings payload alongside the existing dream/goal/task collections.

**Tech Stack:** Vite 8 (Rolldown), Vue 3.5, TypeScript, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4 (`happy-dom` per-file via `// @vitest-environment happy-dom` where `localStorage`/DOM is touched), SCSS modules.

**Spec:** [docs/superpowers/specs/2026-08-17-stage-2-settings-design.md](../specs/2026-08-17-stage-2-settings-design.md)

## Global Constraints

- `src/types/` is the dependency chain's terminal node: `types/settings.ts` must not import from `i18n`, `router`, `stores`, or `utils` (the last would create a cycle, since `utils/collectGarbage.ts` already imports from `types`).
- `AppSettings.general.locale` and `.startPage` stay plain, non-empty `string` — not `AppLocale` or `StartPage` — validity against the _current_ supported-locale/registered-route set stays the job of `i18n/index.ts` and `router/index.ts`, unchanged.
- No migration: `todo.theme`, `todo.locale`, `todo.startPage` are retired outright, not read or migrated. A device that has them starts over at `DEFAULT_SETTINGS`.
- `cleanupDays` becomes a single value on the settings store — the three per-entity stores no longer each carry their own.
- `BACKUP_VERSION` stays `3`; `Backup.settings` is an optional addition, not a breaking shape change.
- Settings sync is **not** a merge: both sides send their whole document; each independently accepts (replace) or declines (keep local), symmetrically, with no negotiation.
- `stores/settings.ts` must never import from `@/router` (or anything downstream of it) — `router/index.ts` already imports pages, and pages import stores, so a `stores → router` edge would be a cycle. Every mutating store action persists through `settingsService.save()` directly.
- Anything that writes through `localStorage` in a test needs `// @vitest-environment happy-dom` as the file's first line (the project's Vitest default is `environment: 'node'`, which has no `localStorage`).
- Reuse the codebase's existing per-record parse-and-address pattern (`fail`, `isRecordObject`, per-field messages) rather than inventing a new validation style.

---

## File Structure

New files:

- `src/types/settings.ts` — `AppTheme`, `PageSettings`, `AppSettings`, `DEFAULT_SETTINGS`, `SettingsFormatError`, `parseSettings`.
- `src/types/settings.test.ts`
- `src/services/settings/SettingsService.ts` — `loadRaw`/`load`/`save` over `localStorage['todo.settings']`, singleton `settingsService`. No `index.ts` barrel, matching `services/backup/` and `services/sync/`.
- `src/services/settings/SettingsService.test.ts`
- `src/stores/settings.ts` — `useSettingsStore()`.
- `src/stores/settings.test.ts`
- `src/pages/SettingsPage/SettingsPage.test.ts`

Modified files (grouped by task below): `src/types/index.ts`, `src/stores/index.ts`, `src/stores/createEntityStore.ts` (+ `.test.ts`), `src/stores/tasks.ts` (+ `.test.ts`), `src/i18n/index.ts` (+ `detectLocale.test.ts`), `src/router/index.ts`, `src/plugins/vuetify.ts`, `src/containers/ThemeMenu.vue` (+ `.test.ts`), `src/containers/LocaleMenu.vue` (+ `.test.ts`), `src/pages/SettingsPage/SettingsPage.vue`, `src/services/backup/BackupService.ts` (+ `.test.ts`), `src/containers/BackupActions.vue` (+ `.test.ts`), `src/services/sync/SyncConnection.ts` (+ `.test.ts`), `src/pages/SyncPage/containers/SyncFlow.vue` (+ `.test.ts`), `src/i18n/locales/{en,ru,pl}.json`.

`src/pages/SyncPage/SyncPage.vue` needs **no change**: the Data/Settings toggle is rendered inside `SyncFlow.vue`'s own idle-state block (see Task 12) rather than lifted to the page, since only `SyncFlow` knows its own `step` and the toggle must disappear once pairing starts. This keeps the page a trivial wrapper, as it is today, and avoids moving the heavily-tested start/join buttons across a component boundary.

---

### Task 1: `types/settings.ts` — shape and validation

**Files:**

- Create: `src/types/settings.ts`
- Create: `src/types/settings.test.ts`
- Modify: `src/types/index.ts`

**Interfaces:**

- Produces: `AppTheme = 'light' | 'dark' | 'system'`; `interface PageSettings { rows: 1 | 2; confirmDone: boolean; confirmReopen: boolean }`; `interface AppSettings { general: { theme: AppTheme; locale: string; startPage: string; cleanupDays: 30 | 60 | 90 }; dreams: PageSettings; goals: PageSettings; tasks: PageSettings }`; `DEFAULT_SETTINGS: AppSettings`; `class SettingsFormatError extends Error`; `function parseSettings(value: unknown): AppSettings` (throws `SettingsFormatError`).

- [ ] **Step 1: Write the failing test file**

`src/types/settings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsFormatError, parseSettings } from './settings';

function validRaw(): Record<string, unknown> {
	return {
		general: { theme: 'system', locale: 'en', startPage: 'list', cleanupDays: 30 },
		dreams: { rows: 1, confirmDone: false, confirmReopen: false },
		goals: { rows: 1, confirmDone: false, confirmReopen: false },
		tasks: { rows: 1, confirmDone: false, confirmReopen: false },
	};
}

const ENTITIES = ['dreams', 'goals', 'tasks'] as const;

describe('parseSettings', () => {
	it('parses a valid settings document', () => {
		expect(parseSettings(validRaw())).toEqual(DEFAULT_SETTINGS);
	});

	it('rejects a non-object', () => {
		expect(() => parseSettings('nope')).toThrow(SettingsFormatError);
		expect(() => parseSettings(null)).toThrow(SettingsFormatError);
		expect(() => parseSettings([])).toThrow(SettingsFormatError);
	});

	it('rejects an empty object', () => {
		expect(() => parseSettings({})).toThrow(SettingsFormatError);
	});

	it('rejects a missing "general"', () => {
		const raw = validRaw();
		delete raw.general;
		expect(() => parseSettings(raw)).toThrow(SettingsFormatError);
	});

	it('rejects an invalid theme', () => {
		const raw = {
			...validRaw(),
			general: { theme: 'blue', locale: 'en', startPage: 'list', cleanupDays: 30 },
		};
		expect(() => parseSettings(raw)).toThrow(/theme/);
	});

	it('rejects a missing locale', () => {
		const raw = { ...validRaw(), general: { theme: 'system', startPage: 'list', cleanupDays: 30 } };
		expect(() => parseSettings(raw)).toThrow(/locale/);
	});

	it('rejects an empty-string locale', () => {
		const raw = {
			...validRaw(),
			general: { theme: 'system', locale: '', startPage: 'list', cleanupDays: 30 },
		};
		expect(() => parseSettings(raw)).toThrow(/locale/);
	});

	it('rejects a non-string startPage', () => {
		const raw = {
			...validRaw(),
			general: { theme: 'system', locale: 'en', startPage: 42, cleanupDays: 30 },
		};
		expect(() => parseSettings(raw)).toThrow(/startPage/);
	});

	it('rejects a cleanupDays outside 30, 60, 90', () => {
		const raw = {
			...validRaw(),
			general: { theme: 'system', locale: 'en', startPage: 'list', cleanupDays: 45 },
		};
		expect(() => parseSettings(raw)).toThrow(/cleanupDays/);
	});

	it.each(ENTITIES)('rejects a missing "%s" block', (key) => {
		const raw = validRaw();
		delete raw[key];
		expect(() => parseSettings(raw)).toThrow(SettingsFormatError);
	});

	it.each(ENTITIES)('rejects a "%s.rows" outside 1 or 2', (key) => {
		const raw = validRaw();
		raw[key] = { rows: 3, confirmDone: false, confirmReopen: false };
		expect(() => parseSettings(raw)).toThrow(/rows/);
	});

	it.each(ENTITIES)('rejects a non-boolean "%s.confirmDone"', (key) => {
		const raw = validRaw();
		raw[key] = { rows: 1, confirmDone: 'yes', confirmReopen: false };
		expect(() => parseSettings(raw)).toThrow(/confirmDone/);
	});

	it.each(ENTITIES)('rejects a non-boolean "%s.confirmReopen"', (key) => {
		const raw = validRaw();
		raw[key] = { rows: 1, confirmDone: false, confirmReopen: 'no' };
		expect(() => parseSettings(raw)).toThrow(/confirmReopen/);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/types/settings.test.ts`
Expected: FAIL — `./settings` does not exist.

- [ ] **Step 3: Implement `src/types/settings.ts`**

```ts
import { isRecordObject } from './entity';

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

/**
 * Its own error type, not `EntityFormatError`: settings have no `EntityBase`
 * and are not a record collection, so `BackupService` has to tell "one bad
 * record" apart from "the settings document is bad" when it addresses a
 * parse failure.
 */
export class SettingsFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SettingsFormatError';
	}
}

function fail(reason: string): never {
	throw new SettingsFormatError(reason);
}

function readNonEmptyString(entry: Record<string, unknown>, key: string): string {
	const value = entry[key];
	if (typeof value !== 'string' || value === '') {
		fail(`"${key}" must be a non-empty string`);
	}

	return value;
}

function readBoolean(entry: Record<string, unknown>, key: string): boolean {
	const value = entry[key];
	if (typeof value !== 'boolean') {
		fail(`"${key}" must be true or false`);
	}

	return value;
}

function parseTheme(value: unknown): AppTheme {
	if (value !== 'light' && value !== 'dark' && value !== 'system') {
		fail('"theme" must be "light", "dark" or "system"');
	}

	return value;
}

function parseCleanupDays(value: unknown): 30 | 60 | 90 {
	if (value !== 30 && value !== 60 && value !== 90) {
		fail('"cleanupDays" must be 30, 60 or 90');
	}

	return value;
}

function parseRows(value: unknown): 1 | 2 {
	if (value !== 1 && value !== 2) {
		fail('"rows" must be 1 or 2');
	}

	return value;
}

function parsePageSettings(value: unknown, key: string): PageSettings {
	if (!isRecordObject(value)) {
		fail(`"${key}" must be an object`);
	}

	return {
		rows: parseRows(value.rows),
		confirmDone: readBoolean(value, 'confirmDone'),
		confirmReopen: readBoolean(value, 'confirmReopen'),
	};
}

export function parseSettings(value: unknown): AppSettings {
	if (!isRecordObject(value)) {
		fail('the settings document is not an object');
	}

	const general = value.general;
	if (!isRecordObject(general)) {
		fail('"general" must be an object');
	}

	return {
		general: {
			theme: parseTheme(general.theme),
			locale: readNonEmptyString(general, 'locale'),
			startPage: readNonEmptyString(general, 'startPage'),
			cleanupDays: parseCleanupDays(general.cleanupDays),
		},
		dreams: parsePageSettings(value.dreams, 'dreams'),
		goals: parsePageSettings(value.goals, 'goals'),
		tasks: parsePageSettings(value.tasks, 'tasks'),
	};
}
```

- [ ] **Step 4: Add the barrel export**

In `src/types/index.ts`, add a line so the file reads:

```ts
export * from './entity';
export * from './dream';
export * from './goal';
export * from './task';
export * from './settings';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/types/settings.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add src/types/settings.ts src/types/settings.test.ts src/types/index.ts
git commit -m "feat: add AppSettings shape and parseSettings"
```

---

### Task 2: `services/settings/SettingsService.ts`

**Files:**

- Create: `src/services/settings/SettingsService.ts`
- Create: `src/services/settings/SettingsService.test.ts`

**Interfaces:**

- Consumes: `DEFAULT_SETTINGS`, `parseSettings`, `type AppSettings` from `@/types` (Task 1).
- Produces: `class SettingsService { loadRaw(): AppSettings | null; load(): AppSettings; save(settings: AppSettings): void }`, singleton `settingsService`.

- [ ] **Step 1: Write the failing test file**

`src/services/settings/SettingsService.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types';
import { SettingsService } from './SettingsService';

beforeEach(() => {
	window.localStorage.clear();
});

describe('SettingsService.loadRaw', () => {
	it('returns null when nothing has ever been saved', () => {
		expect(new SettingsService().loadRaw()).toBeNull();
	});

	it('returns null when the stored value is not valid JSON', () => {
		window.localStorage.setItem('todo.settings', 'not json');
		expect(new SettingsService().loadRaw()).toBeNull();
	});

	it('returns null when the stored value is valid JSON but not a valid settings shape', () => {
		window.localStorage.setItem('todo.settings', JSON.stringify({ general: { theme: 'blue' } }));
		expect(new SettingsService().loadRaw()).toBeNull();
	});

	it('returns the stored settings when they are valid, even if they equal the defaults', () => {
		const service = new SettingsService();
		service.save(DEFAULT_SETTINGS);
		expect(service.loadRaw()).toEqual(DEFAULT_SETTINGS);
	});
});

describe('SettingsService.load', () => {
	it('falls back to the defaults when nothing has been saved', () => {
		expect(new SettingsService().load()).toEqual(DEFAULT_SETTINGS);
	});

	it('falls back to the defaults when the stored value is corrupt', () => {
		window.localStorage.setItem('todo.settings', '{not json');
		expect(new SettingsService().load()).toEqual(DEFAULT_SETTINGS);
	});

	it('does not hand back the shared DEFAULT_SETTINGS object itself', () => {
		const loaded = new SettingsService().load();
		loaded.general.theme = 'dark';
		expect(DEFAULT_SETTINGS.general.theme).toBe('system');
	});

	it('reads back a saved value', () => {
		const service = new SettingsService();
		const custom = {
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, theme: 'dark' as const },
		};
		service.save(custom);
		expect(service.load()).toEqual(custom);
	});
});

describe('SettingsService.save', () => {
	it('round-trips through load', () => {
		const service = new SettingsService();
		const custom = {
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, cleanupDays: 90 as const },
		};

		service.save(custom);

		expect(service.load()).toEqual(custom);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/services/settings/SettingsService.test.ts`
Expected: FAIL — `./SettingsService` does not exist.

- [ ] **Step 3: Implement `src/services/settings/SettingsService.ts`**

```ts
import { DEFAULT_SETTINGS, parseSettings, type AppSettings } from '@/types';

const SETTINGS_STORAGE_KEY = 'todo.settings';

/**
 * A copy, never the shared constant itself: `stores/settings.ts` wraps
 * whatever `load()` hands back in `reactive()` and mutates it in place on
 * every setter and on `replaceAll`. Handing out `DEFAULT_SETTINGS` itself
 * would let that mutation reach the module-level constant, corrupting every
 * future fallback for the rest of the session.
 */
function cloneDefaults(): AppSettings {
	return {
		general: { ...DEFAULT_SETTINGS.general },
		dreams: { ...DEFAULT_SETTINGS.dreams },
		goals: { ...DEFAULT_SETTINGS.goals },
		tasks: { ...DEFAULT_SETTINGS.tasks },
	};
}

export class SettingsService {
	/**
	 * Null whenever there is nothing usable to hand back — the key was never
	 * written, the stored value is not valid JSON, or it does not match the
	 * settings shape. Callers that need to tell "nothing saved yet" apart
	 * from "saved, and it happens to match a default" (see `detectLocale()`)
	 * read this instead of `load()`.
	 */
	loadRaw(): AppSettings | null {
		const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
		if (raw === null) {
			return null;
		}

		try {
			return parseSettings(JSON.parse(raw));
		} catch {
			return null;
		}
	}

	load(): AppSettings {
		return this.loadRaw() ?? cloneDefaults();
	}

	save(settings: AppSettings): void {
		localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
	}
}

export const settingsService = new SettingsService();
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/services/settings/SettingsService.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/services/settings/SettingsService.ts src/services/settings/SettingsService.test.ts
git commit -m "feat: add SettingsService over localStorage['todo.settings']"
```

---

### Task 3: `stores/settings.ts` — Pinia store

**Files:**

- Create: `src/stores/settings.ts`
- Create: `src/stores/settings.test.ts`
- Modify: `src/stores/index.ts`

**Interfaces:**

- Consumes: `settingsService` (Task 2); `type AppSettings`, `type AppTheme`, `type PageSettings` from `@/types` (Task 1).
- Produces: `useSettingsStore(): { general; dreams; goals; tasks; setTheme(theme: AppTheme): void; setLocale(locale: string): void; setStartPage(startPage: string): void; setCleanupDays(days: 30|60|90): void; updatePageSettings(entity: SettingsEntity, patch: Partial<PageSettings>): void; replaceAll(settings: AppSettings): void }`, exported `type SettingsEntity = 'dreams' | 'goals' | 'tasks'`.

- [ ] **Step 1: Write the failing test file**

`src/stores/settings.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, nextTick, watch } from 'vue';
import { DEFAULT_SETTINGS } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { useSettingsStore } from './settings';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

describe('useSettingsStore setters', () => {
	it('setTheme updates state and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.setTheme('dark');

		expect(store.general.theme).toBe('dark');
		expect(save).toHaveBeenCalledWith(
			expect.objectContaining({ general: expect.objectContaining({ theme: 'dark' }) }),
		);
	});

	it('setLocale updates state and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.setLocale('ru');

		expect(store.general.locale).toBe('ru');
		expect(save).toHaveBeenCalled();
	});

	it('setStartPage updates state and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.setStartPage('matrix');

		expect(store.general.startPage).toBe('matrix');
		expect(save).toHaveBeenCalled();
	});

	it('setCleanupDays updates state and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.setCleanupDays(90);

		expect(store.general.cleanupDays).toBe(90);
		expect(save).toHaveBeenCalled();
	});

	it('updatePageSettings patches only the named entity and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.updatePageSettings('goals', { rows: 2 });

		expect(store.goals.rows).toBe(2);
		expect(store.dreams.rows).toBe(1);
		expect(store.tasks.rows).toBe(1);
		expect(save).toHaveBeenCalled();
	});
});

describe('useSettingsStore replaceAll', () => {
	it('overwrites all four sections at once', () => {
		const store = useSettingsStore();
		const incoming = {
			general: {
				theme: 'dark' as const,
				locale: 'pl',
				startPage: 'matrix',
				cleanupDays: 60 as const,
			},
			dreams: { rows: 2 as const, confirmDone: true, confirmReopen: true },
			goals: { rows: 2 as const, confirmDone: true, confirmReopen: true },
			tasks: { rows: 2 as const, confirmDone: true, confirmReopen: true },
		};

		store.replaceAll(incoming);

		expect(store.general).toEqual(incoming.general);
		expect(store.dreams).toEqual(incoming.dreams);
		expect(store.goals).toEqual(incoming.goals);
		expect(store.tasks).toEqual(incoming.tasks);
	});

	it('persists the replaced settings', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.replaceAll(DEFAULT_SETTINGS);

		expect(save).toHaveBeenCalled();
	});
});

/**
 * Regression coverage for the composition trap `stores/tasks.ts` documents:
 * a plain `{ ...store }` spread only copies each property's current value
 * out once, so nothing behind it stays connected to the source afterwards.
 * These assertions read the derived value *after* mutating, so a broken
 * composition (a frozen snapshot) fails them.
 */
describe('useSettingsStore reactivity', () => {
	it('keeps a scalar field live in a computed after a setter runs', () => {
		const store = useSettingsStore();
		const themeLabel = computed(() => store.general.theme);

		store.setTheme('dark');

		expect(themeLabel.value).toBe('dark');
	});

	it('keeps a nested object field live in a watch after updatePageSettings runs', async () => {
		const store = useSettingsStore();
		const seen: number[] = [];
		watch(
			() => store.dreams.rows,
			(rows) => seen.push(rows),
		);

		store.updatePageSettings('dreams', { rows: 2 });
		await nextTick();

		expect(seen).toEqual([2]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/stores/settings.test.ts`
Expected: FAIL — `./settings` does not exist.

- [ ] **Step 3: Implement `src/stores/settings.ts`**

```ts
import { reactive, toRefs } from 'vue';
import { defineStore } from 'pinia';
import type { AppSettings, AppTheme, PageSettings } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';

export type SettingsEntity = 'dreams' | 'goals' | 'tasks';

/**
 * `reactive()` + `toRefs()`, not a plain object spread: a spread only
 * copies each property's value out once, so nothing behind it stays
 * connected to `state` afterwards — the same composition trap
 * `stores/tasks.ts` documents for composing one store from another.
 */
export const useSettingsStore = defineStore('settings', () => {
	const state = reactive(settingsService.load());

	function persist(): void {
		// `state` is a reactive proxy, not a plain object -- unlike the entity
		// stores' writes to IndexedDB, `JSON.stringify` (inside `save`) reads a
		// proxy's own properties the same as a plain object, so this write path
		// needs no `toRaw()`/`toStorable()`.
		settingsService.save(state);
	}

	function setTheme(theme: AppTheme): void {
		state.general.theme = theme;
		persist();
	}

	function setLocale(locale: string): void {
		state.general.locale = locale;
		persist();
	}

	function setStartPage(startPage: string): void {
		state.general.startPage = startPage;
		persist();
	}

	function setCleanupDays(cleanupDays: 30 | 60 | 90): void {
		state.general.cleanupDays = cleanupDays;
		persist();
	}

	function updatePageSettings(entity: SettingsEntity, patch: Partial<PageSettings>): void {
		Object.assign(state[entity], patch);
		persist();
	}

	function replaceAll(settings: AppSettings): void {
		state.general = { ...settings.general };
		state.dreams = { ...settings.dreams };
		state.goals = { ...settings.goals };
		state.tasks = { ...settings.tasks };
		persist();
	}

	return {
		...toRefs(state),
		setTheme,
		setLocale,
		setStartPage,
		setCleanupDays,
		updatePageSettings,
		replaceAll,
	};
});
```

- [ ] **Step 4: Add the barrel export**

In `src/stores/index.ts`, add a line so the file reads:

```ts
export * from './storage';
export * from './createEntityStore';
export * from './dreams';
export * from './goals';
export * from './tasks';
export * from './settings';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/stores/settings.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add src/stores/settings.ts src/stores/settings.test.ts src/stores/index.ts
git commit -m "feat: add the settings Pinia store"
```

---

### Task 4: `cleanupDays` becomes a single real setting

**Files:**

- Modify: `src/stores/createEntityStore.ts`
- Modify: `src/stores/createEntityStore.test.ts` (environment directive only)
- Modify: `src/stores/tasks.ts`
- Modify: `src/stores/tasks.test.ts` (environment directive only)
- Modify: `src/pages/SyncPage/containers/SyncFlow.vue`

**Interfaces:**

- Consumes: `useSettingsStore()` (Task 3).
- Produces: `defineEntityStore`'s returned object no longer has a `cleanupDays` field; neither does `useTasksStore()`'s.

- [ ] **Step 1: Add the environment directive to the two affected test files**

`useSettingsStore()` reads `localStorage` (via `SettingsService`) as soon as any `defineEntityStore`-built store is instantiated. Both files currently run under Vitest's default `environment: 'node'`, which has no `localStorage` global. As the very first line of each file, add:

`src/stores/createEntityStore.test.ts`:

```ts
// @vitest-environment happy-dom
```

`src/stores/tasks.test.ts`:

```ts
// @vitest-environment happy-dom
```

Neither file references `cleanupDays` directly today (confirmed by inspection — every closed-record-window and completion-pruning test relies on the default 30-day window, which `useSettingsStore()` still supplies as long as `localStorage['todo.settings']` is never seeded in these files, which it isn't). No other change is needed in either file.

- [ ] **Step 2: Run the two test files to confirm they still fail for the _expected_ reason**

Run: `npm test -- src/stores/createEntityStore.test.ts src/stores/tasks.test.ts`
Expected: still PASS at this point (nothing under test has changed yet) — this step is a baseline check before Step 3's edit, not a red step.

- [ ] **Step 3: Rewire `src/stores/createEntityStore.ts`**

Replace the import block:

```ts
import { computed, ref, toRaw, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { Status, type EntityBase } from '@/types';
import type { EntityStorage } from '@/repositories/EntityStorage';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { DEFAULT_CLEANUP_DAYS, collectGarbage } from '@/utils';
import { useStorageStore } from './storage';
```

with:

```ts
import { computed, ref, toRaw, type Ref } from 'vue';
import { defineStore } from 'pinia';
import { Status, type EntityBase } from '@/types';
import type { EntityStorage } from '@/repositories/EntityStorage';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { collectGarbage } from '@/utils';
import { useSettingsStore } from './settings';
import { useStorageStore } from './storage';
```

Inside `defineEntityStore`'s setup function, replace:

```ts
const records = ref<T[]>([]) as Ref<T[]>;
const loading = ref(false);
const cleanupDays = ref(DEFAULT_CLEANUP_DAYS);

const storageState = useStorageStore();
```

with:

```ts
const records = ref<T[]>([]) as Ref<T[]>;
const loading = ref(false);

const storageState = useStorageStore();
const settingsState = useSettingsStore();
```

Inside `load()`, replace:

```ts
const { keep, purge } = collectGarbage(loaded, cleanupDays.value, now);
const prune = options.prune;
const pruned = prune ? keep.map((record) => prune(record, cleanupDays.value, now)) : keep;
```

with:

```ts
const cleanupDays = settingsState.general.cleanupDays;
const { keep, purge } = collectGarbage(loaded, cleanupDays, now);
const prune = options.prune;
const pruned = prune ? keep.map((record) => prune(record, cleanupDays, now)) : keep;
```

And in the returned object, remove the `cleanupDays,` line:

```ts
return {
	records,
	active,
	closed,
	loading,
	load,
	add,
	update,
	close,
	reopen,
	replaceAll,
};
```

- [ ] **Step 4: Rewire `src/stores/tasks.ts`**

In `useTasksStore`, replace:

```ts
const store = useBaseTasksStore();
const { records, active, closed, loading, cleanupDays } = storeToRefs(store);
```

with:

```ts
const store = useBaseTasksStore();
const { records, active, closed, loading } = storeToRefs(store);
```

And in the returned object, remove the `cleanupDays,` line:

```ts
return {
	records,
	active,
	closed,
	loading,
	quadrants,
	load: store.load,
	add: store.add,
	update: store.update,
	close: store.close,
	reopen: store.reopen,
	replaceAll: store.replaceAll,
};
```

- [ ] **Step 5: Rewire `src/pages/SyncPage/containers/SyncFlow.vue`**

Add the store import and instance, next to the other store instances:

```ts
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
```

```ts
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const settings = useSettingsStore();
```

In `runExchange()`, replace:

```ts
const mergedTasks = sweep(syncMerger.mergeTasks([...tasks.records], theirs.tasks), now).map(
	(task) => pruneCompletions(task, tasks.cleanupDays, now),
);
```

with:

```ts
const mergedTasks = sweep(syncMerger.mergeTasks([...tasks.records], theirs.tasks), now).map(
	(task) => pruneCompletions(task, settings.general.cleanupDays, now),
);
```

Replace the `sweep` function and its doc comment:

```ts
/**
 * Collection runs on the merged result rather than after it is written: a
 * record the other device still holds past our window would otherwise land on
 * disk and be swept only on the next load, one write too late.
 *
 * The three stores share one `cleanupDays`, so any of them can supply it.
 */
function sweep<T extends EntityBase>(records: T[], now: Date): T[] {
	return collectGarbage(records, tasks.cleanupDays, now).keep;
}
```

with:

```ts
/**
 * Collection runs on the merged result rather than after it is written: a
 * record the other device still holds past our window would otherwise land on
 * disk and be swept only on the next load, one write too late.
 */
function sweep<T extends EntityBase>(records: T[], now: Date): T[] {
	return collectGarbage(records, settings.general.cleanupDays, now).keep;
}
```

- [ ] **Step 6: Run the full affected test suite**

Run: `npm test -- src/stores/createEntityStore.test.ts src/stores/tasks.test.ts src/pages/SyncPage/containers/SyncFlow.test.ts`
Expected: PASS — behavior unchanged, since `useSettingsStore()`'s default `cleanupDays` is still 30 in every one of these tests (none seed `localStorage['todo.settings']`).

- [ ] **Step 7: Commit**

```bash
git add src/stores/createEntityStore.ts src/stores/createEntityStore.test.ts src/stores/tasks.ts src/stores/tasks.test.ts src/pages/SyncPage/containers/SyncFlow.vue
git commit -m "refactor: read cleanupDays from the settings store, not a per-store ref"
```

---

### Task 5: Retire the three old `localStorage` keys

**Files:**

- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/detectLocale.test.ts`
- Modify: `src/router/index.ts`
- Modify: `src/plugins/vuetify.ts`

**Interfaces:**

- Consumes: `settingsService` (Task 2); `type AppTheme` from `@/types` (Task 1).
- Produces: `detectLocale()` (unchanged signature, rewired internals); `readStoredStartPage()` (unchanged signature, rewired internals); `resolveTheme` unchanged and still exported from `@/plugins/vuetify`. Removes: `setLocale` (i18n), `persistStartPage`/`START_PAGE_STORAGE_KEY` (router), `readStoredTheme`/`persistTheme`/`THEME_STORAGE_KEY`/`AppTheme`-declared-here (vuetify).

- [ ] **Step 1: Update the failing/adjusted test first — `src/i18n/detectLocale.test.ts`**

Replace the whole file:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { detectLocale } from '@/i18n';

function stubLanguages(languages: string[]): void {
	Object.defineProperty(window.navigator, 'languages', {
		value: languages,
		configurable: true,
	});
}

const originalLanguages = window.navigator.languages;

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	Object.defineProperty(window.navigator, 'languages', {
		value: originalLanguages,
		configurable: true,
	});
});

describe('detectLocale', () => {
	it('returns the stored locale without consulting navigator.languages', () => {
		settingsService.save({
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, locale: 'pl' },
		});
		stubLanguages(['en-US']);

		expect(detectLocale()).toBe('pl');
	});

	it('matches the first supported locale found in navigator.languages, in preference order', () => {
		stubLanguages(['de-DE', 'ru-RU', 'en-US']);

		expect(detectLocale()).toBe('ru');
	});

	it('falls back to English when no preferred language is supported', () => {
		stubLanguages(['de-DE', 'fr-FR']);

		expect(detectLocale()).toBe('en');
	});

	it('falls back to scanning navigator.languages when the stored settings are corrupt', () => {
		window.localStorage.setItem('todo.settings', '{not json');
		stubLanguages(['ru-RU']);

		expect(detectLocale()).toBe('ru');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/i18n/detectLocale.test.ts`
Expected: FAIL — `detectLocale()` still reads `todo.locale`, so the first case ("returns the stored locale") gets `'en'` (via `navigator.languages` fallback with `'en-US'` unmatched... actually still resolves through the old path) rather than `'pl'`.

- [ ] **Step 3: Rewire `src/i18n/index.ts`**

Replace the whole file:

```ts
import { createI18n } from 'vue-i18n';
import usFlag from 'flag-icons/flags/4x3/us.svg';
import ruFlag from 'flag-icons/flags/4x3/ru.svg';
import plFlag from 'flag-icons/flags/4x3/pl.svg';
import { settingsService } from '@/services/settings/SettingsService';
import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';

export const SUPPORTED_LOCALES = ['en', 'ru', 'pl'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Autonyms for the language picker -- each name is written in its own language. */
export const LOCALE_NAMES: Record<AppLocale, string> = {
	en: 'English',
	ru: 'Русский',
	pl: 'Polski',
};

/** English has no single national flag -- the US flag is the chosen stand-in. */
export const LOCALE_FLAGS: Record<AppLocale, string> = {
	en: usFlag,
	ru: ruFlag,
	pl: plFlag,
};

function isSupported(value: string | null): value is AppLocale {
	return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * There's no backend to read a real Accept-Language header from, so
 * navigator.languages (the browser's own ordered preference list) is the
 * closest client-side equivalent. `loadRaw()`, not `load()`: only a device
 * that has never saved settings at all should fall through to scanning the
 * browser -- `load()`'s DEFAULT_SETTINGS fallback would otherwise read as
 * "the user chose English" on every first run.
 */
export function detectLocale(): AppLocale {
	const stored = settingsService.loadRaw()?.general.locale ?? null;
	if (isSupported(stored)) {
		return stored;
	}

	for (const preferred of navigator.languages ?? [navigator.language]) {
		const match = SUPPORTED_LOCALES.find((locale) => preferred.toLowerCase().startsWith(locale));
		if (match) return match;
	}

	return 'en';
}

/** Resolved once at startup so Vuetify can start on the same locale as the app. */
export const initialLocale = detectLocale();

export const i18n = createI18n({
	legacy: false,
	locale: initialLocale,
	fallbackLocale: 'en',
	messages: { en, ru, pl },
});
```

`setLocale` is deleted: persistence now goes through `useSettingsStore().setLocale()` (Task 3), and the live `i18n.global.locale` assignment moves into `LocaleMenu.vue` (Task 7), which already holds the same ref via `useI18n()`.

- [ ] **Step 4: Rewire `src/router/index.ts`**

Replace:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import TodoListPage from '@/pages/TodoListPage/TodoListPage.vue';

declare module 'vue-router' {
	interface RouteMeta {
		/** Present on routes that can be picked as the app's start page. */
		startPage?: {
			icon: string;
			labelKey: string;
		};
	}
}

const START_PAGE_STORAGE_KEY = 'todo.startPage';
```

with:

```ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import TodoListPage from '@/pages/TodoListPage/TodoListPage.vue';
import { settingsService } from '@/services/settings/SettingsService';

declare module 'vue-router' {
	interface RouteMeta {
		/** Present on routes that can be picked as the app's start page. */
		startPage?: {
			icon: string;
			labelKey: string;
		};
	}
}
```

Replace:

```ts
export function readStoredStartPage(): StartPage {
	const stored = localStorage.getItem(START_PAGE_STORAGE_KEY);
	const options = getStartPageOptions();
	const fallback = options[0]?.value ?? 'list';

	if (stored === null) {
		return fallback;
	}

	return options.some((option) => option.value === stored) ? stored : fallback;
}

export function persistStartPage(page: StartPage): void {
	localStorage.setItem(START_PAGE_STORAGE_KEY, page);
}
```

with:

```ts
export function readStoredStartPage(): StartPage {
	const stored = settingsService.load().general.startPage;
	const options = getStartPageOptions();
	const fallback = options[0]?.value ?? 'list';

	return options.some((option) => option.value === stored) ? stored : fallback;
}
```

`persistStartPage` is deleted: `SettingsPage.vue` (Task 8) writes through `useSettingsStore().setStartPage()` instead, which is the only place that used to call it.

- [ ] **Step 5: Rewire `src/plugins/vuetify.ts`**

Replace:

```ts
import 'vuetify/styles';
import '@/assets/fonts/fonts.scss';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, ru, pl } from 'vuetify/locale';
import { initialLocale } from '@/i18n';

const THEME_STORAGE_KEY = 'todo.theme';

export type AppTheme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export function readStoredTheme(): AppTheme {
	const stored = localStorage.getItem(THEME_STORAGE_KEY);
	return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function persistTheme(theme: AppTheme): void {
	localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// 'system' isn't a registered Vuetify theme name -- it has to resolve to
// whichever of 'light'/'dark' the OS currently prefers before it can be
// handed to createVuetify() or theme.change().
export function resolveTheme(preference: AppTheme): ResolvedTheme {
	if (preference !== 'system') {
		return preference;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default createVuetify({
	theme: {
		defaultTheme: resolveTheme(readStoredTheme()),
```

with:

```ts
import 'vuetify/styles';
import '@/assets/fonts/fonts.scss';
import { createVuetify } from 'vuetify';
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg';
import { en, ru, pl } from 'vuetify/locale';
import type { AppTheme } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { initialLocale } from '@/i18n';

export type ResolvedTheme = 'light' | 'dark';

// 'system' isn't a registered Vuetify theme name -- it has to resolve to
// whichever of 'light'/'dark' the OS currently prefers before it can be
// handed to createVuetify() or theme.change().
export function resolveTheme(preference: AppTheme): ResolvedTheme {
	if (preference !== 'system') {
		return preference;
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default createVuetify({
	theme: {
		defaultTheme: resolveTheme(settingsService.load().general.theme),
```

(the rest of the file, from `themes: {` onward, is unchanged).

- [ ] **Step 6: Run the affected test files**

Run: `npm test -- src/i18n/detectLocale.test.ts`
Expected: PASS, all cases (including the new corrupt-settings case).

Note: `ThemeMenu.test.ts` and `LocaleMenu.test.ts` are expected to still fail after this step — they still import `readStoredTheme` (deleted) and seed `todo.theme`/`todo.locale` directly. Task 6 and Task 7 fix them.

- [ ] **Step 7: Commit**

```bash
git add src/i18n/index.ts src/i18n/detectLocale.test.ts src/router/index.ts src/plugins/vuetify.ts
git commit -m "refactor: read theme, locale and start page through SettingsService"
```

---

### Task 6: Rewire `ThemeMenu.vue` onto the settings store

**Files:**

- Modify: `src/containers/ThemeMenu.vue`
- Modify: `src/containers/ThemeMenu.test.ts`

**Interfaces:**

- Consumes: `useSettingsStore()` (Task 3); `resolveTheme` from `@/plugins/vuetify` (Task 5, unchanged); `type AppTheme` from `@/types` (Task 1).

- [ ] **Step 1: Update the test file first**

Replace the whole file:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { DEFAULT_SETTINGS } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { useSettingsStore } from '@/stores/settings';
import ThemeMenu from './ThemeMenu.vue';

function openMenu(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Choose theme"]').trigger('click');
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
	vuetify.theme.change('light');
});

describe('ThemeMenu', () => {
	it('lists the options in order: system, light, dark', async () => {
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const labels = wrapper
			.findAll('.v-list-item')
			.map((item) => item.text())
			.filter((text) => text.length > 0);

		expect(labels).toEqual(['System', 'Light', 'Dark']);
	});

	it('marks the currently stored preference with a checkmark', async () => {
		settingsService.save({
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, theme: 'dark' },
		});
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const dark = items.find((item) => item.text().includes('Dark'));
		const light = items.find((item) => item.text().includes('Light'));

		expect(dark?.props('appendIcon')).toBeTruthy();
		expect(light?.props('appendIcon')).toBeFalsy();
	});

	it('applies and persists the chosen theme', async () => {
		const wrapper = mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);
		await clickButtonByText(wrapper, 'Dark');

		expect(useSettingsStore().general.theme).toBe('dark');
		expect(vuetify.theme.global.name.value).toBe('dark');
	});

	describe('system preference tracking', () => {
		let listeners: Array<(event: MediaQueryListEvent) => void>;
		let originalMatchMedia: typeof window.matchMedia;

		beforeEach(() => {
			listeners = [];
			originalMatchMedia = window.matchMedia;
			window.matchMedia = ((query: string) =>
				({
					matches: false,
					media: query,
					onchange: null,
					addListener: () => {},
					removeListener: () => {},
					addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
						listeners.push(listener);
					},
					removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
						listeners = listeners.filter((candidate) => candidate !== listener);
					},
					dispatchEvent: () => false,
				}) as MediaQueryList) as typeof window.matchMedia;
		});

		afterEach(() => {
			window.matchMedia = originalMatchMedia;
		});

		it('follows OS theme changes while "system" is selected', () => {
			settingsService.save({
				...DEFAULT_SETTINGS,
				general: { ...DEFAULT_SETTINGS.general, theme: 'system' },
			});
			mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

			for (const listener of listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}

			expect(vuetify.theme.global.name.value).toBe('dark');
		});

		it('ignores OS theme changes when a manual preference is selected', () => {
			settingsService.save({
				...DEFAULT_SETTINGS,
				general: { ...DEFAULT_SETTINGS.general, theme: 'light' },
			});
			mount(ThemeMenu, { global: { plugins: [vuetify, i18n] } });

			for (const listener of listeners) {
				listener({ matches: true } as MediaQueryListEvent);
			}

			expect(vuetify.theme.global.name.value).toBe('light');
		});
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/containers/ThemeMenu.test.ts`
Expected: FAIL — `ThemeMenu.vue` still imports `readStoredTheme`/`persistTheme`, which no longer exist.

- [ ] **Step 3: Rewire `src/containers/ThemeMenu.vue`**

Replace the template's `:active` binding:

```html
:active="preference === option.value"
```

with:

```html
:active="settings.general.theme === option.value"
```

Replace the script block:

```ts
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { mdiCheck, mdiThemeLightDark, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import { type AppTheme, persistTheme, readStoredTheme, resolveTheme } from '@/plugins/vuetify';

const { t } = useI18n();
const theme = useTheme();

const open = ref(false);
const preference = ref<AppTheme>(readStoredTheme());

const options: Array<{ value: AppTheme; labelKey: string; icon: string }> = [
	{ value: 'system', labelKey: 'settings.themeSystem', icon: mdiThemeLightDark },
	{ value: 'light', labelKey: 'settings.themeLight', icon: mdiWeatherSunny },
	{ value: 'dark', labelKey: 'settings.themeDark', icon: mdiWeatherNight },
];

const themeIcon = computed(
	() => options.find((option) => option.value === preference.value)?.icon ?? mdiThemeLightDark,
);

function select(value: AppTheme): void {
	preference.value = value;
	persistTheme(value);
	theme.change(resolveTheme(value));
	open.value = false;
}

function syncWithSystem(event: MediaQueryListEvent): void {
	if (preference.value === 'system') {
		theme.change(event.matches ? 'dark' : 'light');
	}
}

const media = window.matchMedia('(prefers-color-scheme: dark)');

onMounted(() => {
	media.addEventListener('change', syncWithSystem);
});

onUnmounted(() => {
	media.removeEventListener('change', syncWithSystem);
});
</script>
```

with:

```ts
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { mdiCheck, mdiThemeLightDark, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import type { AppTheme } from '@/types';
import { resolveTheme } from '@/plugins/vuetify';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const theme = useTheme();
const settings = useSettingsStore();

const open = ref(false);

const options: Array<{ value: AppTheme; labelKey: string; icon: string }> = [
	{ value: 'system', labelKey: 'settings.themeSystem', icon: mdiThemeLightDark },
	{ value: 'light', labelKey: 'settings.themeLight', icon: mdiWeatherSunny },
	{ value: 'dark', labelKey: 'settings.themeDark', icon: mdiWeatherNight },
];

const themeIcon = computed(
	() => options.find((option) => option.value === settings.general.theme)?.icon ?? mdiThemeLightDark,
);

function select(value: AppTheme): void {
	settings.setTheme(value);
	theme.change(resolveTheme(value));
	open.value = false;
}

function syncWithSystem(event: MediaQueryListEvent): void {
	if (settings.general.theme === 'system') {
		theme.change(event.matches ? 'dark' : 'light');
	}
}

const media = window.matchMedia('(prefers-color-scheme: dark)');

onMounted(() => {
	media.addEventListener('change', syncWithSystem);
});

onUnmounted(() => {
	media.removeEventListener('change', syncWithSystem);
});
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/containers/ThemeMenu.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/containers/ThemeMenu.vue src/containers/ThemeMenu.test.ts
git commit -m "refactor: ThemeMenu reads and writes through the settings store"
```

---

### Task 7: Rewire `LocaleMenu.vue` onto the settings store

**Files:**

- Modify: `src/containers/LocaleMenu.vue`
- Modify: `src/containers/LocaleMenu.test.ts`

**Interfaces:**

- Consumes: `useSettingsStore()` (Task 3).

- [ ] **Step 1: Update the test file first**

Replace the whole file:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { useSettingsStore } from '@/stores/settings';
import LocaleMenu from './LocaleMenu.vue';

function openMenu(wrapper: VueWrapper): Promise<void> {
	// The trigger's aria-label is localized, so it can't be used as a
	// locale-independent selector -- the component renders exactly one
	// <button> before the dialog opens.
	return wrapper.get('button').trigger('click');
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
	i18n.global.locale.value = 'en';
});

describe('LocaleMenu', () => {
	it('lists the options in order: English, Русский, Polski', async () => {
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const labels = wrapper
			.findAll('.v-list-item')
			.map((item) => item.text())
			.filter((text) => text.length > 0);

		expect(labels).toEqual(['English', 'Русский', 'Polski']);
	});

	it('shows each language with its flag', async () => {
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const flagSrc = (label: string) =>
			items
				.find((item) => item.text().includes(label))
				?.find('img')
				.attributes('src');

		expect(flagSrc('English')).toContain('us');
		expect(flagSrc('Русский')).toContain('ru');
		expect(flagSrc('Polski')).toContain('pl');
	});

	it('marks the currently active locale with a checkmark', async () => {
		i18n.global.locale.value = 'ru';
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const ru = items.find((item) => item.text().includes('Русский'));
		const en = items.find((item) => item.text().includes('English'));

		expect(ru?.props('appendIcon')).toBeTruthy();
		expect(en?.props('appendIcon')).toBeFalsy();
	});

	it('applies and persists the chosen locale, closing the dialog', async () => {
		const wrapper = mount(LocaleMenu, { global: { plugins: [vuetify, i18n] } });

		await openMenu(wrapper);
		await clickButtonByText(wrapper, 'Polski');

		expect(i18n.global.locale.value).toBe('pl');
		expect(useSettingsStore().general.locale).toBe('pl');
		expect(wrapper.find('.v-overlay--active').exists()).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/containers/LocaleMenu.test.ts`
Expected: FAIL — `LocaleMenu.vue` still calls `setLocale` from `@/i18n`, which no longer exists.

- [ ] **Step 3: Rewire `src/containers/LocaleMenu.vue`**

Replace the script block:

```ts
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiTranslate } from '@mdi/js';
import { type AppLocale, LOCALE_FLAGS, LOCALE_NAMES, SUPPORTED_LOCALES, setLocale } from '@/i18n';

const { t, locale } = useI18n();

const open = ref(false);

function select(code: AppLocale): void {
	setLocale(code);
	open.value = false;
}
</script>
```

with:

```ts
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiTranslate } from '@mdi/js';
import { type AppLocale, LOCALE_FLAGS, LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';

const { t, locale } = useI18n();
const settings = useSettingsStore();

const open = ref(false);

function select(code: AppLocale): void {
	settings.setLocale(code);
	locale.value = code;
	open.value = false;
}
</script>
```

(`locale` from `useI18n()` here is the global-scope composer's locale ref — the same ref as `i18n.global.locale` — so assigning it directly reproduces exactly what the deleted `setLocale()` helper used to do.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/containers/LocaleMenu.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Run the full suite once to confirm Tasks 5–7 leave nothing broken**

Run: `npm test`
Expected: PASS across the whole suite (SettingsPage, BackupService/Actions and SyncConnection/SyncFlow settings extensions haven't been added yet, so this is just confirming no regression from Tasks 5–7).

- [ ] **Step 6: Commit**

```bash
git add src/containers/LocaleMenu.vue src/containers/LocaleMenu.test.ts
git commit -m "refactor: LocaleMenu reads and writes through the settings store"
```

---

### Task 8: `SettingsPage.vue` — cleanup window and per-entity sections

**Files:**

- Modify: `src/pages/SettingsPage/SettingsPage.vue`
- Create: `src/pages/SettingsPage/SettingsPage.test.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `useSettingsStore()` (Task 3); `getStartPageOptions`, `type StartPage` from `@/router` (Task 5, unchanged); `type PageSettings` from `@/types` (Task 1).

- [ ] **Step 1: Add the new i18n keys**

In `src/i18n/locales/en.json`, inside the existing `"settings"` block, add five keys after `"language"`:

```json
	"settings": {
		"startPage": "Start page",
		"startPageList": "List",
		"startPageMatrix": "Matrix",
		"theme": "Theme",
		"themeSystem": "System",
		"themeLight": "Light",
		"themeDark": "Dark",
		"language": "Language",
		"cleanupDays": "Keep closed items for",
		"cleanupDaysOption": "{days} days",
		"dreams": "Dreams",
		"goals": "Goals",
		"tasks": "Tasks",
		"rows1": "1 row",
		"rows2": "2 rows",
		"confirmDone": "Confirm before marking done",
		"confirmReopen": "Confirm before reopening"
	},
```

In `src/i18n/locales/ru.json`, the same block:

```json
	"settings": {
		"startPage": "Стартовая страница",
		"startPageList": "Список",
		"startPageMatrix": "Матрица",
		"theme": "Тема",
		"themeSystem": "Системная",
		"themeLight": "Светлая",
		"themeDark": "Тёмная",
		"language": "Язык",
		"cleanupDays": "Хранить закрытые записи",
		"cleanupDaysOption": "{days} дней",
		"dreams": "Мечты",
		"goals": "Цели",
		"tasks": "Задачи",
		"rows1": "1 строка",
		"rows2": "2 строки",
		"confirmDone": "Подтверждать завершение",
		"confirmReopen": "Подтверждать возврат"
	},
```

In `src/i18n/locales/pl.json`, the same block:

```json
	"settings": {
		"startPage": "Strona początkowa",
		"startPageList": "Lista",
		"startPageMatrix": "Macierz",
		"theme": "Motyw",
		"themeSystem": "Systemowy",
		"themeLight": "Jasny",
		"themeDark": "Ciemny",
		"language": "Język",
		"cleanupDays": "Przechowuj zamknięte pozycje",
		"cleanupDaysOption": "{days} dni",
		"dreams": "Marzenia",
		"goals": "Cele",
		"tasks": "Zadania",
		"rows1": "1 wiersz",
		"rows2": "2 wiersze",
		"confirmDone": "Potwierdzaj oznaczanie jako zrobione",
		"confirmReopen": "Potwierdzaj wznowienie"
	},
```

- [ ] **Step 2: Write the failing test file**

`src/pages/SettingsPage/SettingsPage.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import SettingsPage from './SettingsPage.vue';

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

function mountPage() {
	return mount(SettingsPage, { global: { plugins: [vuetify, i18n] } });
}

describe('SettingsPage start page', () => {
	it('changes the start page through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [startPageSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await startPageSelect.vm.$emit('update:modelValue', 'matrix');

		expect(settings.general.startPage).toBe('matrix');
	});
});

describe('SettingsPage cleanup window', () => {
	it('changes cleanupDays through the settings store', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [, cleanupSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await cleanupSelect.vm.$emit('update:modelValue', 90);

		expect(settings.general.cleanupDays).toBe(90);
	});
});

describe('SettingsPage per-entity sections', () => {
	it('shows one section per entity with a rows toggle and two switches', () => {
		const wrapper = mountPage();

		expect(wrapper.findAllComponents({ name: 'VBtnToggle' })).toHaveLength(3);
		expect(wrapper.findAllComponents({ name: 'VSwitch' })).toHaveLength(6);
	});

	it('changes rows for one entity without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const [dreamsRows] = wrapper.findAllComponents({ name: 'VBtnToggle' });
		await dreamsRows.vm.$emit('update:modelValue', 2);

		expect(settings.dreams.rows).toBe(2);
		expect(settings.goals.rows).toBe(1);
		expect(settings.tasks.rows).toBe(1);
	});

	it('changes confirmDone for one entity without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const switches = wrapper.findAllComponents({ name: 'VSwitch' });
		await switches[0].vm.$emit('update:modelValue', true);

		expect(settings.dreams.confirmDone).toBe(true);
		expect(settings.dreams.confirmReopen).toBe(false);
		expect(settings.goals.confirmDone).toBe(false);
	});

	it('changes confirmReopen for one entity without touching the others', async () => {
		const settings = useSettingsStore();
		const wrapper = mountPage();

		const switches = wrapper.findAllComponents({ name: 'VSwitch' });
		await switches[1].vm.$emit('update:modelValue', true);

		expect(settings.dreams.confirmReopen).toBe(true);
		expect(settings.dreams.confirmDone).toBe(false);
		expect(settings.goals.confirmReopen).toBe(false);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/pages/SettingsPage/SettingsPage.test.ts`
Expected: FAIL — the current page has one `VSelect`, no `VBtnToggle`/`VSwitch`, and doesn't read `useSettingsStore()`.

- [ ] **Step 4: Rewrite `src/pages/SettingsPage/SettingsPage.vue`**

Replace the whole file:

```vue
<style lang="scss" module>
.page {
	max-width: 520px;
	margin-inline: auto;
}
</style>

<template>
	<v-container :class="$style.page">
		<v-list>
			<v-list-subheader>{{ t('settings.startPage') }}</v-list-subheader>
			<v-select
				v-model="startPage"
				:items="startPageItems"
				item-title="title"
				item-value="value"
				variant="outlined"
				hide-details
				class="mx-4 mb-4"
			>
				<template #item="{ item, props: itemProps }">
					<v-list-item v-bind="itemProps" :prepend-icon="item.icon" />
				</template>

				<template #selection="{ item }">
					<v-icon :icon="item.icon" class="mr-2" />
					{{ item.title }}
				</template>
			</v-select>

			<v-list-subheader>{{ t('settings.cleanupDays') }}</v-list-subheader>
			<v-select
				v-model="cleanupDays"
				:items="cleanupDaysItems"
				variant="outlined"
				hide-details
				class="mx-4 mb-4"
			/>

			<v-list-item
				:to="{ name: 'sync' }"
				:title="t('sync.title')"
				:prepend-icon="mdiSync"
				:append-icon="mdiChevronRight"
			/>

			<v-list-subheader>{{ t('backup.title') }}</v-list-subheader>

			<backup-actions @notify="emit('notify', $event)" />

			<template v-for="entity in ENTITIES" :key="entity">
				<v-list-subheader>{{ t(`settings.${entity}`) }}</v-list-subheader>
				<v-btn-toggle
					:model-value="settings[entity].rows"
					mandatory
					color="primary"
					class="mx-4 mb-2"
					@update:model-value="settings.updatePageSettings(entity, { rows: $event })"
				>
					<v-btn :value="1">{{ t('settings.rows1') }}</v-btn>
					<v-btn :value="2">{{ t('settings.rows2') }}</v-btn>
				</v-btn-toggle>
				<v-switch
					:model-value="settings[entity].confirmDone"
					:label="t('settings.confirmDone')"
					color="primary"
					hide-details
					class="mx-4"
					@update:model-value="settings.updatePageSettings(entity, { confirmDone: $event })"
				/>
				<v-switch
					:model-value="settings[entity].confirmReopen"
					:label="t('settings.confirmReopen')"
					color="primary"
					hide-details
					class="mx-4 mb-4"
					@update:model-value="settings.updatePageSettings(entity, { confirmReopen: $event })"
				/>
			</template>
		</v-list>
	</v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiChevronRight, mdiSync } from '@mdi/js';
import BackupActions from '@/containers/BackupActions.vue';
import { getStartPageOptions, type StartPage } from '@/router';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const settings = useSettingsStore();

const ENTITIES: SettingsEntity[] = ['dreams', 'goals', 'tasks'];

const startPage = computed({
	get: () => settings.general.startPage,
	set: (value: StartPage) => settings.setStartPage(value),
});

const startPageItems = computed(() =>
	getStartPageOptions().map((option) => ({
		title: t(option.labelKey),
		value: option.value,
		icon: option.icon,
	})),
);

const cleanupDays = computed({
	get: () => settings.general.cleanupDays,
	set: (value: 30 | 60 | 90) => settings.setCleanupDays(value),
});

const cleanupDaysItems = computed(() =>
	([30, 60, 90] as const).map((days) => ({
		title: t('settings.cleanupDaysOption', { days }),
		value: days,
	})),
);
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/pages/SettingsPage/SettingsPage.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SettingsPage/SettingsPage.vue src/pages/SettingsPage/SettingsPage.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: cleanup window and per-entity list preferences on the settings page"
```

---

### Task 9: `BackupService` carries settings

**Files:**

- Modify: `src/services/backup/BackupService.ts`
- Modify: `src/services/backup/BackupService.test.ts`

**Interfaces:**

- Consumes: `parseSettings`, `SettingsFormatError`, `type AppSettings` from `@/types` (Task 1).
- Produces: `interface Backup { …; settings?: AppSettings }`; `create(dreams, goals, tasks, settings?: AppSettings): Backup`; `parse()` validates `settings` when present.

- [ ] **Step 1: Add the failing tests**

In `src/services/backup/BackupService.test.ts`, add the import:

```ts
import {
	DEFAULT_SETTINGS,
	Status,
	type AppSettings,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
```

(replacing the existing `import { Status, type Dream, type Goal, type Task } from '@/types';`)

Add these `describe` blocks after `describe('BackupService.create', ...)`:

```ts
describe('BackupService.create settings', () => {
	it('leaves settings undefined when none are given', () => {
		const backup = backupService.create([], [], []);
		expect(backup.settings).toBeUndefined();
	});

	it('includes a defensive copy of the given settings', () => {
		const settings: AppSettings = DEFAULT_SETTINGS;
		const backup = backupService.create([], [], [], settings);

		expect(backup.settings).toEqual(settings);
		expect(backup.settings).not.toBe(settings);
		expect(backup.settings?.general).not.toBe(settings.general);
	});
});
```

And after `describe('BackupService.parse', ...)`:

```ts
describe('BackupService.parse settings', () => {
	it('round-trips settings through create, JSON.stringify and parse', () => {
		const text = serialize(backupService.create([], [], [], DEFAULT_SETTINGS));
		const parsed = backupService.parse(text);
		expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
	});

	it('leaves settings undefined when the file has none', () => {
		const text = serialize(backupService.create([], [], []));
		const parsed = backupService.parse(text);
		expect(parsed.settings).toBeUndefined();
	});

	it('rejects a corrupt settings block with an addressed error', () => {
		const text = serialize({
			version: 3,
			exportedAt: '',
			dreams: [],
			goals: [],
			tasks: [],
			settings: { general: { theme: 'blue' } },
		});

		expect(() => backupService.parse(text)).toThrow(/settings/);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/services/backup/BackupService.test.ts`
Expected: FAIL — `create()` doesn't accept a 4th argument yet, `Backup` has no `settings` field.

- [ ] **Step 3: Rewire `src/services/backup/BackupService.ts`**

Replace the import list:

```ts
import {
	EntityFormatError,
	parseDream,
	parseGoal,
	parseTask,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
```

with:

```ts
import {
	EntityFormatError,
	SettingsFormatError,
	parseDream,
	parseGoal,
	parseSettings,
	parseTask,
	type AppSettings,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
```

Replace the `Backup` interface:

```ts
export interface Backup {
	version: number;
	/** ISO 8601 timestamp in UTC. */
	exportedAt: string;
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}
```

with:

```ts
export interface Backup {
	version: number;
	/** ISO 8601 timestamp in UTC. */
	exportedAt: string;
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
	settings?: AppSettings;
}
```

Add a helper next to `readAll`:

```ts
/**
 * Wraps `parseSettings` the same way `readAll` wraps the per-record parsers:
 * the settings document is not a collection, so it gets one address
 * ("settings") instead of an index.
 */
function readSettings(raw: unknown): AppSettings | undefined {
	if (raw === undefined) {
		return undefined;
	}

	try {
		return parseSettings(raw);
	} catch (error) {
		if (error instanceof SettingsFormatError) {
			throw new BackupFormatError(`settings is invalid: ${error.message}`);
		}

		throw error;
	}
}
```

Replace `create()`:

```ts
	create(dreams: Dream[], goals: Goal[], tasks: Task[]): Backup {
		return {
			version: BACKUP_VERSION,
			exportedAt: new Date().toISOString(),
			// Closed records are included on purpose: a backup restores a complete
			// state, and dropping the tombstones would resurrect everything ever
			// finished or abandoned.
			dreams: dreams.map((dream) => ({ ...dream })),
			goals: goals.map((goal) => ({ ...goal })),
			tasks: tasks.map((task) => ({ ...task })),
		};
	}
```

with:

```ts
	create(dreams: Dream[], goals: Goal[], tasks: Task[], settings?: AppSettings): Backup {
		return {
			version: BACKUP_VERSION,
			exportedAt: new Date().toISOString(),
			// Closed records are included on purpose: a backup restores a complete
			// state, and dropping the tombstones would resurrect everything ever
			// finished or abandoned.
			dreams: dreams.map((dream) => ({ ...dream })),
			goals: goals.map((goal) => ({ ...goal })),
			tasks: tasks.map((task) => ({ ...task })),
			settings:
				settings === undefined
					? undefined
					: {
							general: { ...settings.general },
							dreams: { ...settings.dreams },
							goals: { ...settings.goals },
							tasks: { ...settings.tasks },
						},
		};
	}
```

In `parse()`, replace the return statement:

```ts
return {
	version: raw.version,
	exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
	dreams: readAll(raw.dreams, 'dreams', parseDream),
	goals: readAll(raw.goals, 'goals', parseGoal),
	tasks: readAll(raw.tasks, 'tasks', parseTask),
};
```

with:

```ts
return {
	version: raw.version,
	exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
	dreams: readAll(raw.dreams, 'dreams', parseDream),
	goals: readAll(raw.goals, 'goals', parseGoal),
	tasks: readAll(raw.tasks, 'tasks', parseTask),
	settings: readSettings(raw.settings),
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/services/backup/BackupService.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/services/backup/BackupService.ts src/services/backup/BackupService.test.ts
git commit -m "feat: BackupService carries an optional settings document"
```

---

### Task 10: `BackupActions.vue` exports and restores settings

**Files:**

- Modify: `src/containers/BackupActions.vue`
- Modify: `src/containers/BackupActions.test.ts`

**Interfaces:**

- Consumes: `useSettingsStore()` (Task 3); `BackupService.create`'s 4th argument, `Backup.settings` (Task 9).

- [ ] **Step 1: Add the failing tests**

In `src/containers/BackupActions.test.ts`, add the import:

```ts
import { useSettingsStore } from '@/stores/settings';
```

Replace the existing export test:

```ts
describe('BackupActions export', () => {
	it('downloads a backup built from all three collections and notifies', async () => {
		await loadEmptyStores();
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await dreams.add({ name: 'Visit Japan' });
		await goals.add({ name: 'Save for the trip' });
		await tasks.add({ name: 'Buy milk', important: false, urgent: false });

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Export to a file');

		expect(download).toHaveBeenCalledTimes(1);
		const backup = download.mock.calls[0][0];
		expect(backup.version).toBe(3);
		expect(backup.dreams).toHaveLength(1);
		expect(backup.goals).toHaveLength(1);
		expect(backup.tasks).toHaveLength(1);
		expect(wrapper.emitted('notify')).toEqual([['Backup saved.']]);
	});
});
```

with:

```ts
describe('BackupActions export', () => {
	it('downloads a backup built from all three collections and notifies', async () => {
		await loadEmptyStores();
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await dreams.add({ name: 'Visit Japan' });
		await goals.add({ name: 'Save for the trip' });
		await tasks.add({ name: 'Buy milk', important: false, urgent: false });

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Export to a file');

		expect(download).toHaveBeenCalledTimes(1);
		const backup = download.mock.calls[0][0];
		expect(backup.version).toBe(3);
		expect(backup.dreams).toHaveLength(1);
		expect(backup.goals).toHaveLength(1);
		expect(backup.tasks).toHaveLength(1);
		expect(wrapper.emitted('notify')).toEqual([['Backup saved.']]);
	});

	it('includes the current settings in the export', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Export to a file');

		const backup = download.mock.calls[0][0];
		expect(backup.settings.general.theme).toBe('dark');
	});
});
```

Add two tests inside `describe('BackupActions import', ...)`, after the existing "shows a confirmation..." test:

```ts
it('replaces local settings when the backup includes them', async () => {
	await loadEmptyStores();
	const settings = useSettingsStore();
	settings.setTheme('dark');

	const incoming = backupService.create([], [], [], {
		general: { theme: 'light', locale: 'ru', startPage: 'matrix', cleanupDays: 90 },
		dreams: { rows: 2, confirmDone: true, confirmReopen: true },
		goals: { rows: 2, confirmDone: true, confirmReopen: true },
		tasks: { rows: 2, confirmDone: true, confirmReopen: true },
	});
	readText.mockResolvedValue(JSON.stringify(incoming));

	const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
	const fileInput = wrapper.get('input[type="file"]');
	Object.defineProperty(fileInput.element, 'files', {
		value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
		configurable: true,
	});
	await fileInput.trigger('change');
	await wrapper.vm.$nextTick();

	await clickButtonByText(wrapper, 'Replace');
	await flushPromises();

	expect(settings.general.theme).toBe('light');
	expect(settings.general.locale).toBe('ru');
	expect(settings.dreams.rows).toBe(2);
});

it('leaves local settings untouched when the backup has none', async () => {
	await loadEmptyStores();
	const settings = useSettingsStore();
	settings.setTheme('dark');

	const incoming = backupService.create([], [], []);
	readText.mockResolvedValue(JSON.stringify(incoming));

	const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
	const fileInput = wrapper.get('input[type="file"]');
	Object.defineProperty(fileInput.element, 'files', {
		value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
		configurable: true,
	});
	await fileInput.trigger('change');
	await wrapper.vm.$nextTick();

	await clickButtonByText(wrapper, 'Replace');
	await flushPromises();

	expect(settings.general.theme).toBe('dark');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/containers/BackupActions.test.ts`
Expected: FAIL — the export doesn't pass settings yet, and import doesn't call `settings.replaceAll`.

- [ ] **Step 3: Rewire `src/containers/BackupActions.vue`**

Add the store import next to the other store imports:

```ts
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
```

Add the instance next to the other store instances:

```ts
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const settings = useSettingsStore();
```

Replace `exportFile()`:

```ts
function exportFile(): void {
	// records, not active: a backup that omitted closed records would resurrect
	// everything ever finished or abandoned on the next restore.
	backupFile.download(backupService.create(dreams.records, goals.records, tasks.records));
	emit('notify', t('backup.exported'));
}
```

with:

```ts
function exportFile(): void {
	// records, not active: a backup that omitted closed records would resurrect
	// everything ever finished or abandoned on the next restore.
	backupFile.download(
		backupService.create(dreams.records, goals.records, tasks.records, {
			general: settings.general,
			dreams: settings.dreams,
			goals: settings.goals,
			tasks: settings.tasks,
		}),
	);
	emit('notify', t('backup.exported'));
}
```

In `confirmImport()`, replace:

```ts
	try {
		await dreams.replaceAll(backup.dreams);
		await goals.replaceAll(backup.goals);
		await tasks.replaceAll(backup.tasks);

		emit('notify', t('backup.restored', { count: incomingTotal(backup) }));
```

with:

```ts
	try {
		await dreams.replaceAll(backup.dreams);
		await goals.replaceAll(backup.goals);
		await tasks.replaceAll(backup.tasks);
		if (backup.settings) {
			settings.replaceAll(backup.settings);
		}

		emit('notify', t('backup.restored', { count: incomingTotal(backup) }));
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/containers/BackupActions.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Commit**

```bash
git add src/containers/BackupActions.vue src/containers/BackupActions.test.ts
git commit -m "feat: backup export and restore carry settings"
```

---

### Task 11: `SyncConnection` carries a settings payload

**Files:**

- Modify: `src/services/sync/SyncConnection.ts`
- Modify: `src/services/sync/SyncConnection.test.ts`

**Interfaces:**

- Consumes: `parseSettings`, `type AppSettings` from `@/types` (Task 1).
- Produces: `type SyncPayload = SyncDataPayload | SyncSettingsPayload`; `interface SyncSettingsPayload { schema: number; kind: 'settings'; settings: AppSettings }`; `exchange(payload: SyncPayload): Promise<SyncPayload>` (widened from `SyncDataPayload`); rejects with `SyncError` when the two sides' `kind` differ.

- [ ] **Step 1: Add the failing tests**

In `src/services/sync/SyncConnection.test.ts`, replace the import line:

```ts
import { SYNC_SCHEMA, SyncConnection, SyncError, type SyncDataPayload } from './SyncConnection';
```

with:

```ts
import { DEFAULT_SETTINGS } from '@/types';
import {
	SYNC_SCHEMA,
	SyncConnection,
	SyncError,
	type SyncDataPayload,
	type SyncSettingsPayload,
} from './SyncConnection';
```

Add a helper next to `makePayload`:

```ts
function makeSettingsPayload(overrides: Partial<SyncSettingsPayload> = {}): SyncSettingsPayload {
	return {
		schema: SYNC_SCHEMA,
		kind: 'settings',
		settings: DEFAULT_SETTINGS,
		...overrides,
	};
}
```

Add a new `describe` block at the end of the file, before the closing of the module (i.e. after the existing `describe('SyncConnection.exchange', ...)` block):

```ts
describe('SyncConnection.exchange settings payloads', () => {
	beforeEach(() => {
		vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves with a fully-formed incoming settings payload', async () => {
		const { connection, channel } = await makeConnection();
		const incoming = makeSettingsPayload({
			settings: { ...DEFAULT_SETTINGS, general: { ...DEFAULT_SETTINGS.general, theme: 'dark' } },
		});

		const exchangePromise = connection.exchange(makeSettingsPayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(incoming));

		await expect(exchangePromise).resolves.toEqual(incoming);
	});

	it('rejects when the incoming settings are invalid', async () => {
		const { connection, channel } = await makeConnection();
		const malformed = { ...makeSettingsPayload(), settings: { general: { theme: 'blue' } } };

		const exchangePromise = connection.exchange(makeSettingsPayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(malformed));

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('rejects when the other device picked a different sync mode', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(makeSettingsPayload()));

		await expect(exchangePromise).rejects.toThrow(SyncError);
		await expect(exchangePromise).rejects.toThrow(/different/);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/services/sync/SyncConnection.test.ts`
Expected: FAIL — `SyncSettingsPayload` does not exist, `exchange()` only accepts `SyncDataPayload`.

- [ ] **Step 3: Rewire `src/services/sync/SyncConnection.ts`**

Replace the import line:

```ts
import { parseDream, parseGoal, parseTask, type Dream, type Goal, type Task } from '@/types';
```

with:

```ts
import {
	parseDream,
	parseGoal,
	parseSettings,
	parseTask,
	type AppSettings,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
```

Replace the doc comment and the payload types:

```ts
/**
 * `kind` discriminates what the envelope carries. Only `'data'` exists so
 * far; a later stage adds a `'settings'` variant alongside it, which is why
 * the discriminator goes in now rather than when that variant lands — so it
 * arrives as a new case rather than a breaking change to this shape.
 */
export const SYNC_SCHEMA = 3;

export interface SyncDataPayload {
	schema: number;
	kind: 'data';
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}
```

with:

```ts
export const SYNC_SCHEMA = 3;

export interface SyncDataPayload {
	schema: number;
	kind: 'data';
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}

export interface SyncSettingsPayload {
	schema: number;
	kind: 'settings';
	settings: AppSettings;
}

export type SyncPayload = SyncDataPayload | SyncSettingsPayload;
```

Replace the `exchange()` method body:

```ts
	/** Sends our records and resolves with theirs. */
	async exchange(payload: SyncDataPayload): Promise<SyncDataPayload> {
		const open = await this.channelReady;
		const body = JSON.stringify(payload);

		if (body.length > MAX_PAYLOAD_BYTES) {
			throw new SyncError('The list is too large to send in one go');
		}

		const incoming = new Promise<SyncDataPayload>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new SyncError('The other device sent nothing')),
				CONNECT_TIMEOUT_MS,
			);

			open.addEventListener('message', (event: MessageEvent<string>) => {
				clearTimeout(timer);
				try {
					const parsed = JSON.parse(event.data) as Partial<SyncDataPayload>;

					// The schema check comes before anything is read. Without it a
					// device on an older build would merge a shape it does not
					// understand and destroy data on both sides.
					if (parsed.schema !== SYNC_SCHEMA) {
						reject(
							new SyncError('The other device runs a different version. Update it and retry.'),
						);
						return;
					}

					if (
						!Array.isArray(parsed.dreams) ||
						!Array.isArray(parsed.goals) ||
						!Array.isArray(parsed.tasks)
					) {
						reject(new SyncError('The other device sent something unexpected'));
						return;
					}

					// Shape-checking the arrays is not enough: each element still has
					// to be a valid record. This is data from another device, not the
					// user's own file, so a bad record must not reach the merge and
					// garbage-collection steps — parseDream/parseGoal/parseTask throw
					// on the first invalid one, and the catch below turns that into
					// the same full-reject as every other malformed-payload case here.
					parsed.dreams.forEach(parseDream);
					parsed.goals.forEach(parseGoal);
					parsed.tasks.forEach(parseTask);

					resolve(parsed as SyncDataPayload);
				} catch {
					reject(new SyncError('The other device sent something unexpected'));
				}
			});
		});

		open.send(body);

		return incoming;
	}
```

with:

```ts
	/** Sends our payload and resolves with theirs. */
	async exchange(payload: SyncPayload): Promise<SyncPayload> {
		const open = await this.channelReady;
		const body = JSON.stringify(payload);

		if (body.length > MAX_PAYLOAD_BYTES) {
			throw new SyncError('The list is too large to send in one go');
		}

		const incoming = new Promise<SyncPayload>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new SyncError('The other device sent nothing')),
				CONNECT_TIMEOUT_MS,
			);

			open.addEventListener('message', (event: MessageEvent<string>) => {
				clearTimeout(timer);
				try {
					const parsed = JSON.parse(event.data) as Partial<SyncDataPayload> &
						Partial<SyncSettingsPayload>;

					// The schema check comes before anything is read. Without it a
					// device on an older build would merge a shape it does not
					// understand and destroy data on both sides.
					if (parsed.schema !== SYNC_SCHEMA) {
						reject(
							new SyncError('The other device runs a different version. Update it and retry.'),
						);
						return;
					}

					// Both sides pick a mode (Data or Settings) before pairing; a
					// mismatch means the two devices are trying to exchange different
					// things over the same connection.
					if (parsed.kind !== payload.kind) {
						reject(
							new SyncError(
								'The other device is set to sync something different. Pick the same mode on both sides and retry.',
							),
						);
						return;
					}

					if (parsed.kind === 'data') {
						if (
							!Array.isArray(parsed.dreams) ||
							!Array.isArray(parsed.goals) ||
							!Array.isArray(parsed.tasks)
						) {
							reject(new SyncError('The other device sent something unexpected'));
							return;
						}

						// Shape-checking the arrays is not enough: each element still has
						// to be a valid record. This is data from another device, not the
						// user's own file, so a bad record must not reach the merge and
						// garbage-collection steps — parseDream/parseGoal/parseTask throw
						// on the first invalid one, and the catch below turns that into
						// the same full-reject as every other malformed-payload case here.
						parsed.dreams.forEach(parseDream);
						parsed.goals.forEach(parseGoal);
						parsed.tasks.forEach(parseTask);

						resolve(parsed as SyncDataPayload);
						return;
					}

					resolve({ schema: parsed.schema, kind: 'settings', settings: parseSettings(parsed.settings) });
				} catch {
					reject(new SyncError('The other device sent something unexpected'));
				}
			});
		});

		open.send(body);

		return incoming;
	}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- src/services/sync/SyncConnection.test.ts`
Expected: PASS, all cases including the pre-existing ones (a `'data'`-kind payload sent from a `'data'`-kind exchange still round-trips).

- [ ] **Step 5: Commit**

```bash
git add src/services/sync/SyncConnection.ts src/services/sync/SyncConnection.test.ts
git commit -m "feat: SyncConnection carries a settings payload alongside data"
```

---

### Task 12: `SyncFlow.vue` — Data/Settings mode toggle and settings exchange

**Files:**

- Modify: `src/pages/SyncPage/containers/SyncFlow.vue`
- Modify: `src/pages/SyncPage/containers/SyncFlow.test.ts`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/ru.json`
- Modify: `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `SyncConnection.exchange(payload: SyncPayload): Promise<SyncPayload>`, `type SyncSettingsPayload` (Task 11); `useSettingsStore()` (Task 3, already imported by Task 4).

- [ ] **Step 1: Add the new i18n keys**

In `src/i18n/locales/en.json`, inside the existing `"sync"` block, add six keys after `"cancel"`:

```json
	"sync": {
		"title": "Sync",
		"intro": "Sync two devices over a direct connection. Both must be on the same network; nothing goes through a server.",
		"startHere": "This device starts",
		"joinHere": "This device joins",
		"showingCode": "Show this code to the other device",
		"scanTheirCode": "Now scan the code it shows back",
		"scanInvite": "Scan the code from the other device",
		"showAnswer": "Show this code back to the other device",
		"scanning": "Point the camera at the code",
		"orPaste": "No camera? Paste the code here",
		"copy": "Copy code",
		"copied": "Code copied.",
		"paste": "Use this code",
		"cameraFailed": "The camera is unavailable. Paste the code instead.",
		"connecting": "Connecting…",
		"waiting": "Waiting for the other device…",
		"done": "Sync finished. Added: {added}. Updated: {updated}.",
		"failed": "Sync failed: {reason}",
		"restart": "Start over",
		"cancel": "Cancel",
		"modeData": "Data",
		"modeSettings": "Settings",
		"confirmSettingsBody": "The other device sent its settings. Replace your local settings with them?",
		"confirmSettingsAccept": "Replace",
		"confirmSettingsDecline": "Keep mine",
		"settingsDone": "Settings synced."
	},
```

In `src/i18n/locales/ru.json`, the same block:

```json
	"sync": {
		"title": "Синхронизация",
		"intro": "Обмен делами между двумя устройствами напрямую. Оба должны быть в одной сети; через сервер ничего не проходит.",
		"startHere": "Начать с этого устройства",
		"joinHere": "Присоединиться к другому",
		"showingCode": "Покажи этот код второму устройству",
		"scanTheirCode": "Теперь считай код, который оно покажет в ответ",
		"scanInvite": "Считай код со второго устройства",
		"showAnswer": "Покажи этот код обратно второму устройству",
		"scanning": "Наведи камеру на код",
		"orPaste": "Нет камеры? Вставь код сюда",
		"copy": "Скопировать код",
		"copied": "Код скопирован.",
		"paste": "Применить код",
		"cameraFailed": "Камера недоступна. Вставь код вручную.",
		"connecting": "Соединяюсь…",
		"waiting": "Жду второе устройство…",
		"done": "Синхронизация завершена. Добавлено: {added}. Обновлено: {updated}.",
		"failed": "Синхронизация не удалась: {reason}",
		"restart": "Начать заново",
		"cancel": "Отмена",
		"modeData": "Данные",
		"modeSettings": "Настройки",
		"confirmSettingsBody": "Второе устройство прислало свои настройки. Заменить ими локальные?",
		"confirmSettingsAccept": "Заменить",
		"confirmSettingsDecline": "Оставить свои",
		"settingsDone": "Настройки синхронизированы."
	},
```

In `src/i18n/locales/pl.json`, the same block:

```json
	"sync": {
		"title": "Synchronizacja",
		"intro": "Synchronizacja dwóch urządzeń przez bezpośrednie połączenie. Oba muszą być w tej samej sieci; nic nie przechodzi przez serwer.",
		"startHere": "To urządzenie zaczyna",
		"joinHere": "To urządzenie dołącza",
		"showingCode": "Pokaż ten kod drugiemu urządzeniu",
		"scanTheirCode": "Teraz zeskanuj kod pokazany w odpowiedzi",
		"scanInvite": "Zeskanuj kod z drugiego urządzenia",
		"showAnswer": "Pokaż ten kod z powrotem drugiemu urządzeniu",
		"scanning": "Skieruj kamerę na kod",
		"orPaste": "Brak kamery? Wklej kod tutaj",
		"copy": "Skopiuj kod",
		"copied": "Kod skopiowany.",
		"paste": "Zastosuj kod",
		"cameraFailed": "Kamera jest niedostępna. Wklej kod ręcznie.",
		"connecting": "Łączenie…",
		"waiting": "Oczekiwanie na drugie urządzenie…",
		"done": "Synchronizacja zakończona. Dodano: {added}. Zaktualizowano: {updated}.",
		"failed": "Synchronizacja nie powiodła się: {reason}",
		"restart": "Zacznij od nowa",
		"cancel": "Anuluj",
		"modeData": "Dane",
		"modeSettings": "Ustawienia",
		"confirmSettingsBody": "Drugie urządzenie przesłało swoje ustawienia. Zastąpić nimi lokalne?",
		"confirmSettingsAccept": "Zastąp",
		"confirmSettingsDecline": "Zachowaj swoje",
		"settingsDone": "Ustawienia zsynchronizowane."
	},
```

- [ ] **Step 2: Add the failing tests**

In `src/pages/SyncPage/containers/SyncFlow.test.ts`, add imports:

```ts
import { DEFAULT_SETTINGS, type AppSettings } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import type { SyncSettingsPayload } from '@/services/sync/SyncConnection';
```

Add a helper next to `remotePayload`:

```ts
function remoteSettingsPayload(general: Partial<AppSettings['general']> = {}): SyncSettingsPayload {
	return {
		schema: 3,
		kind: 'settings',
		settings: { ...DEFAULT_SETTINGS, general: { ...DEFAULT_SETTINGS.general, ...general } },
	};
}
```

Add a new `describe` block at the end of the file:

```ts
describe('SyncFlow settings mode', () => {
	it('sends the local settings and shows a confirmation with the incoming ones', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ theme: 'dark', locale: 'ru', startPage: 'matrix', cleanupDays: 90 }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(exchange).toHaveBeenCalledWith({
			schema: 3,
			kind: 'settings',
			settings: {
				general: settings.general,
				dreams: settings.dreams,
				goals: settings.goals,
				tasks: settings.tasks,
			},
		});
		expect(wrapper.text()).toContain('The other device sent its settings');
		expect(settings.general.theme).not.toBe('dark');
	});

	it('replaces local settings when the incoming ones are accepted', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ theme: 'dark', locale: 'ru', startPage: 'matrix', cleanupDays: 90 }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(settings.general.theme).toBe('dark');
		expect(settings.general.cleanupDays).toBe(90);
		expect(wrapper.text()).toContain('Settings synced');
	});

	it('leaves local settings untouched when the incoming ones are declined', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ theme: 'dark', locale: 'ru', startPage: 'matrix', cleanupDays: 90 }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();
		const originalTheme = settings.general.theme;

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		await clickButtonByText(wrapper, 'Keep mine');
		await flushPromises();

		expect(settings.general.theme).toBe(originalTheme);
		expect(wrapper.text()).toContain('Settings synced');
	});

	it('closes the connection as soon as the settings exchange resolves, before the user decides', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(remoteSettingsPayload());

		await loadStores([], [], []);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(close).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- src/pages/SyncPage/containers/SyncFlow.test.ts`
Expected: FAIL — there is no mode toggle, no `'settings'`-kind branch in `runExchange()`, no confirm-settings step.

- [ ] **Step 4: Rewire `src/pages/SyncPage/containers/SyncFlow.vue`**

Replace the template's idle block:

```html
<div v-if="step === 'idle'" :class="$style.choices">
	<v-btn color="primary" size="large" @click="startAsInitiator"> {{ t('sync.startHere') }} </v-btn>
	<v-btn variant="tonal" size="large" @click="startAsResponder"> {{ t('sync.joinHere') }} </v-btn>
</div>
```

with:

```html
<div v-if="step === 'idle'" :class="$style.choices">
	<v-btn-toggle v-model="mode" mandatory color="primary" class="mb-2">
		<v-btn value="data">{{ t('sync.modeData') }}</v-btn>
		<v-btn value="settings">{{ t('sync.modeSettings') }}</v-btn>
	</v-btn-toggle>
	<v-btn color="primary" size="large" @click="startAsInitiator"> {{ t('sync.startHere') }} </v-btn>
	<v-btn variant="tonal" size="large" @click="startAsResponder"> {{ t('sync.joinHere') }} </v-btn>
</div>
```

Add a new template branch right after the `'working'` branch and before the `'done'` alert:

```html
<template v-else-if="step === 'confirm-settings'">
	<p class="mb-3">{{ t('sync.confirmSettingsBody') }}</p>
	<div :class="$style.choices">
		<v-btn color="primary" size="large" @click="acceptSettings">
			{{ t('sync.confirmSettingsAccept') }}
		</v-btn>
		<v-btn variant="tonal" size="large" @click="declineSettings">
			{{ t('sync.confirmSettingsDecline') }}
		</v-btn>
	</div>
</template>
```

Replace the `'done'` alert:

```html
<v-alert v-else-if="step === 'done'" type="success" variant="tonal" class="mb-4">
	{{ t('sync.done', { added: result.added, updated: result.updated }) }}
</v-alert>
```

with:

```html
<v-alert v-else-if="step === 'done'" type="success" variant="tonal" class="mb-4">
	{{ mode === 'settings' ? t('sync.settingsDone') : t('sync.done', { added: result.added, updated:
	result.updated }) }}
</v-alert>
```

Replace the script block's type, imports, state and `runExchange`/`reset`:

```ts
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SyncCode from '../SyncCode.vue';
import SyncScanner from '../SyncScanner.vue';
import type { EntityBase } from '@/types';
import { SyncConnection, SYNC_SCHEMA } from '@/services/sync/SyncConnection';
import { syncMerger } from '@/services/sync/SyncMerger';
import { collectGarbage, pruneCompletions } from '@/utils';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';

type Step = 'idle' | 'show-offer' | 'scan-offer' | 'show-answer' | 'working' | 'done' | 'failed';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const settings = useSettingsStore();

const step = ref<Step>('idle');
const ourCode = ref('');
const failure = ref('');
const result = ref({ added: 0, updated: 0 });

let connection: SyncConnection | null = null;
```

with:

```ts
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SyncCode from '../SyncCode.vue';
import SyncScanner from '../SyncScanner.vue';
import type { AppSettings, EntityBase } from '@/types';
import { SyncConnection, SYNC_SCHEMA, type SyncDataPayload, type SyncSettingsPayload } from '@/services/sync/SyncConnection';
import { syncMerger } from '@/services/sync/SyncMerger';
import { collectGarbage, pruneCompletions } from '@/utils';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';

type Step =
	| 'idle'
	| 'show-offer'
	| 'scan-offer'
	| 'show-answer'
	| 'working'
	| 'confirm-settings'
	| 'done'
	| 'failed';
type Mode = 'data' | 'settings';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const settings = useSettingsStore();

const step = ref<Step>('idle');
const mode = ref<Mode>('data');
const ourCode = ref('');
const failure = ref('');
const result = ref({ added: 0, updated: 0 });
const incomingSettings = ref<AppSettings | null>(null);

let connection: SyncConnection | null = null;
```

Replace `reset()`:

```ts
function reset(): void {
	connection?.close();
	connection = null;
	ourCode.value = '';
	failure.value = '';
	step.value = 'idle';
}
```

with:

```ts
function reset(): void {
	connection?.close();
	connection = null;
	ourCode.value = '';
	failure.value = '';
	incomingSettings.value = null;
	step.value = 'idle';
}
```

Replace `runExchange()`:

```ts
/** Both sides run this; each sends everything it has and merges what arrives. */
async function runExchange(): Promise<void> {
	if (!connection) {
		return;
	}

	try {
		const before = new Map(
			[...dreams.records, ...goals.records, ...tasks.records].map((record) => [
				record.id,
				record.updated,
			]),
		);

		const theirs = await connection.exchange({
			schema: SYNC_SCHEMA,
			kind: 'data',
			dreams: [...dreams.records],
			goals: [...goals.records],
			tasks: [...tasks.records],
		});

		const now = new Date();
		const mergedDreams = sweep(syncMerger.merge([...dreams.records], theirs.dreams), now);
		const mergedGoals = sweep(syncMerger.merge([...goals.records], theirs.goals), now);
		const mergedTasks = sweep(syncMerger.mergeTasks([...tasks.records], theirs.tasks), now).map(
			(task) => pruneCompletions(task, settings.general.cleanupDays, now),
		);

		const merged = [...mergedDreams, ...mergedGoals, ...mergedTasks];

		result.value = {
			added: merged.filter((record) => !before.has(record.id)).length,
			updated: merged.filter((record) => {
				const was = before.get(record.id);
				return was !== undefined && was !== record.updated;
			}).length,
		};

		await dreams.replaceAll(mergedDreams);
		await goals.replaceAll(mergedGoals);
		await tasks.replaceAll(mergedTasks);

		step.value = 'done';
		connection.close();
		connection = null;
	} catch (error) {
		fail(error);
	}
}
```

with:

```ts
/** Both sides run this; what they send and how they handle the reply depends on `mode`. */
async function runExchange(): Promise<void> {
	if (!connection) {
		return;
	}

	try {
		if (mode.value === 'settings') {
			const theirs = (await connection.exchange({
				schema: SYNC_SCHEMA,
				kind: 'settings',
				settings: {
					general: settings.general,
					dreams: settings.dreams,
					goals: settings.goals,
					tasks: settings.tasks,
				},
			})) as SyncSettingsPayload;

			incomingSettings.value = theirs.settings;
			step.value = 'confirm-settings';
			connection.close();
			connection = null;
			return;
		}

		const before = new Map(
			[...dreams.records, ...goals.records, ...tasks.records].map((record) => [
				record.id,
				record.updated,
			]),
		);

		const theirs = (await connection.exchange({
			schema: SYNC_SCHEMA,
			kind: 'data',
			dreams: [...dreams.records],
			goals: [...goals.records],
			tasks: [...tasks.records],
		})) as SyncDataPayload;

		const now = new Date();
		const mergedDreams = sweep(syncMerger.merge([...dreams.records], theirs.dreams), now);
		const mergedGoals = sweep(syncMerger.merge([...goals.records], theirs.goals), now);
		const mergedTasks = sweep(syncMerger.mergeTasks([...tasks.records], theirs.tasks), now).map(
			(task) => pruneCompletions(task, settings.general.cleanupDays, now),
		);

		const merged = [...mergedDreams, ...mergedGoals, ...mergedTasks];

		result.value = {
			added: merged.filter((record) => !before.has(record.id)).length,
			updated: merged.filter((record) => {
				const was = before.get(record.id);
				return was !== undefined && was !== record.updated;
			}).length,
		};

		await dreams.replaceAll(mergedDreams);
		await goals.replaceAll(mergedGoals);
		await tasks.replaceAll(mergedTasks);

		step.value = 'done';
		connection.close();
		connection = null;
	} catch (error) {
		fail(error);
	}
}

/**
 * Settings sync is not a merge: both sides sent their whole document, and
 * each independently decides whether to keep it or take the other side's.
 */
function acceptSettings(): void {
	if (incomingSettings.value) {
		settings.replaceAll(incomingSettings.value);
	}
	incomingSettings.value = null;
	step.value = 'done';
}

function declineSettings(): void {
	incomingSettings.value = null;
	step.value = 'done';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- src/pages/SyncPage/containers/SyncFlow.test.ts`
Expected: PASS, all cases including the pre-existing data-mode ones (default `mode` is `'data'`, so their behavior and their `exchange` call assertions are unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/pages/SyncPage/containers/SyncFlow.vue src/pages/SyncPage/containers/SyncFlow.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: Data/Settings sync mode toggle and settings exchange"
```

---

### Task 13: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: PASS, every file.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. Pay particular attention to unused-export warnings for anything Task 5 was supposed to delete (`readStoredTheme`, `persistTheme`, `THEME_STORAGE_KEY`, `setLocale`, `persistStartPage`, `START_PAGE_STORAGE_KEY`) — if any of these still exist anywhere, that is a leftover from Task 5/6/7 to clean up now.

- [ ] **Step 3: Run the type-checked build**

Run: `npm run build`
Expected: `vue-tsc --noEmit` passes and the Vite build completes. This is the first point in the plan where TypeScript's structural checks run across every changed file at once — in particular, it is what would catch a stray `tasks.cleanupDays` or `readStoredTheme()` reference left behind anywhere Vitest's esbuild-based transform would not itself flag.

- [ ] **Step 4: Run the Playwright e2e suite**

Run: `npm run test:e2e`
Expected: PASS. If any existing e2e spec exercises theme, locale, start page, backup export/import or sync, confirm it still passes unmodified (it should, since every settings write still round-trips through the same visible behavior).

- [ ] **Step 5: Manual verification in Edge** (per CLAUDE.md — Chrome on this machine cannot verify PWA/storage behavior reliably; do this in Edge)

Run `npm run build && npm run preview`, then in Edge:

1. Change theme, language and start page in the app bar / Settings page; reload; confirm all three survived.
2. Open Settings, change "Keep closed items for" and toggle a per-entity rows/confirm switch; reload; confirm they survived.
3. Export a backup, clear site data (or open the browser's storage inspector and delete the `todo.settings` key), import the backup back; confirm settings returned with it.
4. On two devices (or two browser profiles on the same machine, same network), open Sync, pick "Settings" mode on both sides, pair, and confirm each side sees the other's settings and can accept or decline independently.

- [ ] **Step 6: Report status to the user**

Summarize what was verified automatically (steps 1–4) and what still needs the user's own confirmation (step 5, since it requires a real browser and, for the two-device sync check, actual hardware) — do not claim step 5 as done without the user having performed it.
