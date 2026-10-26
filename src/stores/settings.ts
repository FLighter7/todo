import { reactive, toRefs } from 'vue';
import { defineStore } from 'pinia';
import {
	cloneSettings,
	enforcePageRules,
	type AppPage,
	type AppSettings,
	type AppTheme,
	type FontScale,
	type PageSettings,
} from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { initialLocale } from '@/i18n';
import { useStorageStore } from './storage';

export type SettingsEntity = 'dreams' | 'goals' | 'groups' | 'tasks';

/**
 * `reactive()` + `toRefs()`, not a plain object spread: a spread only
 * copies each property's value out once, so nothing behind it stays
 * connected to `state` afterwards — the same composition trap
 * docs/decisions.md records for composing one Pinia store from another.
 */
export const useSettingsStore = defineStore('settings', () => {
	const state = reactive(settingsService.load());

	// `settingsService.load()` above falls back to DEFAULT_SETTINGS, which
	// hardcodes `general.locale: 'en'`, whenever nothing was ever saved --
	// that would silently override the browser-language detection `i18n`
	// already did at startup the moment any unrelated setting gets persisted.
	// Only a device that has genuinely never saved settings gets seeded here;
	// `loadRaw()` (not `load()`) is what tells that apart from "saved, and it
	// happens to match a default".
	if (settingsService.loadRaw() === null) {
		state.general.locale = initialLocale;
	}

	const storageState = useStorageStore();

	function persist(): void {
		// `state` is a reactive proxy, not a plain object -- unlike the entity
		// stores' writes to IndexedDB, `JSON.stringify` (inside `save`) reads a
		// proxy's own properties the same as a plain object, so this write path
		// needs no `toRaw()`/`toStorable()`.
		try {
			settingsService.save(state);
		} catch {
			storageState.noteWriteFailure();
		}
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

	function setFontScale(fontScale: FontScale): void {
		state.general.fontScale = fontScale;
		persist();
	}

	/**
	 * Hiding the last shown page brings Tasks back, and hiding the start page
	 * hands that role to the first page still shown.
	 */
	function setPageVisible(page: AppPage, visible: boolean): void {
		state.general.pages[page] = visible;
		enforcePageRules(state);
		persist();
	}

	function updatePageSettings(entity: SettingsEntity, patch: Partial<PageSettings>): void {
		Object.assign(state[entity], patch);
		persist();
	}

	function replaceAll(settings: AppSettings): void {
		const copy = cloneSettings(settings);
		state.general = copy.general;
		state.dreams = copy.dreams;
		state.goals = copy.goals;
		state.groups = copy.groups;
		state.tasks = copy.tasks;
		persist();
	}

	return {
		...toRefs(state),
		setTheme,
		setLocale,
		setStartPage,
		setCleanupDays,
		setFontScale,
		setPageVisible,
		updatePageSettings,
		replaceAll,
	};
});
