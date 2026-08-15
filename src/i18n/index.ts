import { createI18n } from 'vue-i18n';
import usFlag from 'flag-icons/flags/4x3/us.svg';
import ruFlag from 'flag-icons/flags/4x3/ru.svg';
import plFlag from 'flag-icons/flags/4x3/pl.svg';
import en from './locales/en.json';
import ru from './locales/ru.json';
import pl from './locales/pl.json';

const LOCALE_STORAGE_KEY = 'todo.locale';

export const SUPPORTED_LOCALES = ['en', 'ru', 'pl'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Autonyms for the language picker -- each name is written in its own language. */
export const LOCALE_NAMES: Record<AppLocale, string> = {
	en: 'English',
	ru: 'Русский',
	pl: 'Polski',
};

/** English has no single national flag -- the US flag is the chosen stand-in. */
export const LOCALE_FLAGS: Record<AppLocale, string> = {
	en: usFlag,
	ru: ruFlag,
	pl: plFlag,
};

function isSupported(value: string | null): value is AppLocale {
	return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * There's no backend to read a real Accept-Language header from, so
 * navigator.languages (the browser's own ordered preference list) is the
 * closest client-side equivalent.
 */
export function detectLocale(): AppLocale {
	const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
	if (isSupported(stored)) {
		return stored;
	}

	for (const preferred of navigator.languages ?? [navigator.language]) {
		const match = SUPPORTED_LOCALES.find((locale) => preferred.toLowerCase().startsWith(locale));
		if (match) return match;
	}

	return 'en';
}

/** Resolved once at startup so Vuetify can start on the same locale as the app. */
export const initialLocale = detectLocale();

export const i18n = createI18n({
	legacy: false,
	locale: initialLocale,
	fallbackLocale: 'en',
	messages: { en, ru, pl },
});

export function setLocale(locale: AppLocale): void {
	i18n.global.locale.value = locale;
	localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
