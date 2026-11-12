import type { SyncAdapter } from '@flighter7/wss-client';
import type { Item } from '@/types';
import { planServerMerge } from './planServerMerge';
import { decodeSyncDocument, encodeSyncDocument } from './syncDocument';

/** What the adapter reads and changes on this device; the server sync store wires it. */
export interface TodoSyncSource {
	/** The items this device holds now. */
	localItems(): Item[];
	/** Replaces them with the merge. */
	replaceLocalItems(items: Item[]): Promise<void>;
	/** This device's cleanup window, in days. */
	cleanupDays(): number;
	/** Moves on every local change. */
	changeCount(): number;
}

/**
 * How this app's document syncs through workspace-server: the server keeps
 * a backup file plus `syncSchema` (`syncDocument`), and `planServerMerge`
 * merges it with this device's items — the server's copy first, so it wins
 * every tie, and the write decided before garbage collection.
 */
export function createTodoSyncAdapter(source: TodoSyncSource): SyncAdapter {
	return {
		changeCount: () => source.changeCount(),
		plan(server, now) {
			const serverItems = decodeSyncDocument(server.body);
			const plan = planServerMerge(serverItems, source.localItems(), source.cleanupDays(), now);

			return {
				apply: plan.localChanged ? () => source.replaceLocalItems(plan.result) : undefined,
				write: plan.write ? encodeSyncDocument(plan.result, now) : null,
			};
		},
	};
}
