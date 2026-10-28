import type { ThemeDefinition } from 'vuetify';
import { COLOR_SCHEMES, type ColorScheme, type Hex } from '@/types';
import { fitAccent } from '@/utils/accent';

export type ThemeMode = 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['light', 'dark'];

export const STATUS_COLORS = ['error', 'info', 'success', 'warning'] as const;
type StatusColor = (typeof STATUS_COLORS)[number];

// Type aliases, not interfaces: Vuetify's theme definition takes colours and
// variables as string-keyed records, which only a type alias satisfies.
export type PaletteColors = Record<StatusColor | `on-${StatusColor}`, Hex> & {
	background: Hex;
	surface: Hex;
	'surface-variant': Hex;
	'on-surface-variant': Hex;
	outline: Hex;
	primary: Hex;
	'on-primary': Hex;
	'on-background': Hex;
	'on-surface': Hex;
	/**
	 * A switch's thumb and a select's mask. The standard scheme leaves them to
	 * Vuetify's own defaults, which the other schemes' backgrounds would show up.
	 */
	'surface-bright'?: Hex;
	'surface-light'?: Hex;
};

export type PaletteVariables = {
	/** Vuetify's text emphasis levels, as the opacity of the text colour. */
	'high-emphasis-opacity': number;
	'medium-emphasis-opacity': number;
	/** An outlined field's border, read by assets/styles/contrast.scss. */
	'app-field-border-opacity': number;
	/** The focus ring, read by assets/styles/focus.scss. */
	'app-focus-width': string;
	/** Dividers and the borders of cards and buttons; Vuetify's own is 0.12. */
	'border-opacity'?: number;
	'disabled-opacity'?: number;
};

export interface ThemePalette {
	colors: PaletteColors;
	variables: PaletteVariables;
}

export interface Scheme {
	light: ThemePalette;
	dark: ThemePalette;
	/** The WCAG level its text is held to: AA is 4.5:1 (1.4.3), AAA 7:1 (1.4.6). */
	level: 'AA' | 'AAA';
}

export function textRatio(level: Scheme['level']): number {
	return level === 'AAA' ? 7 : 4.5;
}

/**
 * The status colours replace Vuetify's defaults: its orange, green and blue
 * drew 2:1 text in a light tonal alert, and its dark-theme error 3.6:1 under
 * white. Each comes with its own on-colour rather than leaving Vuetify to
 * guess one.
 */
const LIGHT_STATUS = {
	error: '#B00020',
	'on-error': '#FFFFFF',
	info: '#1A5FA8',
	'on-info': '#FFFFFF',
	success: '#2B6B2F',
	'on-success': '#FFFFFF',
	warning: '#8A5100',
	'on-warning': '#FFFFFF',
} as const;

/** On a dark palette the status colours are light, with the background as their text. */
function darkStatus(background: Hex) {
	return {
		error: '#F2B8B5',
		'on-error': background,
		info: '#64B5F6',
		'on-info': background,
		success: '#81C784',
		'on-success': background,
		warning: '#FFB74D',
		'on-warning': background,
	} as const;
}

// Vuetify's medium emphasis is 0.6, which on the standard scheme's warm surface
// gave secondary text 3.9:1; 0.72 keeps it a step below the body text at 5:1
// and more.
const LIGHT_VARIABLES: PaletteVariables = {
	'high-emphasis-opacity': 0.87,
	'medium-emphasis-opacity': 0.72,
	'app-field-border-opacity': 0.55,
	'app-focus-width': '2px',
};

const DARK_VARIABLES: PaletteVariables = {
	'high-emphasis-opacity': 1,
	'medium-emphasis-opacity': 0.7,
	'app-field-border-opacity': 0.55,
	'app-focus-width': '2px',
};

// No secondary text at all: every word at full strength, every border solid,
// and a wider focus ring.
const CONTRAST_VARIABLES: PaletteVariables = {
	'high-emphasis-opacity': 1,
	'medium-emphasis-opacity': 1,
	'app-field-border-opacity': 1,
	'app-focus-width': '3px',
	'border-opacity': 0.6,
	'disabled-opacity': 0.6,
};

