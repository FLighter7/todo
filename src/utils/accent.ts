import type { Hex } from '@/types';
import { blend, contrastRatio } from './contrast';
import { hexToOklch, oklchToHex } from './oklch';

/** Vuetify's tonal variant: the colour at 12% over the surface, with the colour as its text. */
const TONAL = 0.12;

/** WCAG 1.4.11: the parts of a control a user has to see to find it. */
const CONTROL_RATIO = 3;

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
 * `seed` kept as it is when `accepts` takes it. Otherwise it keeps its hue and
 * chroma and moves in lightness alone -- darker on a light `background`,
 * lighter on a dark one -- to the nearest point it takes. Black passes
 * every check this app makes on a light palette, white on a dark one.
 */
function fitLightness(seed: Hex, background: Hex, accepts: (color: Hex) => boolean): Hex {
	if (accepts(seed)) {
		return seed;
	}

	const { l, c, h } = hexToOklch(seed);
	const darker = contrastRatio(background, '#000000') > contrastRatio(background, '#FFFFFF');

	// The search closes in on the edge from the side that passes, so whatever
	// it stops on passes too.
	let passing = darker ? 0 : 1;
	let failing = l;
	for (let step = 0; step < 24; step++) {
		const middle = (passing + failing) / 2;
		if (accepts(oklchToHex({ l: middle, c, h }))) {
			passing = middle;
		} else {
			failing = middle;
		}
	}

	return oklchToHex({ l: passing, c, h });
}

/**
 * `seed` as a palette's primary colour. The primary colour is text on every
 * background the palette has and on its own tonal tint, the fill behind text
 * in the background colour, and the focus ring, so it has to stand `minRatio`
 * apart from all of them. A seed that already does is kept as it is; any other
 * moves in lightness alone to the nearest point that passes.
 *
 * The background colour is the text on it: it stands as far from the primary
 * colour as the primary colour stands from the background.
 */
export function fitAccent(seed: Hex, colors: AccentBackdrops, minRatio: number): FittedAccent {
	return {
		primary: fitLightness(seed, colors.background, (color) => passes(color, colors, minRatio)),
		onPrimary: colors.background,
	};
}

/** The backgrounds a list, and the sections in it, sit on. */
export type SectionBackdrops = Readonly<Record<'background' | 'surface', Hex>>;

/**
 * The opacities a section colour is drawn at besides its full strength: a
 * row's note, and an empty checkbox, which Vuetify draws at medium emphasis.
 */
export interface SectionOpacities {
	note: number;
	control: number;
}

/**
 * `seed` as the colour of a section's border and legend, and of the names,
 * notes and checkboxes of the rows inside when it paints them. The note is the
 * faintest text drawn in it, so a colour whose note stands `minRatio` from
 * the background reads at full strength too; an empty checkbox, a control,
 * needs 3:1. A seed that already passes is kept as it is; any other moves in
 * lightness alone to the nearest point that passes.
 */
export function fitSectionColor(
	seed: Hex,
	colors: SectionBackdrops,
	opacities: SectionOpacities,
	minRatio: number,
): Hex {
	return fitLightness(seed, colors.background, (color) =>
		[colors.background, colors.surface].every(
			(backdrop) =>
				contrastRatio(blend(color, backdrop, opacities.note), backdrop) >= minRatio &&
				contrastRatio(blend(color, backdrop, opacities.control), backdrop) >= CONTROL_RATIO,
		),
	);
}
