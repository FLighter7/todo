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
			general: { theme: 'dark' as const, locale: 'pl', startPage: 'matrix', cleanupDays: 60 as const },
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
