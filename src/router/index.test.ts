// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { getStartPageOptions } from './index';

beforeEach(() => {
	window.localStorage.clear();
});

describe('getStartPageOptions', () => {
	it('includes the dreams and goals routes alongside list and matrix, list first', () => {
		const values = getStartPageOptions().map((option) => option.value);

		expect(values).toEqual(['list', 'matrix', 'dreams', 'goals']);
	});
});
