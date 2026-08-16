import { describe, expect, it } from 'vitest';
import { EntityFormatError, Status, isStatus, parseEntityBase } from './entity';

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: 'id-1',
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

describe('parseEntityBase', () => {
	it('returns the base fields of a valid record', () => {
		expect(parseEntityBase(makeRaw())).toEqual({
			id: 'id-1',
			name: 'Buy milk',
			note: undefined,
			created: '2026-08-06T10:00:00.000Z',
			updated: '2026-08-06T10:00:00.000Z',
			status: Status.Opened,
		});
	});

	it('keeps an optional note', () => {
		expect(parseEntityBase(makeRaw({ note: 'semi-skimmed' })).note).toBe('semi-skimmed');
	});

	it('rejects a value that is not an object', () => {
		expect(() => parseEntityBase('nope')).toThrow(EntityFormatError);
		expect(() => parseEntityBase(null)).toThrow(EntityFormatError);
		expect(() => parseEntityBase([])).toThrow(EntityFormatError);
	});

	it('rejects a missing or non-string id, name, created or updated', () => {
		for (const key of ['id', 'name', 'created', 'updated']) {
			expect(() => parseEntityBase(makeRaw({ [key]: undefined }))).toThrow(EntityFormatError);
			expect(() => parseEntityBase(makeRaw({ [key]: 42 }))).toThrow(EntityFormatError);
		}
	});

	it('rejects a status outside the enum', () => {
		expect(() => parseEntityBase(makeRaw({ status: 7 }))).toThrow(EntityFormatError);
	});

	it('rejects a non-string note when present', () => {
		expect(() => parseEntityBase(makeRaw({ note: 42 }))).toThrow(EntityFormatError);
	});
});
