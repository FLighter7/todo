import { describe, expect, it } from 'vitest';
import { COLOR_SCHEMES, type Hex } from '@/types';
import { blend, contrastRatio } from '@/utils/contrast';
import { oklchToHex } from '@/utils/oklch';
import {
	ACCENT_SWATCHES,
	SCHEMES,
	STATUS_COLORS,
	THEME_MODES,
	paletteFor,
	textRatio,
	type PaletteColors,
} from '../theme';

/** Vuetify's tonal variant: the colour at 12% over the surface, with the colour as text. */
const TONAL = 0.12;

const CONTROL = 3;

function backgroundsOf(colors: PaletteColors): Record<string, Hex> {
	return {
		background: colors.background,
		surface: colors.surface,
		'surface-variant': colors['surface-variant'],
		'primary tint': blend(colors.primary, colors.surface, TONAL),
	};
}

/**
 * Every pair the primary colour is drawn in: as text, as the fill behind its
 * on-colour, and as the focus ring. Apart, so that every accent a user can
 * pick is held to it too. `label` names the accent in a failure.
 */
function expectPrimaryReadable(colors: PaletteColors, text: number, label = 'primary'): void {
	const { primary } = colors;
	for (const backdrop of [
		colors.background,
		colors.surface,
		backgroundsOf(colors)['primary tint'],
	]) {
		expect(
			contrastRatio(primary, backdrop),
			`${label} as text on ${backdrop}`,
		).toBeGreaterThanOrEqual(text);
	}
	expect(contrastRatio(colors['on-primary'], primary), `text on ${label}`).toBeGreaterThanOrEqual(
		text,
	);
	for (const [where, backdrop] of Object.entries(backgroundsOf(colors))) {
		expect(
			contrastRatio(primary, backdrop),
			`${label} focus ring on ${where}`,
		).toBeGreaterThanOrEqual(CONTROL);
	}
}

// Every pair the app draws, per scheme and mode: text against the backgrounds
// it sits on (WCAG 1.4.3, or 1.4.6 for a scheme held to AAA), and the edges a
// user has to see to find or read a control (1.4.11).
for (const scheme of COLOR_SCHEMES) {
	const { level } = SCHEMES[scheme];
	const TEXT = textRatio(level);

	for (const mode of THEME_MODES) {
		const { colors, variables } = SCHEMES[scheme][mode];
		const high = variables['high-emphasis-opacity'];
		const medium = variables['medium-emphasis-opacity'];
		const text = colors['on-surface'];
		const backgrounds = backgroundsOf(colors);

		describe(`${scheme} scheme, ${mode}`, () => {
			for (const [where, backdrop] of Object.entries(backgrounds)) {
				it(`draws body and secondary text on ${where} at ${TEXT}:1`, () => {
					expect(contrastRatio(blend(text, backdrop, high), backdrop)).toBeGreaterThanOrEqual(TEXT);
					expect(contrastRatio(blend(text, backdrop, medium), backdrop)).toBeGreaterThanOrEqual(
						TEXT,
					);
				});
			}

			it(`draws muted text at ${TEXT}:1`, () => {
				for (const backdrop of [colors.background, colors.surface]) {
					expect(contrastRatio(colors['on-surface-variant'], backdrop)).toBeGreaterThanOrEqual(
						TEXT,
					);
				}
			});

			it(`draws primary text, text on primary and the focus ring at ${TEXT}:1 and ${CONTROL}:1`, () => {
				expectPrimaryReadable(colors, TEXT);
			});

			for (const status of STATUS_COLORS) {
				it(`draws ${status} text plain, in a tonal alert and filled at ${TEXT}:1`, () => {
					const color = colors[status];
					expect(contrastRatio(color, colors.surface)).toBeGreaterThanOrEqual(TEXT);
					expect(contrastRatio(color, blend(color, colors.surface, TONAL))).toBeGreaterThanOrEqual(
						TEXT,
					);
					expect(contrastRatio(colors[`on-${status}`], color)).toBeGreaterThanOrEqual(TEXT);
				});
			}

			it(`draws field borders, off switches and checkbox outlines at ${CONTROL}:1`, () => {
				const surface = colors.surface;
				const border = variables['app-field-border-opacity'];
				expect(contrastRatio(blend(text, surface, border), surface)).toBeGreaterThanOrEqual(
					CONTROL,
				);
				expect(contrastRatio(colors['on-surface-variant'], surface)).toBeGreaterThanOrEqual(
					CONTROL,
				);
				expect(contrastRatio(blend(text, surface, medium), surface)).toBeGreaterThanOrEqual(
					CONTROL,
				);
			});
		});
	}
}

/**
 * Colours a user could pick by hand: every 15° of hue at three lightnesses
 * and three chromas, and the ones furthest from any palette's own.
 */
const CUSTOM_SEEDS: Hex[] = [
	...Array.from({ length: 24 }, (_, step) => step * 15).flatMap((h) =>
		[0.3, 0.55, 0.85].flatMap((l) => [0.05, 0.15, 0.3].map((c) => oklchToHex({ l, c, h }))),
	),
	'#000000',
	'#FFFFFF',
	'#808080',
	'#FFFF00',
	'#00FFFF',
	'#FF00FF',
];

describe('accents', () => {
	for (const scheme of COLOR_SCHEMES) {
		const TEXT = textRatio(SCHEMES[scheme].level);

		for (const mode of THEME_MODES) {
			it(`fits every swatch into the ${scheme} scheme, ${mode}`, () => {
				for (const { id, seed } of ACCENT_SWATCHES) {
					expectPrimaryReadable(paletteFor(scheme, mode, seed).colors, TEXT, id);
				}
			});

			it(`fits any colour picked by hand into the ${scheme} scheme, ${mode}`, () => {
				for (const seed of CUSTOM_SEEDS) {
					expectPrimaryReadable(paletteFor(scheme, mode, seed).colors, TEXT, seed);
				}
			});
		}
	}
});
