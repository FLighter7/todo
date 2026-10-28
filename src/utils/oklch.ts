import type { Hex } from '@/types';
import { formatHex, parseHex, toLinear, type Rgb } from './contrast';

/**
 * A colour in OKLCH: perceived lightness from 0 to 1, chroma from 0 (grey) up,
 * and hue in degrees. Lightness here tracks what the eye sees far more closely
 * than HSL's does, so a colour can be made lighter or darker without its hue
 * drifting -- which is what fitting an accent to a background needs.
 */
export interface Oklch {
	l: number;
	c: number;
	h: number;
}

type Linear = [number, number, number];

function toGamma(value: number): number {
	const v = value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
	return Math.round(Math.min(1, Math.max(0, v)) * 255);
}

// Björn Ottosson's OKLab matrices, from linear sRGB and back.
function linearToOklab([r, g, b]: Linear): Linear {
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	];
}

function oklabToLinear([lightness, a, b]: Linear): Linear {
	const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

function oklchToLinear({ l, c, h }: Oklch): Linear {
	const radians = (h * Math.PI) / 180;
	return oklabToLinear([l, c * Math.cos(radians), c * Math.sin(radians)]);
}

const EPSILON = 1e-6;

function inGamut(linear: Linear): boolean {
	return linear.every((value) => value >= -EPSILON && value <= 1 + EPSILON);
}

export function hexToOklch(hex: Hex): Oklch {
	const [l, a, b] = linearToOklab(parseHex(hex).map(toLinear) as Linear);
	const c = Math.hypot(a, b);
	const h = (Math.atan2(b, a) * 180) / Math.PI;
	return { l, c, h: h < 0 ? h + 360 : h };
}

/**
 * The nearest colour sRGB can show: one too vivid for it at this lightness
 * loses chroma, never lightness or hue, until it fits.
 */
export function oklchToHex(color: Oklch): Hex {
	const l = Math.min(1, Math.max(0, color.l));
	let c = color.c;
	if (!inGamut(oklchToLinear({ l, c, h: color.h }))) {
		let low = 0;
		let high = c;
		for (let step = 0; step < 24; step++) {
			const mid = (low + high) / 2;
			if (inGamut(oklchToLinear({ l, c: mid, h: color.h }))) {
				low = mid;
			} else {
				high = mid;
			}
		}
		c = low;
	}

	return formatHex(oklchToLinear({ l, c, h: color.h }).map(toGamma) as Rgb);
}
