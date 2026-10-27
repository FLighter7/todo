/** A colour as `#RRGGBB`, the only form this app's theme uses. */
export type Hex = `#${string}`;

type Rgb = [number, number, number];

function parse(hex: Hex): Rgb {
	const value = Number.parseInt(hex.slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function channel(value: number): number {
	const v = value / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgb): number {
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** `color` laid over `backdrop` at `alpha`, the way an opacity or an emphasis level draws it. */
export function blend(color: Hex, backdrop: Hex, alpha: number): Hex {
	const top = parse(color);
	const bottom = parse(backdrop);
	const mixed = top.map((value, index) => Math.round(value * alpha + bottom[index] * (1 - alpha)));
	return `#${mixed.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

/** The WCAG 2 contrast ratio, from 1 to 21. */
export function contrastRatio(a: Hex, b: Hex): number {
	const [light, dark] = [luminance(parse(a)), luminance(parse(b))].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}
