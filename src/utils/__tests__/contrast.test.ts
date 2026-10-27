import { describe, expect, it } from 'vitest';
import { blend, contrastRatio } from '../contrast';

describe('contrastRatio', () => {
	it('spans 1 to 21 between identical colours and black on white', () => {
		expect(contrastRatio('#777777', '#777777')).toBe(1);
		expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
	});

	it('is the same whichever colour comes first', () => {
		expect(contrastRatio('#2F5D50', '#F6F4EF')).toBe(contrastRatio('#F6F4EF', '#2F5D50'));
	});

	it('matches the WCAG reference value for mid grey on white', () => {
		expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
	});
});

describe('blend', () => {
	it('returns the colour at full opacity and the backdrop at none', () => {
		expect(blend('#2B2A26', '#F6F4EF', 1)).toBe('#2b2a26');
		expect(blend('#2B2A26', '#F6F4EF', 0)).toBe('#f6f4ef');
	});

	it('mixes each channel by the opacity', () => {
		expect(blend('#000000', '#FFFFFF', 0.5)).toBe('#808080');
	});
});
