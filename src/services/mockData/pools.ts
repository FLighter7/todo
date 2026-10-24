import type { AppLocale } from '@/i18n';
import en from '@/i18n/locales/mockData/en.json';
import ru from '@/i18n/locales/mockData/ru.json';
import pl from '@/i18n/locales/mockData/pl.json';

export interface MockContentPool {
	dreamNames: string[];
	goalNames: string[];
	groupNames: string[];
	taskNames: string[];
	notes: string[];
}

export const POOLS: Record<AppLocale, MockContentPool> = { en, ru, pl };
