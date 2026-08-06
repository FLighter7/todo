import { createI18n } from 'vue-i18n';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LOCALE_STORAGE_KEY = 'todo.locale';

export const SUPPORTED_LOCALES = ['en', 'ru'] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

function isSupported(value: string | null): value is AppLocale {
	return value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

function detectLocale(): AppLocale {
	const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
	if (isSupported(stored)) {
		return stored;
	}

	return navigator.language.startsWith('ru') ? 'ru' : 'en';
}

/** Resolved once at startup so Vuetify can start on the same locale as the app. */
export const initialLocale = detectLocale();

export const i18n = createI18n({
	legacy: false,
	locale: initialLocale,
	fallbackLocale: 'en',
	messages: { en, ru },
});

export function setLocale(locale: AppLocale): void {
	i18n.global.locale.value = locale;
	localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
