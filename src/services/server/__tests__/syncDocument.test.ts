import { describe, expect, it } from 'vitest';
import { BackupService } from '@/services/backup/BackupService';
import { DocumentError } from '@flighter7/wss-client';
import { decodeSyncDocument, encodeSyncDocument } from '../syncDocument';
import { makeDream, makeTask, mark } from './fixtures';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const ITEMS = [
	makeTask({ completions: [mark('2026-11-07T09:00', '2026-11-07T09:30:00.000Z')] }),
	makeDream({ id: 'dream-2' }),
];

function bytes(value: unknown): Uint8Array {
	return new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value));
}

function codeOf(body: Uint8Array): string | null {
	try {
		decodeSyncDocument(body);
		return null;
	} catch (error) {
		expect(error).toBeInstanceOf(DocumentError);
		return (error as DocumentError).code;
	}
}

describe('encodeSyncDocument', () => {
	it('produces a backup v4 file with syncSchema and no settings', () => {
		const body = encodeSyncDocument(ITEMS, NOW);
		const text = new TextDecoder().decode(body);
		const parsed = JSON.parse(text) as Record<string, unknown>;

		expect(parsed).toEqual({
			version: 4,
			exportedAt: '2026-11-07T12:00:00.000Z',
			items: ITEMS,
			syncSchema: 5,
		});
		expect('settings' in parsed).toBe(false);
		expect(new BackupService().parse(text).items).toEqual(ITEMS);
	});
});

describe('decodeSyncDocument', () => {
	it('reads what encode wrote', () => {
		expect(decodeSyncDocument(encodeSyncDocument(ITEMS, NOW))).toEqual(ITEMS);
	});

	it('refuses a newer syncSchema', () => {
		const body = bytes({ version: 4, exportedAt: '', items: [], syncSchema: 6 });

		expect(codeOf(body)).toBe('newerSchema');
	});

	it('refuses a newer syncSchema even when its items would not parse', () => {
		const body = bytes({ version: 4, exportedAt: '', items: [{ shape: 'future' }], syncSchema: 9 });

		expect(codeOf(body)).toBe('newerSchema');
	});

	it('accepts an older or missing syncSchema', () => {
		const older = bytes({ version: 4, exportedAt: '', items: ITEMS, syncSchema: 4 });
		const missing = bytes({ version: 4, exportedAt: '', items: ITEMS });

		expect(decodeSyncDocument(older)).toEqual(ITEMS);
		expect(decodeSyncDocument(missing)).toEqual(ITEMS);
	});

	it('refuses a damaged document', () => {
		expect(codeOf(bytes('{not json'))).toBe('badDocument');
		expect(codeOf(bytes({ version: 3, exportedAt: '', dreams: [], goals: [], tasks: [] }))).toBe(
			'badDocument',
		);
		expect(codeOf(Uint8Array.from([0xff, 0xfe, 0x00]))).toBe('badDocument');
		expect(codeOf(bytes({ version: 4, exportedAt: '', items: [{ id: 'x' }] }))).toBe('badDocument');
	});

	it('decodes an empty body as an empty list', () => {
		expect(decodeSyncDocument(new Uint8Array(0))).toEqual([]);
	});
});
