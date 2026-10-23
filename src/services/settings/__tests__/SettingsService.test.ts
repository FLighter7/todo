// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types';
import { SettingsService } from '../SettingsService';

beforeEach(() => {
	window.localStorage.clear();
});

describe('SettingsService.loadRaw', () => {
	it('returns null when nothing has ever been saved', () => {
		expect(new SettingsService().loadRaw()).toBeNull();
	});

	it('returns null when the stored value is not valid JSON', () => {
		window.localStorage.setItem('todo.settings', 'not json');
		expect(new SettingsService().loadRaw()).toBeNull();
	});

	it('returns null when the stored value is valid JSON but not a valid settings shape', () => {
		window.localStorage.setItem('todo.settings', JSON.stringify({ general: { theme: 'blue' } }));
		expect(new SettingsService().loadRaw()).toBeNull();
	});

	it('returns the stored settings when they are valid, even if they equal the defaults', () => {
		const service = new SettingsService();
		service.save(DEFAULT_SETTINGS);
		expect(service.loadRaw()).toEqual(DEFAULT_SETTINGS);
	});

	describe('when localStorage itself throws', () => {
		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('returns null instead of throwing', () => {
			vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
				throw new Error('blocked');
			});

			expect(() => new SettingsService().loadRaw()).not.toThrow();
			expect(new SettingsService().loadRaw()).toBeNull();
		});
	});
});

describe('SettingsService.load', () => {
	it('falls back to the defaults when nothing has been saved', () => {
		expect(new SettingsService().load()).toEqual(DEFAULT_SETTINGS);
	});

	it('falls back to the defaults when the stored value is corrupt', () => {
		window.localStorage.setItem('todo.settings', '{not json');
		expect(new SettingsService().load()).toEqual(DEFAULT_SETTINGS);
	});

	it('does not hand back the shared DEFAULT_SETTINGS object itself', () => {
		const loaded = new SettingsService().load();
		loaded.general.theme = 'dark';
		expect(DEFAULT_SETTINGS.general.theme).toBe('system');
	});

	it('reads back a saved value', () => {
		const service = new SettingsService();
		const custom = {
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, theme: 'dark' as const },
		};
		service.save(custom);
		expect(service.load()).toEqual(custom);
	});

	it('keeps every other setting of a document saved before fontScale existed', () => {
		const general = { theme: 'dark', locale: 'en', startPage: 'tasks', cleanupDays: 30 };
		localStorage.setItem('todo.settings', JSON.stringify({ ...DEFAULT_SETTINGS, general }));

		const loaded = new SettingsService().load();

		expect(loaded.general.theme).toBe('dark');
		expect(loaded.general.fontScale).toBe(1);
	});
});

describe('SettingsService.save', () => {
	it('round-trips through load', () => {
		const service = new SettingsService();
		const custom = {
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, cleanupDays: 90 as const },
		};

		service.save(custom);

		expect(service.load()).toEqual(custom);
	});
});
