import { fail, readOptionalBoolean } from './item';

/** A colour as `#RRGGBB`, the only form this app's theme and settings use. */
export type Hex = `#${string}`;

export function isHex(value: unknown): value is Hex {
	return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}

/**
 * The colour a dream, goal or group gives the section it heads, as the user
 * picked it: each palette draws it lighter or darker as it needs, the way it
 * does the accent. Without one the section stays the palette's own grey.
 */
export interface SectionColor {
	color?: Hex;
	/** The rows inside take the colour too: their names, notes and checkboxes. */
	paintItems?: boolean;
}

export function readSectionColor(entry: Record<string, unknown>): SectionColor {
	const color = entry.color;
	if (color !== undefined && !isHex(color)) {
		fail('"color" must be a #RRGGBB colour when present');
	}

	return { color, paintItems: readOptionalBoolean(entry, 'paintItems') };
}
