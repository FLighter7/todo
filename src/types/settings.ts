import { isRecordObject } from './item';

export type AppTheme = 'light' | 'dark' | 'system';

const SORT_ORDERS = ['newest', 'oldest', 'az', 'za'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

/**
 * Multipliers of the root font size, smallest first; 1 is the browser's own
 * default. At a 16px base they land on whole pixels: 14, 16, 18, 20, 24.
 */
export const FONT_SCALES = [0.875, 1, 1.125, 1.25, 1.5] as const;
export type FontScale = (typeof FONT_SCALES)[number];

/**
 * The pages that can be switched off in Settings, named after their routes.
 * The order is the one a hidden start page falls back along: the first page
 * still shown takes over, Tasks first.
 */
export const APP_PAGES = ['tasks', 'matrix', 'dreams', 'goals', 'groups'] as const;
export type AppPage = (typeof APP_PAGES)[number];

export interface PageSettings {
	rows: 1 | 2;
	confirmDone: boolean;
	confirmReopen: boolean;
	sortOrder: SortOrder;
}

export interface AppSettings {
	general: {
		theme: AppTheme;
		locale: string;
		startPage: string;
		cleanupDays: 30 | 60 | 90;
		fontScale: FontScale;
		/**
		 * Whether each page is shown; a hidden one is gone from the whole
		 * interface. At least one always is, see `enforcePageRules`.
		 */
		pages: Record<AppPage, boolean>;
	};
	dreams: PageSettings;
	goals: PageSettings;
	groups: PageSettings;
	tasks: PageSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
	general: {
		theme: 'system',
		locale: 'en',
		startPage: 'tasks',
		cleanupDays: 30,
		fontScale: 1,
		pages: { tasks: true, matrix: true, dreams: true, goals: true, groups: true },
	},
	dreams: { rows: 1, confirmDone: false, confirmReopen: false, sortOrder: 'newest' },
	goals: { rows: 1, confirmDone: false, confirmReopen: false, sortOrder: 'newest' },
	groups: { rows: 1, confirmDone: false, confirmReopen: false, sortOrder: 'newest' },
	tasks: { rows: 1, confirmDone: false, confirmReopen: false, sortOrder: 'newest' },
};

function isAppPage(page: string): page is AppPage {
	return (APP_PAGES as readonly string[]).includes(page);
}

/** True only for a page switched off in Settings; Settings and Sync themselves never are. */
export function isPageHidden(settings: Pick<AppSettings, 'general'>, page: string): boolean {
	return isAppPage(page) && !settings.general.pages[page];
}

/**
 * The two rules the set of pages lives by, applied in place. With every page
 * switched off, Tasks is the one left; and the start page is always a shown
 * one, or the app would open on a page it refuses to show.
 */
export function enforcePageRules(settings: Pick<AppSettings, 'general'>): void {
	const general = settings.general;
	if (!APP_PAGES.some((page) => general.pages[page])) {
		general.pages.tasks = true;
	}

	if (!isAppPage(general.startPage) || !general.pages[general.startPage]) {
		general.startPage = APP_PAGES.find((page) => general.pages[page]) ?? 'tasks';
	}
}

/**
 * A copy that shares no object with `settings`: every section, and
 * `general.pages` inside the first one.
 */
export function cloneSettings(settings: AppSettings): AppSettings {
	return {
		general: { ...settings.general, pages: { ...settings.general.pages } },
		dreams: { ...settings.dreams },
		goals: { ...settings.goals },
		groups: { ...settings.groups },
		tasks: { ...settings.tasks },
	};
}

/**
 * Its own error type, not `ItemFormatError`: settings have no `ItemBase`
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

/**
 * Defaults when absent rather than failing: a settings document saved before
 * this field existed -- in localStorage, a backup or a sync peer -- would
 * otherwise fail as a whole, and `loadRaw()` would silently reset every
 * other setting along with it.
 */
function parseFontScale(value: unknown): FontScale {
	if (value === undefined) {
		return 1;
	}

	if (typeof value !== 'number' || !(FONT_SCALES as readonly number[]).includes(value)) {
		fail(`"fontScale" must be one of ${FONT_SCALES.join(', ')}`);
	}

	return value as FontScale;
}

/** Defaults when absent, for the same reason as `fontScale`. */
function parsePages(value: unknown): Record<AppPage, boolean> {
	if (value === undefined) {
		return { ...DEFAULT_SETTINGS.general.pages };
	}

	if (!isRecordObject(value)) {
		fail('"pages" must be an object');
	}

	// Page by page, too: a document saved before a page could be switched off
	// lacks its key, and that page is shown.
	const pages = { ...DEFAULT_SETTINGS.general.pages };
	for (const page of APP_PAGES) {
		if (value[page] !== undefined) {
			pages[page] = readBoolean(value, page);
		}
	}

	return pages;
}

function parseRows(value: unknown): 1 | 2 {
	if (value !== 1 && value !== 2) {
		fail('"rows" must be 1 or 2');
	}

	return value;
}

function parseSortOrder(value: unknown): SortOrder {
	if (value === undefined) {
		return 'newest';
	}

	if (typeof value !== 'string' || !(SORT_ORDERS as readonly string[]).includes(value)) {
		fail('"sortOrder" must be "newest", "oldest", "az" or "za"');
	}

	return value as SortOrder;
}

function parsePageSettings(value: unknown, key: string): PageSettings {
	if (!isRecordObject(value)) {
		fail(`"${key}" must be an object`);
	}

	return {
		rows: parseRows(value.rows),
		confirmDone: readBoolean(value, 'confirmDone'),
		confirmReopen: readBoolean(value, 'confirmReopen'),
		sortOrder: parseSortOrder(value.sortOrder),
	};
}

/**
 * Defaults when absent, for the same reason as `fontScale`: every settings
 * document saved before the Groups page existed lacks this section.
 */
function parseGroupsPageSettings(value: unknown): PageSettings {
	return value === undefined ? { ...DEFAULT_SETTINGS.groups } : parsePageSettings(value, 'groups');
}

export function parseSettings(value: unknown): AppSettings {
	if (!isRecordObject(value)) {
		fail('the settings document is not an object');
	}

	const general = value.general;
	if (!isRecordObject(general)) {
		fail('"general" must be an object');
	}

	const settings: AppSettings = {
		general: {
			theme: parseTheme(general.theme),
			locale: readNonEmptyString(general, 'locale'),
			startPage: readNonEmptyString(general, 'startPage'),
			cleanupDays: parseCleanupDays(general.cleanupDays),
			fontScale: parseFontScale(general.fontScale),
			pages: parsePages(general.pages),
		},
		dreams: parsePageSettings(value.dreams, 'dreams'),
		goals: parsePageSettings(value.goals, 'goals'),
		groups: parseGroupsPageSettings(value.groups),
		tasks: parsePageSettings(value.tasks, 'tasks'),
	};

	// Whichever source the document came from: localStorage, a backup or a sync peer.
	enforcePageRules(settings);

	return settings;
}
