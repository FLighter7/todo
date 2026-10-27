import type { Hex } from '@/utils/contrast';

export interface ThemePalette {
	colors: Record<string, Hex>;
	/** Vuetify's text emphasis levels, as the opacity of the text colour. */
	variables: { 'high-emphasis-opacity': number; 'medium-emphasis-opacity': number };
}

/**
 * Both palettes in one place, apart from Vuetify, so that
 * plugins/__tests__/themeContrast.test.ts can hold every pair the app draws to
 * WCAG AA. The status colours (error, info, success, warning) replace Vuetify's
 * defaults: its orange, green and blue drew 2:1 text in a light tonal alert,
 * and its dark-theme error 3.6:1 under white. Each comes with its own on-colour
 * rather than leaving Vuetify to guess one.
 */
export const THEMES: Record<'light' | 'dark', ThemePalette> = {
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
			error: '#B00020',
			'on-error': '#FFFFFF',
			info: '#1A5FA8',
			'on-info': '#FFFFFF',
			success: '#2B6B2F',
			'on-success': '#FFFFFF',
			warning: '#8A5100',
			'on-warning': '#FFFFFF',
		},
		// Vuetify's medium emphasis is 0.6, which on this warm surface gave secondary
		// text 3.9:1; 0.72 keeps it a step below the body text at 5:1 and more.
		variables: { 'high-emphasis-opacity': 0.87, 'medium-emphasis-opacity': 0.72 },
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
			error: '#F2B8B5',
			'on-error': '#1B1A17',
			info: '#64B5F6',
			'on-info': '#1B1A17',
			success: '#81C784',
			'on-success': '#1B1A17',
			warning: '#FFB74D',
			'on-warning': '#1B1A17',
		},
		variables: { 'high-emphasis-opacity': 1, 'medium-emphasis-opacity': 0.7 },
	},
};
