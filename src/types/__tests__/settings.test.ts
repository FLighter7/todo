import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SettingsFormatError, parseSettings } from '../settings';

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
