import { describe, expect, it } from 'vitest';
import { ItemFormatError, ItemType, Status } from '../item';
import { parseGroup } from '../group';

describe('parseGroup', () => {
	it('parses a valid group', () => {
		const raw = {
			id: 'group-1',
			type: ItemType.Group,
			name: 'Errands',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		};

		expect(parseGroup(raw)).toEqual({ ...raw, note: undefined });
	});

	it('reads a colour, though no list sections by group yet', () => {
		const group = parseGroup({
			id: 'group-1',
			type: ItemType.Group,
			name: 'Errands',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
			color: '#D81B60',
		});

		expect(group.color).toBe('#D81B60');
		expect(group.paintItems).toBeUndefined();
	});

	it('rejects a dream, though it has the same shape', () => {
		expect(() =>
			parseGroup({
				id: 'group-1',
				type: ItemType.Dream,
				name: 'Errands',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				status: Status.Opened,
			}),
		).toThrow(ItemFormatError);
	});
});
