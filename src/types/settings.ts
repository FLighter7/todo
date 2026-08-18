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
	general: { theme: 'system', locale: 'en', startPage: 'tasks', cleanupDays: 30 },
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
