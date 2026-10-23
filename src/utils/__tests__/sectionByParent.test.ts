import { describe, expect, it } from 'vitest';
import { sectionByParent } from '../sectionByParent';

interface Child {
	id: string;
	parentId?: string;
}

const parentOf = (child: Child) => child.parentId;

describe('sectionByParent', () => {
	it('puts a record without a parent into loose', () => {
		const result = sectionByParent<Child>([{ id: 'a' }], parentOf);

		expect(result.sections).toEqual([]);
		expect(result.loose.map((child) => child.id)).toEqual(['a']);
	});

	it('gathers records sharing a parent into one section, in first-seen order', () => {
		const result = sectionByParent<Child>(
			[
				{ id: 'a', parentId: 'p-2' },
				{ id: 'b', parentId: 'p-1' },
				{ id: 'c', parentId: 'p-2' },
			],
			parentOf,
		);

		expect(result.sections).toEqual([
			{
				parentId: 'p-2',
				items: [
					{ id: 'a', parentId: 'p-2' },
					{ id: 'c', parentId: 'p-2' },
				],
			},
			{ parentId: 'p-1', items: [{ id: 'b', parentId: 'p-1' }] },
		]);
		expect(result.loose).toEqual([]);
	});

	it('keeps the records themselves, not copies', () => {
		const child: Child = { id: 'a', parentId: 'p-1' };

		expect(sectionByParent([child], parentOf).sections[0].items[0]).toBe(child);
	});
});
