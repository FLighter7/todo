// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { getStartPageOptions } from './index';

beforeEach(() => {
	window.localStorage.clear();
});

describe('getStartPageOptions', () => {
	it('includes the tasks, matrix, dreams and goals routes, tasks first', () => {
		const values = getStartPageOptions().map((option) => option.value);

		expect(values).toEqual(['tasks', 'matrix', 'dreams', 'goals']);
	});
});
