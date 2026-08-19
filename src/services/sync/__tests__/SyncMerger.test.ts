import { describe, expect, it } from 'vitest';
import { Status, type Completion, type Task } from '@/types';
import { SyncMerger } from '../SyncMerger';

/**
 * A minimal stand-in for whatever shape `SyncMerger.merge` is asked to
 * carry — the method is generic over anything with `id` and `updated`, so
 * these tests exercise that generic behaviour with a shape of their own
 * rather than reaching for one of the app's real record types.
 */
interface Item {
	id: string;
	title: string;
	updated: string;
	deleted: boolean;
}

function makeItem(overrides: Partial<Item> = {}): Item {
	return {
		id: 'id-1',
		title: 'Buy milk',
		updated: '2026-08-01T10:00:00.000Z',
		deleted: false,
		...overrides,
	};
}

function byId(items: Item[]): Record<string, Item> {
	return Object.fromEntries(items.map((item) => [item.id, item]));
}

const merger = new SyncMerger();

describe('SyncMerger.merge', () => {
	it('returns nothing when both sides are empty', () => {
		expect(merger.merge([], [])).toEqual([]);
	});

	it('keeps a record that exists only locally', () => {
		const local = [makeItem()];

		expect(merger.merge(local, [])).toEqual(local);
	});

	it('takes a record that exists only remotely', () => {
		const remote = [makeItem({ id: 'remote-only' })];

		expect(merger.merge([], remote)).toEqual(remote);
	});

	it('keeps the local version when it was updated later', () => {
		const local = [makeItem({ title: 'Local wins', updated: '2026-08-02T00:00:00.000Z' })];
		const remote = [makeItem({ title: 'Remote loses', updated: '2026-08-01T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].title).toBe('Local wins');
	});

	it('takes the remote version when it was updated later', () => {
		const local = [makeItem({ title: 'Local loses', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeItem({ title: 'Remote wins', updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].title).toBe('Remote wins');
	});

	it('prefers the local version on identical timestamps so the result is deterministic', () => {
		const local = [makeItem({ title: 'Local' })];
		const remote = [makeItem({ title: 'Remote' })];

		expect(merger.merge(local, remote)[0].title).toBe('Local');
		expect(merger.merge(remote, local)[0].title).toBe('Remote');
	});

	it('lets a newer tombstone win over an older edit', () => {
		const local = [makeItem({ title: 'Edited', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeItem({ deleted: true, updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].deleted).toBe(true);
	});

	it('lets a newer edit win over an older tombstone', () => {
		const local = [makeItem({ title: 'Resurrected', updated: '2026-08-03T00:00:00.000Z' })];
		const remote = [makeItem({ deleted: true, updated: '2026-08-02T00:00:00.000Z' })];

		const merged = merger.merge(local, remote)[0];
		expect(merged.deleted).toBe(false);
		expect(merged.title).toBe('Resurrected');
	});

	it('keeps a tombstone that only the remote side knows about', () => {
		const remote = [makeItem({ id: 'gone', deleted: true })];

		expect(merger.merge([], remote)[0].deleted).toBe(true);
	});

	it('combines records from both sides', () => {
		const local = [makeItem({ id: 'a' }), makeItem({ id: 'b' })];
		const remote = [makeItem({ id: 'b' }), makeItem({ id: 'c' })];

		const merged = merger.merge(local, remote);

		expect(merged).toHaveLength(3);
		expect(Object.keys(byId(merged)).sort()).toEqual(['a', 'b', 'c']);
	});

	it('does not mutate either input', () => {
		const local = [makeItem({ title: 'Local', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeItem({ title: 'Remote', updated: '2026-08-02T00:00:00.000Z' })];
		const localCopy = structuredClone(local);
		const remoteCopy = structuredClone(remote);

		merger.merge(local, remote);

		expect(local).toEqual(localCopy);
		expect(remote).toEqual(remoteCopy);
	});

	it('is idempotent: merging the result again changes nothing', () => {
		const local = [
			makeItem({ id: 'a' }),
			makeItem({ id: 'b', updated: '2026-08-05T00:00:00.000Z' }),
		];
		const remote = [makeItem({ id: 'b' }), makeItem({ id: 'c', deleted: true })];

		const once = merger.merge(local, remote);
		const twice = merger.merge(once, remote);

		expect(byId(twice)).toEqual(byId(once));
	});

	it('gives the same result regardless of which side runs it', () => {
		const local = [makeItem({ id: 'a', updated: '2026-08-04T00:00:00.000Z' })];
		const remote = [
			makeItem({ id: 'a', updated: '2026-08-05T00:00:00.000Z' }),
			makeItem({ id: 'b' }),
		];

		expect(byId(merger.merge(local, remote))).toEqual(byId(merger.merge(remote, local)));
	});
});

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'File the report',
		created: '2026-08-01T10:00:00.000Z',
		updated: '2026-08-01T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

function mark(occurrence: string, done: boolean, at: string): Completion {
	return { occurrence, done, at };
}

describe('SyncMerger.merge on entity records', () => {
	it('lets a newer closure win over an older edit', () => {
		const local = [makeTask({ name: 'Edited', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTask({ status: Status.Cancelled, updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].status).toBe(Status.Cancelled);
	});

	it('lets a newer edit win over an older closure', () => {
		const local = [makeTask({ name: 'Reopened', updated: '2026-08-03T00:00:00.000Z' })];
		const remote = [makeTask({ status: Status.Done, updated: '2026-08-02T00:00:00.000Z' })];

		const merged = merger.merge(local, remote)[0];
		expect(merged.status).toBe(Status.Opened);
		expect(merged.name).toBe('Reopened');
	});
});

describe('SyncMerger.mergeTasks', () => {
	it('keeps marks made on two devices for different occurrences', () => {
		// The phone marked the 7th, the desktop marked the 14th without ever
		// seeing the 7th. Whole-record last-write-wins would drop one of them.
		const local = [
			makeTask({
				updated: '2026-08-07T12:00:00.000Z',
				completions: [mark('2026-08-07T09:00', true, '2026-08-07T12:00:00.000Z')],
			}),
		];
		const remote = [
			makeTask({
				updated: '2026-08-14T10:00:00.000Z',
				completions: [mark('2026-08-14T09:00', true, '2026-08-14T10:00:00.000Z')],
			}),
		];

		const merged = merger.mergeTasks(local, remote)[0];

		expect(merged.completions?.map((c) => c.occurrence).sort()).toEqual([
			'2026-08-07T09:00',
			'2026-08-14T09:00',
		]);
	});

	it('lets a later un-mark win over an earlier mark', () => {
		const local = [
			makeTask({
				updated: '2026-08-10T00:00:00.000Z',
				completions: [mark('2026-08-07T09:00', false, '2026-08-10T00:00:00.000Z')],
			}),
		];
		const remote = [
			makeTask({
				updated: '2026-08-07T00:00:00.000Z',
				completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')],
			}),
		];

		const merged = merger.mergeTasks(local, remote)[0];

		expect(merged.completions).toEqual([
			mark('2026-08-07T09:00', false, '2026-08-10T00:00:00.000Z'),
		]);
	});

	it('lets a later mark win over an earlier un-mark', () => {
		const local = [
			makeTask({
				completions: [mark('2026-08-07T09:00', false, '2026-08-07T00:00:00.000Z')],
			}),
		];
		const remote = [
			makeTask({
				completions: [mark('2026-08-07T09:00', true, '2026-08-09T00:00:00.000Z')],
			}),
		];

		expect(merger.mergeTasks(local, remote)[0].completions?.[0].done).toBe(true);
	});

	it('still applies last-write-wins to every other field', () => {
		const local = [makeTask({ name: 'Local', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTask({ name: 'Remote', updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.mergeTasks(local, remote)[0].name).toBe('Remote');
	});

	it('carries marks over from the losing version of the record', () => {
		const local = [
			makeTask({
				name: 'Local loses',
				updated: '2026-08-01T00:00:00.000Z',
				completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')],
			}),
		];
		const remote = [makeTask({ name: 'Remote wins', updated: '2026-08-02T00:00:00.000Z' })];

		const merged = merger.mergeTasks(local, remote)[0];

		expect(merged.name).toBe('Remote wins');
		expect(merged.completions).toHaveLength(1);
	});

	it('leaves completions undefined when neither side has any', () => {
		expect(merger.mergeTasks([makeTask()], [makeTask()])[0].completions).toBeUndefined();
	});

	it('takes a task that exists only on one side, completions included', () => {
		const remoteMark = mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z');
		const localMark = mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z');

		const remoteOnly = merger.mergeTasks(
			[],
			[makeTask({ id: 'remote-only', completions: [remoteMark] })],
		);
		expect(remoteOnly).toHaveLength(1);
		expect(remoteOnly[0].completions).toEqual([remoteMark]);

		const localOnly = merger.mergeTasks(
			[makeTask({ id: 'local-only', completions: [localMark] })],
			[],
		);
		expect(localOnly).toHaveLength(1);
		expect(localOnly[0].completions).toEqual([localMark]);
	});

	it('does not mutate either input', () => {
		const local = [
			makeTask({ completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')] }),
		];
		const remote = [
			makeTask({ completions: [mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z')] }),
		];
		const localCopy = structuredClone(local);
		const remoteCopy = structuredClone(remote);

		merger.mergeTasks(local, remote);

		expect(local).toEqual(localCopy);
		expect(remote).toEqual(remoteCopy);
	});

	it('is idempotent', () => {
		const local = [
			makeTask({ completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')] }),
		];
		const remote = [
			makeTask({ completions: [mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z')] }),
		];

		const once = merger.mergeTasks(local, remote);
		const twice = merger.mergeTasks(once, remote);

		expect(twice).toEqual(once);
	});

	it('gives the same completions regardless of which side runs it', () => {
		// Also the tie scenario: both records share the default `updated`, so
		// the whole-record tie-break favours local. That makes this the
		// sharpest case in the file — a bug that only shows up when the
		// winner is read from the same side that built the lookup map (the
		// one this suite already caught once) hides here.
		const local = [
			makeTask({ completions: [mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z')] }),
		];
		const remote = [
			makeTask({ completions: [mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z')] }),
		];

		const sortByOccurrence = (completions: Completion[]) =>
			[...completions].sort((a, b) => a.occurrence.localeCompare(b.occurrence));

		const one = sortByOccurrence(merger.mergeTasks(local, remote)[0].completions ?? []);
		const other = sortByOccurrence(merger.mergeTasks(remote, local)[0].completions ?? []);

		expect(one).toEqual(other);

		// The equality above also holds if both directions dropped the same
		// occurrence, so assert the content too: the surviving set must be
		// the union of both marks, not merely an agreement between the runs.
		const union = sortByOccurrence([
			mark('2026-08-07T09:00', true, '2026-08-07T00:00:00.000Z'),
			mark('2026-08-14T09:00', true, '2026-08-14T00:00:00.000Z'),
		]);
		expect(one).toEqual(union);
		expect(other).toEqual(union);
	});
});
