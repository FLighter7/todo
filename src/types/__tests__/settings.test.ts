import { describe, expect, it } from 'vitest';
import {
	DEFAULT_SETTINGS,
	SettingsFormatError,
	cloneSettings,
	isPageHidden,
	parseSettings,
} from '../settings';

function validRaw(): Record<string, unknown> {
	return {
		general: { theme: 'system', locale: 'en', startPage: 'tasks', cleanupDays: 30 },
		dreams: { rows: 1, confirmDone: false, confirmReopen: false },
		goals: { rows: 1, confirmDone: false, confirmReopen: false },
		tasks: { rows: 1, confirmDone: false, confirmReopen: false },
	};
}

function pageBlock(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return { rows: 1, confirmDone: false, confirmReopen: false, ...overrides };
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
			general: { theme: 'blue', locale: 'en', startPage: 'tasks', cleanupDays: 30 },
		};
		expect(() => parseSettings(raw)).toThrow(/theme/);
	});

	it('rejects a missing locale', () => {
		const raw = {
			...validRaw(),
			general: { theme: 'system', startPage: 'tasks', cleanupDays: 30 },
		};
		expect(() => parseSettings(raw)).toThrow(/locale/);
	});

	it('rejects an empty-string locale', () => {
		const raw = {
			...validRaw(),
			general: { theme: 'system', locale: '', startPage: 'tasks', cleanupDays: 30 },
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
			general: { theme: 'system', locale: 'en', startPage: 'tasks', cleanupDays: 45 },
		};
		expect(() => parseSettings(raw)).toThrow(/cleanupDays/);
	});

	it('defaults the groups section when absent, as in every document saved before groups', () => {
		expect(parseSettings(validRaw()).groups).toEqual(DEFAULT_SETTINGS.groups);
	});

	it('keeps a present groups section, and rejects a malformed one', () => {
		const groups = { rows: 1, confirmDone: true, confirmReopen: true, sortOrder: 'za' };

		expect(parseSettings({ ...validRaw(), groups }).groups).toEqual(groups);
		expect(() => parseSettings({ ...validRaw(), groups: 'nope' })).toThrow(/"groups"/);
		expect(() =>
			parseSettings({ ...validRaw(), groups: { ...groups, confirmDone: 'yes' } }),
		).toThrow(SettingsFormatError);
	});

	it('defaults fontScale to 1 when absent', () => {
		expect(parseSettings(validRaw()).general.fontScale).toBe(1);
	});

	it('accepts a present valid fontScale', () => {
		const raw = {
			...validRaw(),
			general: {
				theme: 'system',
				locale: 'en',
				startPage: 'tasks',
				cleanupDays: 30,
				fontScale: 1.25,
			},
		};
		expect(parseSettings(raw).general.fontScale).toBe(1.25);
	});

	it.each([1.3, 0, '1.25', null])('rejects a fontScale of %s', (fontScale) => {
		const raw = {
			...validRaw(),
			general: { theme: 'system', locale: 'en', startPage: 'tasks', cleanupDays: 30, fontScale },
		};
		expect(() => parseSettings(raw)).toThrow(/fontScale/);
	});

	it('shows every page when "pages" is absent, as in every document saved before it', () => {
		expect(parseSettings(validRaw()).general.pages).toEqual(DEFAULT_SETTINGS.general.pages);
	});

	function withGeneral(general: Record<string, unknown>) {
		return { ...validRaw(), general: { ...(validRaw().general as object), ...general } };
	}

	it('keeps a present "pages", and rejects a malformed one', () => {
		const pages = { tasks: false, matrix: true, dreams: false, goals: true, groups: false };

		expect(parseSettings(withGeneral({ pages })).general.pages).toEqual(pages);
		expect(() => parseSettings(withGeneral({ pages: 'nope' }))).toThrow(/"pages"/);
		expect(() => parseSettings(withGeneral({ pages: { ...pages, goals: 'yes' } }))).toThrow(
			/"goals"/,
		);
	});

	it('shows a page whose key is missing, as in a document saved before it could be hidden', () => {
		const pages = { dreams: false, goals: true, groups: false };

		expect(parseSettings(withGeneral({ pages })).general.pages).toEqual({
			tasks: true,
			matrix: true,
			...pages,
		});
	});

	it('brings Tasks back when every page is switched off', () => {
		const pages = { tasks: false, matrix: false, dreams: false, goals: false, groups: false };

		expect(parseSettings(withGeneral({ pages })).general.pages).toEqual({ ...pages, tasks: true });
	});

	it('hands the start page back to tasks when it names a hidden page', () => {
		const raw = withGeneral({
			startPage: 'goals',
			pages: { dreams: true, goals: false, groups: true },
		});

		expect(parseSettings(raw).general.startPage).toBe('tasks');
	});

	it('hands the start page to the first page still shown when Tasks is hidden too', () => {
		const raw = withGeneral({
			startPage: 'goals',
			pages: { tasks: false, goals: false },
		});

		expect(parseSettings(raw).general.startPage).toBe('matrix');
	});

	it('keeps a start page that names a shown page', () => {
		const raw = withGeneral({
			startPage: 'goals',
			pages: { tasks: false, matrix: false, dreams: false, goals: true, groups: false },
		});

		expect(parseSettings(raw).general.startPage).toBe('goals');
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

	it.each(ENTITIES)('defaults "%s.sortOrder" to "newest" when absent', (key) => {
		const raw = validRaw();
		raw[key] = pageBlock();
		expect(parseSettings(raw)[key].sortOrder).toBe('newest');
	});

	it.each(ENTITIES)('accepts a present valid "%s.sortOrder"', (key) => {
		const raw = validRaw();
		raw[key] = pageBlock({ sortOrder: 'za' });
		expect(parseSettings(raw)[key].sortOrder).toBe('za');
	});

	it.each(ENTITIES)('rejects an invalid "%s.sortOrder"', (key) => {
		const raw = validRaw();
		raw[key] = pageBlock({ sortOrder: 'random' });
		expect(() => parseSettings(raw)).toThrow(/sortOrder/);
	});
});

describe('isPageHidden', () => {
	it('is true only for a page switched off', () => {
		const settings = cloneSettings(DEFAULT_SETTINGS);
		settings.general.pages.groups = false;

		expect(isPageHidden(settings, 'groups')).toBe(true);
		expect(isPageHidden(settings, 'goals')).toBe(false);
		expect(isPageHidden(settings, 'tasks')).toBe(false);
		expect(isPageHidden(settings, 'settings')).toBe(false);

		settings.general.pages.tasks = false;
		expect(isPageHidden(settings, 'tasks')).toBe(true);
	});
});

describe('cloneSettings', () => {
	it('shares no object with its source, the pages included', () => {
		const copy = cloneSettings(DEFAULT_SETTINGS);

		copy.general.pages.dreams = false;
		copy.tasks.rows = 2;

		expect(copy).not.toBe(DEFAULT_SETTINGS);
		expect(DEFAULT_SETTINGS.general.pages.dreams).toBe(true);
		expect(DEFAULT_SETTINGS.tasks.rows).toBe(1);
	});
});
