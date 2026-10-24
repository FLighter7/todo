// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, nextTick, watch } from 'vue';
import { DEFAULT_SETTINGS, cloneSettings } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { useStorageStore } from '../storage';
import { useSettingsStore } from '../settings';

const originalLanguages = window.navigator.languages;

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

afterEach(() => {
	Object.defineProperty(window.navigator, 'languages', {
		value: originalLanguages,
		configurable: true,
	});
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

	it('setFontScale updates state and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.setFontScale(1.5);

		expect(store.general.fontScale).toBe(1.5);
		expect(save).toHaveBeenCalled();
	});

	it('setPageVisible switches one page and persists', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.setPageVisible('goals', false);

		expect(store.general.pages).toEqual({ dreams: true, goals: false, groups: true });
		expect(save).toHaveBeenCalled();
	});

	it('setPageVisible hands the start page back to tasks when it hides that page', () => {
		const store = useSettingsStore();
		store.setStartPage('goals');

		store.setPageVisible('goals', false);

		expect(store.general.startPage).toBe('tasks');
	});

	it('setPageVisible leaves the start page alone when it hides another page', () => {
		const store = useSettingsStore();
		store.setStartPage('goals');

		store.setPageVisible('dreams', false);
		store.setPageVisible('goals', true);

		expect(store.general.startPage).toBe('goals');
	});

	it('setPageVisible never touches DEFAULT_SETTINGS', () => {
		const store = useSettingsStore();

		store.setPageVisible('groups', false);

		expect(DEFAULT_SETTINGS.general.pages.groups).toBe(true);
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

describe('useSettingsStore locale seeding', () => {
	/**
	 * `initialLocale` is resolved once, at module-eval time, from whatever
	 * `navigator.languages` happens to be at that moment -- stubbing it from
	 * inside a test has no effect on an already-imported binding. Resetting
	 * the module registry and re-importing both `@/i18n` and `./settings`
	 * dynamically, after the stub is in place, is what lets a single test
	 * exercise a specific detected locale instead of whatever the default
	 * test-environment language happens to be.
	 */
	it('seeds an unsaved store from the detected browser locale, not the "en" default', async () => {
		Object.defineProperty(window.navigator, 'languages', {
			value: ['ru-RU'],
			configurable: true,
		});

		vi.resetModules();
		const { createPinia: freshCreatePinia, setActivePinia: freshSetActivePinia } =
			await import('pinia');
		const { initialLocale } = await import('@/i18n');
		const { useSettingsStore: useFreshSettingsStore } = await import('../settings');

		expect(initialLocale).toBe('ru');

		freshSetActivePinia(freshCreatePinia());
		const store = useFreshSettingsStore();

		expect(store.general.locale).toBe('ru');
	});

	it('leaves a previously saved locale untouched', () => {
		settingsService.save({
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, locale: 'pl' },
		});

		const store = useSettingsStore();

		expect(store.general.locale).toBe('pl');
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
				fontScale: 1.25 as const,
				pages: { dreams: false, goals: true, groups: false },
			},
			dreams: {
				rows: 2 as const,
				confirmDone: true,
				confirmReopen: true,
				sortOrder: 'az' as const,
			},
			goals: { rows: 2 as const, confirmDone: true, confirmReopen: true, sortOrder: 'az' as const },
			groups: {
				rows: 1 as const,
				confirmDone: true,
				confirmReopen: false,
				sortOrder: 'za' as const,
			},
			tasks: { rows: 2 as const, confirmDone: true, confirmReopen: true, sortOrder: 'az' as const },
		};

		store.replaceAll(incoming);

		expect(store.general).toEqual(incoming.general);
		expect(store.dreams).toEqual(incoming.dreams);
		expect(store.goals).toEqual(incoming.goals);
		expect(store.groups).toEqual(incoming.groups);
		expect(store.tasks).toEqual(incoming.tasks);
	});

	it('holds a copy of the pages, not the incoming object itself', () => {
		const store = useSettingsStore();
		const incoming = cloneSettings(DEFAULT_SETTINGS);

		store.replaceAll(incoming);
		incoming.general.pages.dreams = false;

		expect(store.general.pages.dreams).toBe(true);
	});

	it('persists the replaced settings', () => {
		const save = vi.spyOn(settingsService, 'save');
		const store = useSettingsStore();

		store.replaceAll(DEFAULT_SETTINGS);

		expect(save).toHaveBeenCalled();
	});
});

describe('useSettingsStore persist error handling', () => {
	it('does not throw when settingsService.save fails, and reports it through storage', () => {
		vi.spyOn(settingsService, 'save').mockImplementation(() => {
			throw new Error('quota exceeded');
		});
		const store = useSettingsStore();

		expect(() => store.setTheme('dark')).not.toThrow();
		expect(store.general.theme).toBe('dark');
		expect(useStorageStore().lastError).toBe('storage.writeFailed');
	});
});

/**
 * Regression coverage for the composition trap docs/decisions.md records:
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
