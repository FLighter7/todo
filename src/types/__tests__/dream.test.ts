import { describe, expect, it } from 'vitest';
import { ItemFormatError, ItemType, Status } from '../item';
import { parseDream } from '../dream';

describe('parseDream', () => {
	it('parses a valid dream', () => {
		const raw = {
			id: 'id-1',
			type: ItemType.Dream,
			name: 'Visit Japan',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		};

		expect(parseDream(raw)).toEqual({ ...raw, note: undefined });
	});

	it('reads the colour of the section its goals sit in', () => {
		const dream = parseDream({
			id: 'id-1',
			type: ItemType.Dream,
			name: 'Visit Japan',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
			color: '#1E6FD9',
			paintItems: true,
		});

		expect(dream.color).toBe('#1E6FD9');
		expect(dream.paintItems).toBe(true);
	});

	it('rejects a colour that is not #RRGGBB, and a paintItems that is not a boolean', () => {
		const raw = {
			id: 'id-1',
			type: ItemType.Dream,
			name: 'Visit Japan',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		};

		expect(() => parseDream({ ...raw, color: 'blue' })).toThrow(ItemFormatError);
		expect(() => parseDream({ ...raw, color: '#12345' })).toThrow(ItemFormatError);
		expect(() => parseDream({ ...raw, color: '#1E6FD9', paintItems: 'yes' })).toThrow(
			ItemFormatError,
		);
	});

	it('rejects a record of another type', () => {
		expect(() =>
			parseDream({
				id: 'id-1',
				type: ItemType.Group,
				name: 'Visit Japan',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				status: Status.Opened,
			}),
		).toThrow(ItemFormatError);
	});

	it('rejects a record with a broken base', () => {
		expect(() => parseDream({ id: 'id-1' })).toThrow(ItemFormatError);
	});
});
