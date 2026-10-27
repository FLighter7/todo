import { describe, expect, it } from 'vitest';
import { blend, contrastRatio, type Hex } from '@/utils/contrast';
import { THEMES } from '../theme';

/** The opacity of an outlined field's border, set in assets/styles/contrast.scss. */
const FIELD_BORDER_OPACITY = 0.55;

/** Vuetify's tonal variant: the colour at 12% over the surface, with the colour as text. */
const TONAL = 0.12;

const TEXT = 4.5;
const CONTROL = 3;

// Every pair the app draws, per theme: text against the backgrounds it sits on
// (WCAG 1.4.3), and the edges a user has to see to find or read a control (1.4.11).
for (const [name, { colors, variables }] of Object.entries(THEMES)) {
	const high = variables['high-emphasis-opacity'];
	const medium = variables['medium-emphasis-opacity'];
	const text = colors['on-surface'];
	const backgrounds: Record<string, Hex> = {
		background: colors.background,
		surface: colors.surface,
		'surface-variant': colors['surface-variant'],
		'primary tint': blend(colors.primary, colors.surface, TONAL),
	};

	describe(`${name} theme`, () => {
		for (const [where, backdrop] of Object.entries(backgrounds)) {
			it(`draws body and secondary text on ${where} at ${TEXT}:1`, () => {
				expect(contrastRatio(blend(text, backdrop, high), backdrop)).toBeGreaterThanOrEqual(TEXT);
				expect(contrastRatio(blend(text, backdrop, medium), backdrop)).toBeGreaterThanOrEqual(TEXT);
			});
		}

		it('draws muted text, primary text and text on primary at 4.5:1', () => {
			for (const backdrop of [colors.background, colors.surface]) {
				expect(contrastRatio(colors['on-surface-variant'], backdrop)).toBeGreaterThanOrEqual(TEXT);
				expect(contrastRatio(colors.primary, backdrop)).toBeGreaterThanOrEqual(TEXT);
			}
			expect(contrastRatio(colors.primary, backgrounds['primary tint'])).toBeGreaterThanOrEqual(
				TEXT,
			);
			expect(contrastRatio(colors['on-primary'], colors.primary)).toBeGreaterThanOrEqual(TEXT);
		});

		for (const status of ['error', 'info', 'success', 'warning']) {
			it(`draws ${status} text plain, in a tonal alert and filled at 4.5:1`, () => {
				const color = colors[status];
				expect(contrastRatio(color, colors.surface)).toBeGreaterThanOrEqual(TEXT);
				expect(contrastRatio(color, blend(color, colors.surface, TONAL))).toBeGreaterThanOrEqual(
					TEXT,
				);
				expect(contrastRatio(colors[`on-${status}`], color)).toBeGreaterThanOrEqual(TEXT);
			});
		}

		it('draws field borders, off switches and checkbox outlines at 3:1', () => {
			const surface = colors.surface;
			expect(
				contrastRatio(blend(text, surface, FIELD_BORDER_OPACITY), surface),
			).toBeGreaterThanOrEqual(CONTROL);
			expect(contrastRatio(colors['on-surface-variant'], surface)).toBeGreaterThanOrEqual(CONTROL);
			expect(contrastRatio(blend(text, surface, medium), surface)).toBeGreaterThanOrEqual(CONTROL);
		});

		for (const [where, backdrop] of Object.entries(backgrounds)) {
			it(`draws the focus ring on ${where} at 3:1`, () => {
				expect(contrastRatio(colors.primary, backdrop)).toBeGreaterThanOrEqual(CONTROL);
			});
		}
	});
}
