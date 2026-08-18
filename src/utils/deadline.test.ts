import { describe, expect, it, beforeEach } from 'vitest';
import { Season } from '@/types';
import { i18n } from '@/i18n';
import { formatDeadline } from './deadline';

const t = i18n.global.t;

describe('formatDeadline', () => {
	beforeEach(() => {
		i18n.global.locale.value = 'en';
	});

	it('formats a year alone', () => {
		expect(formatDeadline({ year: 2027 }, 'en', t)).toBe('2027');
	});

	it('formats a month with a year', () => {
		expect(formatDeadline({ year: 2027, month: 3 }, 'en', t)).toBe('March 2027');
	});

	it('formats a month without a year', () => {
		expect(formatDeadline({ month: 3 }, 'en', t)).toBe('March');
	});

	it('formats an exact day with a year', () => {
		expect(formatDeadline({ year: 2027, month: 3, day: 15 }, 'en', t)).toBe('March 15, 2027');
	});

	it('formats an exact day without a year', () => {
		expect(formatDeadline({ month: 3, day: 15 }, 'en', t)).toBe('March 15');
	});

	it('formats a season with a year', () => {
		expect(formatDeadline({ year: 2027, season: Season.Summer }, 'en', t)).toBe('Summer 2027');
	});

	it('formats a season without a year', () => {
		expect(formatDeadline({ season: Season.Winter }, 'en', t)).toBe('Winter');
	});

	it('formats in a different locale', () => {
		i18n.global.locale.value = 'ru';
		expect(formatDeadline({ year: 2027, season: Season.Winter }, 'ru', t)).toBe('Зима 2027');
	});

	it('formats a day that does not exist in a non-leap year without rolling into the next month', () => {
		// 2027 is not a leap year, so 29 February does not exist.
		expect(formatDeadline({ year: 2027, month: 2, day: 29 }, 'en', t)).toBe('February 29, 2027');
	});

	it('formats a day past the end of the month without rolling into the next month', () => {
		// February never has 31 days.
		expect(formatDeadline({ year: 2027, month: 2, day: 31 }, 'en', t)).toBe('February 31, 2027');
	});

	it('formats an impossible day correctly in a different locale too', () => {
		i18n.global.locale.value = 'ru';
		// Node's Intl.formatToParts inserts a narrow no-break space (U+202F)
		// before the "г." era abbreviation, unlike .format()'s plain space.
		expect(formatDeadline({ year: 2027, month: 2, day: 29 }, 'ru', t)).toBe('29 февраля 2027 г.');
	});
});
