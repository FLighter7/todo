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
