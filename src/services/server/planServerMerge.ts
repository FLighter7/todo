import { sameRecords } from '@/services/sync/sameRecords';
import { syncMerger } from '@/services/sync/SyncMerger';
import type { Item } from '@/types';
import { collectGarbage, pruneItem } from '@/utils';

export interface ServerMergePlan {
	/** The list this device keeps: the merge, garbage-collected and pruned by its own window. */
	result: Item[];
	/** Whether this device holds something the server lacks, and so has to write. */
	write: boolean;
	/** Whether `result` differs from what this device holds now. */
	localChanged: boolean;
}

/**
 * Merges the server's copy with this device's list and says what to do.
 *
 * The server's list goes first, so it wins every tie — on `updated` and on a
 * completion's `at` — on every device alike: with a shared copy, a tie that
 * each side resolved its own way would be written back and forth forever.
 *
 * The write decision is taken on the merge **before** garbage collection and
 * pruning: a device writes only when it holds something the server does not.
 * Collection alone never causes a write, so devices with different cleanup
 * windows do not take turns removing and restoring the same closed records;
 * the effective window stays the larger one, as it was between two devices.
 */
export function planServerMerge(
	serverItems: Item[],
	localItems: Item[],
	cleanupDays: number,
	now: Date,
): ServerMergePlan {
	const merged = syncMerger.mergeItems(serverItems, localItems);
	const write = !sameRecords(merged, serverItems);
	const result = collectGarbage(merged, cleanupDays, now).keep.map((item) =>
		pruneItem(item, cleanupDays, now),
	);

	return { result, write, localChanged: !sameRecords(result, localItems) };
}
