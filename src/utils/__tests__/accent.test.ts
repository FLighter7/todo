import { describe, expect, it } from 'vitest';
import { fitAccent, fitSectionColor, type AccentBackdrops } from '../accent';
import { blend, contrastRatio } from '../contrast';
import { hexToOklch } from '../oklch';

const LIGHT: AccentBackdrops = {
	background: '#F6F4EF',
	surface: '#FBFAF6',
	'surface-variant': '#EAE5D8',
};

const DARK: AccentBackdrops = {
	background: '#1B1A17',
	surface: '#221F1A',
	'surface-variant': '#332E27',
};

describe('fitAccent', () => {
	it('keeps a seed that already stands far enough from every background', () => {
		expect(fitAccent('#2F5D50', LIGHT, 4.5).primary).toBe('#2F5D50');
		expect(fitAccent('#74AC90', DARK, 4.5).primary).toBe('#74AC90');
	});

	it('darkens a seed on a light palette and lightens it on a dark one', () => {
		const seed = hexToOklch('#EF6C00');
		expect(hexToOklch(fitAccent('#EF6C00', LIGHT, 4.5).primary).l).toBeLessThan(seed.l);

		const darkSeed = hexToOklch('#3F51B5');
		expect(hexToOklch(fitAccent('#3F51B5', DARK, 4.5).primary).l).toBeGreaterThan(darkSeed.l);
	});

	it('keeps the hue of a coloured seed', () => {
		for (const seed of ['#EF6C00', '#D81B60', '#1E6FD9'] as const) {
			for (const palette of [LIGHT, DARK]) {
				const fitted = hexToOklch(fitAccent(seed, palette, 4.5).primary);
				expect(Math.abs(fitted.h - hexToOklch(seed).h)).toBeLessThan(3);
			}
		}
	});

	it('moves no further than it has to', () => {
		const { primary } = fitAccent('#EF6C00', LIGHT, 4.5);
		expect(contrastRatio(primary, LIGHT['surface-variant'])).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(primary, LIGHT['surface-variant'])).toBeLessThan(4.8);
	});

	it('reaches a higher ratio when asked for one', () => {
		const { primary } = fitAccent('#1E6FD9', { ...LIGHT, background: '#FFFFFF' }, 7);
		expect(contrastRatio(primary, '#FFFFFF')).toBeGreaterThanOrEqual(7);
	});

	it('puts the background colour on the accent as its text', () => {
		expect(fitAccent('#D81B60', LIGHT, 4.5).onPrimary).toBe(LIGHT.background);
		expect(fitAccent('#D81B60', DARK, 4.5).onPrimary).toBe(DARK.background);
	});
});

describe('fitSectionColor', () => {
	const opacities = { note: 0.83, control: 0.72 };

	it('keeps a seed whose note already reads on the background and the surface', () => {
		expect(fitSectionColor('#2F5D50', LIGHT, opacities, 4.5)).toBe('#2F5D50');
		expect(fitSectionColor('#74AC90', DARK, opacities, 4.5)).toBe('#74AC90');
	});

	it('darkens a seed on a light palette and lightens it on a dark one, keeping its hue', () => {
		const orange = hexToOklch('#EF6C00');
		const light = hexToOklch(fitSectionColor('#EF6C00', LIGHT, opacities, 4.5));
		expect(light.l).toBeLessThan(orange.l);
		expect(Math.abs(light.h - orange.h)).toBeLessThan(3);

		const indigo = hexToOklch('#3F51B5');
		const dark = hexToOklch(fitSectionColor('#3F51B5', DARK, opacities, 4.5));
		expect(dark.l).toBeGreaterThan(indigo.l);
		expect(Math.abs(dark.h - indigo.h)).toBeLessThan(3);
	});

	it('fits the note, the faintest text drawn in it, not only the colour at full strength', () => {
		const color = fitSectionColor('#EF6C00', LIGHT, opacities, 4.5);
		const note = blend(color, LIGHT.background, opacities.note);

		expect(contrastRatio(note, LIGHT.background)).toBeGreaterThanOrEqual(4.5);
		expect(contrastRatio(note, LIGHT.background)).toBeLessThan(4.8);
	});

	it('reaches a higher ratio when asked for one', () => {
		const color = fitSectionColor(
			'#1E6FD9',
			{ background: '#FFFFFF', surface: '#FFFFFF' },
			{ note: 1, control: 1 },
			7,
		);
		expect(contrastRatio(color, '#FFFFFF')).toBeGreaterThanOrEqual(7);
	});
});
