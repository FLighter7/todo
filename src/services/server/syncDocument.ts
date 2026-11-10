import { DocumentError } from '@flighter7/workspace-client';
import { BackupFormatError, backupService } from '@/services/backup/BackupService';
import { SYNC_SCHEMA } from '@/services/sync/syncSchema';
import type { Item } from '@/types';

/** Why this app refuses the server's document; the sync engine halts on either. */
export type SyncDocumentErrorCode = 'newerSchema' | 'badDocument';

/**
 * The document this app keeps on the server: a backup version 4 file without
 * settings, plus `syncSchema`. So the file on the server's disk restores
 * through Settings → Restore as it is.
 */
export function encodeSyncDocument(items: Item[], now: Date): Uint8Array {
	const { version, items: copies } = backupService.create(items);
	const document = {
		version,
		exportedAt: now.toISOString(),
		items: copies,
		syncSchema: SYNC_SCHEMA,
	};

	return new TextEncoder().encode(JSON.stringify(document));
}

function badDocument(message: string): DocumentError<SyncDocumentErrorCode> {
	return new DocumentError(message, 'badDocument');
}

/**
 * Reads the server's document. An empty one (no document yet) is an empty
 * list. One from a newer build is refused with `newerSchema` — merging it
 * would drop fields this build does not know, and writing it back would
 * spread the loss — and anything that does not read is refused with
 * `badDocument`, so it is never written over.
 */
export function decodeSyncDocument(body: Uint8Array): Item[] {
	if (body.byteLength === 0) return [];

	let text: string;
	let raw: unknown;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(body);
		raw = JSON.parse(text);
	} catch {
		throw badDocument('The document on the server is not valid JSON');
	}

	const schema =
		typeof raw === 'object' && raw !== null && 'syncSchema' in raw ? raw.syncSchema : undefined;
	if (typeof schema === 'number' && schema > SYNC_SCHEMA) {
		throw new DocumentError<SyncDocumentErrorCode>(
			`The document on the server has sync schema ${schema}, newer than ${SYNC_SCHEMA}`,
			'newerSchema',
		);
	}

	try {
		return backupService.parse(text).items;
	} catch (error) {
		if (error instanceof BackupFormatError) throw badDocument(error.message);
		throw error;
	}
}
