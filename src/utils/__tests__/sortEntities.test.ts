import { describe, expect, it } from 'vitest';
import { Status, type Dream } from '@/types';
import { sortEntityRows, type EntityGroup } from '../sortEntities';

const NOW = new Date('2026-08-16T12:00:00.000Z');

function daysBefore(days: number): string {
	return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'id-1',
		name: 'Visit Japan',
		created: daysBefore(100),
		updated: daysBefore(10),
		status: Status.Opened,
		...overrides,
	};
}

function group(key: string, label: string, items: Dream[]): EntityGroup<Dream> {
	return { key, label, items };
}

describe('sortEntityRows ordering of ungrouped items', () => {
	it('orders "newest" by updated, most recent first', () => {
		const a = makeDream({ id: 'a', updated: daysBefore(5) });
		const b = makeDream({ id: 'b', updated: daysBefore(1) });
		const c = makeDream({ id: 'c', updated: daysBefore(10) });

		const rows = sortEntityRows([], [a, b, c], 'newest', 'en');

		expect(rows.map((row) => (row.type === 'item' ? row.item.id : null))).toEqual(['b', 'a', 'c']);
	});

	it('orders "oldest" by updated, least recent first', () => {
		const a = makeDream({ id: 'a', updated: daysBefore(5) });
		const b = makeDream({ id: 'b', updated: daysBefore(1) });
		const c = makeDream({ id: 'c', updated: daysBefore(10) });

		const rows = sortEntityRows([], [a, b, c], 'oldest', 'en');

		expect(rows.map((row) => (row.type === 'item' ? row.item.id : null))).toEqual(['c', 'a', 'b']);
	});

	it('orders "az" by name, case-insensitively', () => {
		const a = makeDream({ id: 'a', name: 'banana' });
		const b = makeDream({ id: 'b', name: 'Apple' });
		const c = makeDream({ id: 'c', name: 'cherry' });

		const rows = sortEntityRows([], [a, b, c], 'az', 'en');

		expect(rows.map((row) => (row.type === 'item' ? row.item.id : null))).toEqual(['b', 'a', 'c']);
	});

	it('orders "za" by name, reversed', () => {
		const a = makeDream({ id: 'a', name: 'banana' });
		const b = makeDream({ id: 'b', name: 'Apple' });
		const c = makeDream({ id: 'c', name: 'cherry' });

		const rows = sortEntityRows([], [a, b, c], 'za', 'en');

		expect(rows.map((row) => (row.type === 'item' ? row.item.id : null))).toEqual(['c', 'a', 'b']);
	});
});

describe('sortEntityRows group aggregation', () => {
	it('lifts a group to the top in "newest" mode when one of its items is the most recent record', () => {
		const oldUngrouped = makeDream({ id: 'ungrouped', updated: daysBefore(5) });
		const oldGroupItem = makeDream({ id: 'old-in-group', updated: daysBefore(50) });
		const freshGroupItem = makeDream({ id: 'fresh-in-group', updated: daysBefore(1) });
		const groups = [group('goal-1', 'Some goal', [oldGroupItem, freshGroupItem])];

		const rows = sortEntityRows(groups, [oldUngrouped], 'newest', 'en');

		expect(rows[0]).toEqual({ type: 'group', group: expect.objectContaining({ key: 'goal-1' }) });
	});

	it('still lifts that same group to the top in "oldest" mode, because its newest item still decides its position', () => {
		const oldUngrouped = makeDream({ id: 'ungrouped', updated: daysBefore(5) });
		const oldGroupItem = makeDream({ id: 'old-in-group', updated: daysBefore(50) });
		const freshGroupItem = makeDream({ id: 'fresh-in-group', updated: daysBefore(1) });
		const groups = [group('goal-1', 'Some goal', [oldGroupItem, freshGroupItem])];

		const rows = sortEntityRows(groups, [oldUngrouped], 'oldest', 'en');

		expect(rows[rows.length - 1]).toEqual({
			type: 'group',
			group: expect.objectContaining({ key: 'goal-1' }),
		});
	});

	it('positions a group among "az"/"za" by its own label, not by its items', () => {
		const groups = [
			group('g-z', 'Zebra goal', [makeDream({ id: 'z-item', name: 'aaa item' })]),
			group('g-a', 'Apple goal', [makeDream({ id: 'a-item', name: 'zzz item' })]),
		];

		const rows = sortEntityRows(groups, [], 'az', 'en');

		expect(rows.map((row) => (row.type === 'group' ? row.group.key : null))).toEqual(['g-a', 'g-z']);
	});
});

describe('sortEntityRows interleaving', () => {
	it('mixes groups and ungrouped items into one order instead of two blocks', () => {
		const veryOld = makeDream({ id: 'very-old', updated: daysBefore(90) });
		const middle = makeDream({ id: 'middle', updated: daysBefore(20) });
		const groupItem = makeDream({ id: 'group-item', updated: daysBefore(50) });
		const groups = [group('goal-1', 'A goal', [groupItem])];

		const rows = sortEntityRows(groups, [veryOld, middle], 'newest', 'en');

		expect(
			rows.map((row) => (row.type === 'group' ? `group:${row.group.key}` : `item:${row.item.id}`)),
		).toEqual(['item:middle', 'group:goal-1', 'item:very-old']);
	});
});

describe('sortEntityRows within-group ordering', () => {
	it('re-sorts a group\'s own items by the same mode, regardless of input order', () => {
		const older = makeDream({ id: 'older', updated: daysBefore(20) });
		const newer = makeDream({ id: 'newer', updated: daysBefore(1) });
		const groups = [group('goal-1', 'A goal', [older, newer])];

		const rows = sortEntityRows(groups, [], 'newest', 'en');

		const row = rows[0];
		if (row.type !== 'group') throw new Error('expected a group row');
		expect(row.group.items.map((item) => item.id)).toEqual(['newer', 'older']);
	});
});

describe('sortEntityRows tiebreaking', () => {
	it('is deterministic across repeated calls when two records share the same updated timestamp', () => {
		const sameUpdated = daysBefore(5);
		const a = makeDream({ id: 'a', name: 'same', updated: sameUpdated });
		const b = makeDream({ id: 'b', name: 'same', updated: sameUpdated });

		const first = sortEntityRows([], [a, b], 'newest', 'en');
		const second = sortEntityRows([], [b, a], 'newest', 'en');

		const ids = (rows: typeof first) => rows.map((row) => (row.type === 'item' ? row.item.id : null));
		expect(ids(first)).toEqual(ids(second));
	});
});

describe('sortEntityRows immutability', () => {
	it('does not mutate the groups or ungrouped arguments', () => {
		const groupItem = makeDream({ id: 'group-item', updated: daysBefore(20) });
		const ungroupedItem = makeDream({ id: 'ungrouped-item', updated: daysBefore(5) });
		const groups = [group('goal-1', 'A goal', [groupItem])];
		const ungrouped = [ungroupedItem];
		const groupsSnapshot = JSON.parse(JSON.stringify(groups));
		const ungroupedSnapshot = JSON.parse(JSON.stringify(ungrouped));

		sortEntityRows(groups, ungrouped, 'newest', 'en');

		expect(groups).toEqual(groupsSnapshot);
		expect(ungrouped).toEqual(ungroupedSnapshot);
	});
});
