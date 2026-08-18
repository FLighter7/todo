import { describe, expect, it } from 'vitest';
import { slavicPluralRule } from './pluralRules';

describe('slavicPluralRule with three forms (one/few/many)', () => {
	it('picks "one" for numbers ending in 1, except 11', () => {
		expect(slavicPluralRule(1, 3)).toBe(0);
		expect(slavicPluralRule(21, 3)).toBe(0);
		expect(slavicPluralRule(101, 3)).toBe(0);
	});

	it('picks "few" for numbers ending in 2-4, except 12-14', () => {
		expect(slavicPluralRule(2, 3)).toBe(1);
		expect(slavicPluralRule(3, 3)).toBe(1);
		expect(slavicPluralRule(4, 3)).toBe(1);
		expect(slavicPluralRule(22, 3)).toBe(1);
	});

	it('picks "many" for 0, for numbers ending in 5-9 or 0, and for the 11-14 exception', () => {
		expect(slavicPluralRule(0, 3)).toBe(2);
		expect(slavicPluralRule(5, 3)).toBe(2);
		expect(slavicPluralRule(11, 3)).toBe(2);
		expect(slavicPluralRule(12, 3)).toBe(2);
		expect(slavicPluralRule(13, 3)).toBe(2);
		expect(slavicPluralRule(14, 3)).toBe(2);
		expect(slavicPluralRule(20, 3)).toBe(2);
	});
});

describe('slavicPluralRule with two forms', () => {
	it('falls back to a plain singular/other split when a message has only two forms', () => {
		expect(slavicPluralRule(1, 2)).toBe(0);
		expect(slavicPluralRule(2, 2)).toBe(1);
		expect(slavicPluralRule(5, 2)).toBe(1);
	});
});