const NEUTRAL_LIGHT: ThemePalette = {
	colors: {
		background: '#F4F4F5',
		surface: '#FAFAFA',
		'surface-bright': '#FFFFFF',
		'surface-light': '#E6E6E8',
		'surface-variant': '#E6E6E8',
		'on-surface-variant': '#5E5E66',
		outline: '#D4D4D8',
		primary: '#2F5D50',
		'on-primary': '#F4F4F5',
		'on-background': '#26262A',
		'on-surface': '#26262A',
		...LIGHT_STATUS,
	},
	variables: LIGHT_VARIABLES,
};

/**
 * Every scheme in one place, apart from Vuetify, so that
 * plugins/__tests__/themeContrast.test.ts can hold every pair the app draws to
 * the scheme's level.
 */
export const SCHEMES: Record<ColorScheme, Scheme> = {
	standard: {
		level: 'AA',
		light: {
			colors: {
				background: '#F6F4EF',
				surface: '#FBFAF6',
				'surface-variant': '#EAE5D8',
				'on-surface-variant': '#6E6A5D',
				outline: '#D6D0C0',
				primary: '#2F5D50',
				'on-primary': '#F6F4EF',
				'on-background': '#2B2A26',
				'on-surface': '#2B2A26',
				...LIGHT_STATUS,
			},
			variables: LIGHT_VARIABLES,
		},
		dark: {
			colors: {
				background: '#1B1A17',
				surface: '#221F1A',
				'surface-variant': '#332E27',
				'on-surface-variant': '#B3AC9C',
				outline: '#4A453B',
				primary: '#74AC90',
				'on-primary': '#12241D',
				'on-background': '#EFEBE0',
				'on-surface': '#EFEBE0',
				...darkStatus('#1B1A17'),
			},
			variables: DARK_VARIABLES,
		},
	},
	neutral: {
		level: 'AA',
		light: NEUTRAL_LIGHT,
		dark: {
			colors: {
				background: '#18181A',
				surface: '#1F1F22',
				'surface-bright': '#2E2E33',
				'surface-light': '#2E2E33',
				'surface-variant': '#2E2E33',
				'on-surface-variant': '#ADADB5',
				outline: '#46464D',
				primary: '#74AC90',
				'on-primary': '#18181A',
				'on-background': '#ECECEE',
				'on-surface': '#ECECEE',
				...darkStatus('#18181A'),
			},
			variables: DARK_VARIABLES,
		},
	},
	cool: {
		level: 'AA',
		light: {
			colors: {
				background: '#F1F4F8',
				surface: '#F9FAFC',
				'surface-bright': '#FFFFFF',
				'surface-light': '#E1E7EF',
				'surface-variant': '#E1E7EF',
				'on-surface-variant': '#56616F',
				outline: '#CBD3DE',
				primary: '#245A8A',
				'on-primary': '#F1F4F8',
				'on-background': '#1F2633',
				'on-surface': '#1F2633',
				...LIGHT_STATUS,
			},
			variables: LIGHT_VARIABLES,
		},
		dark: {
			colors: {
				background: '#161A20',
				surface: '#1C2129',
				'surface-bright': '#2A313C',
				'surface-light': '#2A313C',
				'surface-variant': '#2A313C',
				'on-surface-variant': '#A7B1C0',
				outline: '#414B59',
				primary: '#8AB4E0',
				'on-primary': '#161A20',
				'on-background': '#E8ECF2',
				'on-surface': '#E8ECF2',
				...darkStatus('#161A20'),
			},
			variables: DARK_VARIABLES,
		},
	},
	// Pure black is for the dark mode of an OLED screen; by day it is the
	// neutral scheme, which it otherwise matches.
	black: {
		level: 'AA',
		light: NEUTRAL_LIGHT,
		dark: {
			colors: {
				background: '#000000',
				surface: '#0E0E10',
				'surface-bright': '#1F1F23',
				'surface-light': '#1F1F23',
				'surface-variant': '#1F1F23',
				'on-surface-variant': '#A8A8B0',
				outline: '#3A3A40',
				primary: '#74AC90',
				'on-primary': '#000000',
				'on-background': '#EDEDEF',
				'on-surface': '#EDEDEF',
				...darkStatus('#000000'),
			},
			variables: DARK_VARIABLES,
		},
	},
	contrast: {
		level: 'AAA',
		light: {
			colors: {
				background: '#FFFFFF',
				surface: '#FFFFFF',
				'surface-bright': '#FFFFFF',
				'surface-light': '#EBEBEB',
				'surface-variant': '#EBEBEB',
				'on-surface-variant': '#333333',
				outline: '#1F1F1F',
				primary: '#0B4A37',
				'on-primary': '#FFFFFF',
				'on-background': '#000000',
				'on-surface': '#000000',
				error: '#8C0019',
				'on-error': '#FFFFFF',
				info: '#0A4782',
				'on-info': '#FFFFFF',
				success: '#1B521E',
				'on-success': '#FFFFFF',
				warning: '#663C00',
				'on-warning': '#FFFFFF',
			},
			variables: CONTRAST_VARIABLES,
		},
		dark: {
			colors: {
				background: '#000000',
				surface: '#000000',
				'surface-bright': '#1A1A1A',
				'surface-light': '#1A1A1A',
				'surface-variant': '#1A1A1A',
				'on-surface-variant': '#D6D6D6',
				outline: '#E0E0E0',
				primary: '#8FE0BC',
				'on-primary': '#000000',
				'on-background': '#FFFFFF',
				'on-surface': '#FFFFFF',
				error: '#FFB4AB',
				'on-error': '#000000',
				info: '#9CCBFF',
				'on-info': '#000000',
				success: '#A6E3A9',
				'on-success': '#000000',
				warning: '#FFD08A',
				'on-warning': '#000000',
			},
			variables: CONTRAST_VARIABLES,
		},
	},
};

