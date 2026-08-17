// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types';
import { settingsService } from '@/services/settings/SettingsService';
import { detectLocale } from '@/i18n';

function stubLanguages(languages: string[]): void {
	Object.defineProperty(window.navigator, 'languages', {
		value: languages,
		configurable: true,
	});
}

const originalLanguages = window.navigator.languages;

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	Object.defineProperty(window.navigator, 'languages', {
		value: originalLanguages,
		configurable: true,
	});
});

describe('detectLocale', () => {
	it('returns the stored locale without consulting navigator.languages', () => {
		settingsService.save({
			...DEFAULT_SETTINGS,
			general: { ...DEFAULT_SETTINGS.general, locale: 'pl' },
		});
		stubLanguages(['en-US']);

		expect(detectLocale()).toBe('pl');
	});

	it('matches the first supported locale found in navigator.languages, in preference order', () => {
		stubLanguages(['de-DE', 'ru-RU', 'en-US']);

		expect(detectLocale()).toBe('ru');
	});

	it('falls back to English when no preferred language is supported', () => {
		stubLanguages(['de-DE', 'fr-FR']);

		expect(detectLocale()).toBe('en');
	});

	it('falls back to scanning navigator.languages when the stored settings are corrupt', () => {
		window.localStorage.setItem('todo.settings', '{not json');
		stubLanguages(['ru-RU']);

		expect(detectLocale()).toBe('ru');
	});
});
