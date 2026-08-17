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