/**
 * The accents Settings offers, as seeds for `fitAccent`: each is drawn darker
 * or lighter as a palette needs, so what it names is a hue, not an exact colour.
 */
export const ACCENT_SWATCHES = [
	{ id: 'green', seed: '#2E7D5B' },
	{ id: 'teal', seed: '#00897B' },
	{ id: 'blue', seed: '#1E6FD9' },
	{ id: 'indigo', seed: '#3F51B5' },
	{ id: 'violet', seed: '#7E57C2' },
	{ id: 'pink', seed: '#D81B60' },
	{ id: 'red', seed: '#D32F2F' },
	{ id: 'orange', seed: '#EF6C00' },
	{ id: 'brown', seed: '#8D6E63' },
	{ id: 'slate', seed: '#607D8B' },
] as const satisfies ReadonlyArray<{ id: string; seed: Hex }>;

/** The name a scheme in a mode is registered with Vuetify under. */
export function themeName(scheme: ColorScheme, mode: ThemeMode): string {
	return `${scheme}-${mode}`;
}

/** A scheme's palette in one mode, with `accent` fitted in place of its own primary colour. */
export function paletteFor(scheme: ColorScheme, mode: ThemeMode, accent: Hex | null): ThemePalette {
	const { level, [mode]: palette } = SCHEMES[scheme];
	if (accent === null) {
		return palette;
	}

	const { primary, onPrimary } = fitAccent(accent, palette.colors, textRatio(level));
	return { ...palette, colors: { ...palette.colors, primary, 'on-primary': onPrimary } };
}

/**
 * Every scheme in both modes, as Vuetify takes them, with `accent` fitted into
 * each. Copies throughout: Vuetify keeps a theme it has no default for by
 * reference, and a change made through it would otherwise reach `SCHEMES`.
 */
export function buildThemes(accent: Hex | null): Record<string, ThemeDefinition> {
	const themes: Record<string, ThemeDefinition> = {};
	for (const scheme of COLOR_SCHEMES) {
		for (const mode of THEME_MODES) {
			const { colors, variables } = paletteFor(scheme, mode, accent);
			themes[themeName(scheme, mode)] = {
				dark: mode === 'dark',
				colors: { ...colors },
				variables: { ...variables },
			};
		}
	}

	return themes;
}
