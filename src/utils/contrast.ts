import type { Hex } from '@/types';

/** Red, green and blue from 0 to 255. */
export type Rgb = [number, number, number];

export function parseHex(hex: Hex): Rgb {
	const value = Number.parseInt(hex.slice(1), 16);
	return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** An sRGB channel from 0 to 255 as linear light from 0 to 1. */
export function toLinear(value: number): number {
	const v = value / 255;
	return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

/** Lower case, the way `blend` has always returned it. */
export function formatHex(rgb: Rgb): Hex {
	return `#${rgb.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: Rgb): number {
	return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** `color` laid over `backdrop` at `alpha`, the way an opacity or an emphasis level draws it. */
export function blend(color: Hex, backdrop: Hex, alpha: number): Hex {
	const top = parseHex(color);
	const bottom = parseHex(backdrop);
	const mixed = top.map((value, index) => Math.round(value * alpha + bottom[index] * (1 - alpha)));
	return formatHex(mixed as Rgb);
}

/** The WCAG 2 contrast ratio, from 1 to 21. */
export function contrastRatio(a: Hex, b: Hex): number {
	const [light, dark] = [luminance(parseHex(a)), luminance(parseHex(b))].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}
