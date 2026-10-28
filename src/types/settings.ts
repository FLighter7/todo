import { isHex, type Hex } from './color';
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
 * The colour schemes, in the order Settings offers them. Each has a light and
 * a dark version, which `theme` picks between; see plugins/theme.ts.
 */
export const COLOR_SCHEMES = ['standard', 'neutral', 'cool', 'black', 'contrast'] as const;
export type ColorScheme = (typeof COLOR_SCHEMES)[number];

/**
 * The pages that can be switched off in Settings, named after their routes.
 * The order is the one a hidden start page falls back along (the user's
 * choice): the first page still shown takes over.
 */
export const APP_PAGES = ['tasks', 'matrix', 'goals', 'dreams', 'groups'] as const;
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
		/** Picks the palette; `theme` picks its light or dark version. */
		scheme: ColorScheme;
		/**
		 * The colour the user picked to replace the scheme's primary colour, or
		 * null for the scheme's own. A seed: each palette draws it as dark or as
		 * light as its backgrounds need, see `fitAccent`.
		 */
		accent: Hex | null;
		locale: string;
		startPage: string;
		cleanupDays: 30 | 60 | 90;
		fontScale: FontScale;
		/**
		 * Whether each page is shown; a hidden one is gone from the whole
		 * interface. All of them may be off, see `isPageHidden`.
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
		scheme: 'standard',
		accent: null,
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

/**
 * True only for a page that cannot be opened; Settings and Sync themselves
 * never are. A page switched off in Settings is, except that with every page
 * off, Tasks stays as the one page left: not in the bottom bar, which then
 * holds the add button alone, but the page the app opens on and returns to.
 */
export function isPageHidden(settings: Pick<AppSettings, 'general'>, page: string): boolean {
	if (!isAppPage(page)) {
		return false;
	}

	const pages = settings.general.pages;
	if (page === 'tasks' && !APP_PAGES.some((other) => pages[other])) {
		return false;
	}

	return !pages[page];
}

/** The page a hidden start page hands its role to. Never undefined: see `isPageHidden`. */
export function firstShownPage(settings: Pick<AppSettings, 'general'>): AppPage {
	return APP_PAGES.find((page) => !isPageHidden(settings, page)) ?? 'tasks';
}

/**
 * Applied in place: the start page is always one that can be opened, or the
 * app would open on a page it refuses to show.
 */
export function keepStartPageShown(settings: Pick<AppSettings, 'general'>): void {
	const general = settings.general;
	if (!isAppPage(general.startPage) || isPageHidden(settings, general.startPage)) {
		general.startPage = firstShownPage(settings);
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

/** Defaults when absent, for the same reason as `fontScale`. */
function parseScheme(value: unknown): ColorScheme {
	if (value === undefined) {
		return 'standard';
	}

	if (typeof value !== 'string' || !(COLOR_SCHEMES as readonly string[]).includes(value)) {
		fail(`"scheme" must be one of ${COLOR_SCHEMES.join(', ')}`);
	}

	return value as ColorScheme;
}

/** Defaults when absent, for the same reason as `fontScale`. */
function parseAccent(value: unknown): Hex | null {
	if (value === undefined || value === null) {
		return null;
	}

	if (!isHex(value)) {
		fail('"accent" must be null or a colour as #RRGGBB');
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
			scheme: parseScheme(general.scheme),
			accent: parseAccent(general.accent),
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
	keepStartPageShown(settings);

	return settings;
}
