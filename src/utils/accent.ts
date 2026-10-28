import type { Hex } from '@/types';
import { blend, contrastRatio } from './contrast';
import { hexToOklch, oklchToHex } from './oklch';

/** Vuetify's tonal variant: the colour at 12% over the surface, with the colour as its text. */
const TONAL = 0.12;

/** The backgrounds a palette draws its primary colour on. */
export type AccentBackdrops = Readonly<Record<'background' | 'surface' | 'surface-variant', Hex>>;

export interface FittedAccent {
	primary: Hex;
	onPrimary: Hex;
}

function passes(primary: Hex, colors: AccentBackdrops, minRatio: number): boolean {
	const backdrops = [
		colors.background,
		colors.surface,
		colors['surface-variant'],
		blend(primary, colors.surface, TONAL),
	];
	return backdrops.every((backdrop) => contrastRatio(primary, backdrop) >= minRatio);
}

/**
 * `seed` as a palette's primary colour. The primary colour is text on every
 * background the palette has and on its own tonal tint, the fill behind text
 * in the background colour, and the focus ring, so it has to stand `minRatio`
 * apart from all of them. A seed that already does is kept as it is. Any other
 * keeps its hue and chroma and moves in lightness alone -- darker on a light
 * palette, lighter on a dark one -- to the nearest point that passes. There
 * always is one: black passes on every light palette this app draws, white on
 * every dark one.
 *
 * The background colour is the text on it: it stands as far from the primary
 * colour as the primary colour stands from the background.
 */
export function fitAccent(seed: Hex, colors: AccentBackdrops, minRatio: number): FittedAccent {
	const onPrimary = colors.background;
	if (passes(seed, colors, minRatio)) {
		return { primary: seed, onPrimary };
	}

	const { l, c, h } = hexToOklch(seed);
	const darker =
		contrastRatio(colors.background, '#000000') > contrastRatio(colors.background, '#FFFFFF');

	// The search closes in on the edge from the side that passes, so whatever
	// it stops on passes too.
	let passing = darker ? 0 : 1;
	let failing = l;
	for (let step = 0; step < 24; step++) {
		const middle = (passing + failing) / 2;
		if (passes(oklchToHex({ l: middle, c, h }), colors, minRatio)) {
			passing = middle;
		} else {
			failing = middle;
		}
	}

	return { primary: oklchToHex({ l: passing, c, h }), onPrimary };
}
