import { createI18n } from 'vue-i18n';
import en from './en';
import ru from './ru';

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

export const i18n = createI18n({
	legacy: false,
	locale: detectLocale(),
	fallbackLocale: 'en',
	messages: { en, ru },
});

export function setLocale(locale: AppLocale): void {
	i18n.global.locale.value = locale;
	localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
