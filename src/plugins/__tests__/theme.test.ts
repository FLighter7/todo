import { describe, expect, it } from 'vitest';
import { COLOR_SCHEMES } from '@/types';
import { THEME_MODES, findSwatch, parseThemeName, themeName } from '../theme';

describe('parseThemeName', () => {
	it('reads back every name a scheme in a mode is registered under', () => {
		for (const scheme of COLOR_SCHEMES) {
			for (const mode of THEME_MODES) {
				expect(parseThemeName(themeName(scheme, mode))).toEqual({ scheme, mode });
			}
		}
	});

	it("knows nothing of Vuetify's own themes", () => {
		expect(parseThemeName('light')).toBeUndefined();
		expect(parseThemeName('dark')).toBeUndefined();
	});
});

describe('findSwatch', () => {
	it('finds a swatch by its seed in either case', () => {
		expect(findSwatch('#1E6FD9')).toBe('blue');
		expect(findSwatch('#1e6fd9')).toBe('blue');
	});

	it('finds none for a colour picked by hand', () => {
		expect(findSwatch('#123456')).toBeUndefined();
	});
});
