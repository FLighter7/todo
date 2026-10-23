import { describe, expect, it } from 'vitest';
import { ItemFormatError, Status } from '../item';
import { parseDream } from '../dream';

describe('parseDream', () => {
	it('parses a valid dream', () => {
		const raw = {
			id: 'id-1',
			name: 'Visit Japan',
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		};

		expect(parseDream(raw)).toEqual({ ...raw, note: undefined });
	});

	it('rejects a record with a broken base', () => {
		expect(() => parseDream({ id: 'id-1' })).toThrow(ItemFormatError);
	});
});
