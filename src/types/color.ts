/** A colour as `#RRGGBB`, the only form this app's theme and settings use. */
export type Hex = `#${string}`;

export function isHex(value: unknown): value is Hex {
	return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value);
}
