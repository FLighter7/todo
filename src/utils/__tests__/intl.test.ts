import { describe, expect, it } from 'vitest';
import { dateTimeFormat } from '../intl';

describe('dateTimeFormat', () => {
	it('hands back the same formatter for the same locale and options', () => {
		const first = dateTimeFormat('ru', { month: 'long', year: 'numeric' });

		expect(dateTimeFormat('ru', { month: 'long', year: 'numeric' })).toBe(first);
	});

	it('keeps formatters apart by locale and by options', () => {
		const russian = dateTimeFormat('ru', { month: 'long' });

		expect(dateTimeFormat('en', { month: 'long' })).not.toBe(russian);
		expect(dateTimeFormat('ru', { month: 'short' })).not.toBe(russian);
	});

	it('treats an undefined option as absent, the way Intl does', () => {
		expect(dateTimeFormat('pl', { day: undefined, month: 'long' })).toBe(
			dateTimeFormat('pl', { month: 'long' }),
		);
	});

	it('formats exactly as a fresh formatter would', () => {
		const date = new Date(Date.UTC(2027, 2, 14, 9, 30));
		const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' };

		expect(dateTimeFormat('ru', options).format(date)).toBe(
			new Intl.DateTimeFormat('ru', options).format(date),
		);
	});
});
