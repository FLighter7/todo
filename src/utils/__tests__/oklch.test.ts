import { describe, expect, it } from 'vitest';
import type { Hex } from '@/types';
import { hexToOklch, oklchToHex } from '../oklch';

describe('hexToOklch', () => {
	it('puts black and white at the ends of lightness, with no chroma', () => {
		expect(hexToOklch('#000000')).toMatchObject({ l: 0, c: 0 });
		const white = hexToOklch('#FFFFFF');
		expect(white.l).toBeCloseTo(1, 4);
		expect(white.c).toBeCloseTo(0, 4);
	});

	it('matches the published OKLCH of pure red', () => {
		const red = hexToOklch('#FF0000');
		expect(red.l).toBeCloseTo(0.628, 3);
		expect(red.c).toBeCloseTo(0.2577, 3);
		expect(red.h).toBeCloseTo(29.23, 1);
	});

	it('gives hue in degrees from 0 to 360', () => {
		const blue = hexToOklch('#0000FF');
		expect(blue.h).toBeGreaterThanOrEqual(0);
		expect(blue.h).toBeLessThan(360);
	});
});

describe('oklchToHex', () => {
	it.each<Hex>(['#2f5d50', '#74ac90', '#d81b60', '#ffb74d', '#000000', '#ffffff', '#808080'])(
		'gives %s back unchanged from its own OKLCH',
		(hex) => {
			expect(oklchToHex(hexToOklch(hex))).toBe(hex);
		},
	);

	it('gives up chroma, not lightness or hue, for a colour sRGB cannot show', () => {
		const fitted = hexToOklch(oklchToHex({ l: 0.5, c: 0.4, h: 140 }));
		expect(fitted.c).toBeLessThan(0.4);
		expect(fitted.l).toBeCloseTo(0.5, 2);
		expect(fitted.h).toBeCloseTo(140, 0);
	});

	it('clamps lightness outside 0 to 1 to black and white', () => {
		expect(oklchToHex({ l: -0.2, c: 0.1, h: 30 })).toBe('#000000');
		expect(oklchToHex({ l: 1.2, c: 0.1, h: 30 })).toBe('#ffffff');
	});
});
