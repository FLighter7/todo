import { describe, expect, it } from 'vitest';
import { ItemFormatError, ItemType, Status, isItemType, isStatus, parseItemBase } from '../item';

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'id-1',
		type: ItemType.Task,
		name: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('isStatus', () => {
	it('accepts every declared member', () => {
		expect(isStatus(Status.Opened)).toBe(true);
		expect(isStatus(Status.Done)).toBe(true);
		expect(isStatus(Status.Cancelled)).toBe(true);
	});

	it('rejects a number outside the enum', () => {
		expect(isStatus(0)).toBe(false);
		expect(isStatus(7)).toBe(false);
	});

	it('rejects non-numbers', () => {
		expect(isStatus('1')).toBe(false);
		expect(isStatus(undefined)).toBe(false);
		expect(isStatus(null)).toBe(false);
	});
});

describe('isItemType', () => {
	it('accepts every declared member', () => {
		expect(isItemType(ItemType.Task)).toBe(true);
		expect(isItemType(ItemType.Group)).toBe(true);
		expect(isItemType(ItemType.Goal)).toBe(true);
		expect(isItemType(ItemType.Dream)).toBe(true);
	});

	it('rejects a number outside the enum', () => {
		expect(isItemType(0)).toBe(false);
		expect(isItemType(5)).toBe(false);
	});

	it('rejects the reverse-mapped member names', () => {
		expect(isItemType('Task')).toBe(false);
		expect(isItemType('1')).toBe(false);
	});
});

describe('parseItemBase', () => {
	it('returns the base fields of a valid record', () => {
		expect(parseItemBase(makeRaw(), ItemType.Task)).toEqual({
			id: 'id-1',
			type: ItemType.Task,
			name: 'Buy milk',
			note: undefined,
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		});
	});

	it('keeps an optional note', () => {
		expect(parseItemBase(makeRaw({ note: 'semi-skimmed' }), ItemType.Task).note).toBe(
			'semi-skimmed',
		);
	});

	it('rejects a value that is not an object', () => {
		expect(() => parseItemBase('nope', ItemType.Task)).toThrow(ItemFormatError);
		expect(() => parseItemBase(null, ItemType.Task)).toThrow(ItemFormatError);
		expect(() => parseItemBase([], ItemType.Task)).toThrow(ItemFormatError);
	});

	it('rejects a missing or non-string id, name, created or updated', () => {
		for (const key of ['id', 'name', 'created', 'updated']) {
			expect(() => parseItemBase(makeRaw({ [key]: undefined }), ItemType.Task)).toThrow(
				ItemFormatError,
			);
			expect(() => parseItemBase(makeRaw({ [key]: 42 }), ItemType.Task)).toThrow(ItemFormatError);
		}
	});

	it('rejects a status outside the enum', () => {
		expect(() => parseItemBase(makeRaw({ status: 7 }), ItemType.Task)).toThrow(ItemFormatError);
	});

	it('rejects a record of another type than the one asked for', () => {
		expect(() => parseItemBase(makeRaw({ type: ItemType.Goal }), ItemType.Task)).toThrow(
			ItemFormatError,
		);
	});

	it('rejects a missing type', () => {
		expect(() => parseItemBase(makeRaw({ type: undefined }), ItemType.Task)).toThrow(
			ItemFormatError,
		);
	});

	it('rejects a non-string note when present', () => {
		expect(() => parseItemBase(makeRaw({ note: 42 }), ItemType.Task)).toThrow(ItemFormatError);
	});
});
