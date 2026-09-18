import type { EntityBase, SortOrder } from '@/types';

export interface EntityGroup<T extends EntityBase> {
	key: string;
	label: string;
	items: T[];
}

export type EntityRow<T extends EntityBase> =
	| { type: 'group'; group: EntityGroup<T> }
	| { type: 'item'; item: T };

interface SortKey {
	date: number;
	name: string;
	id: string;
}

function compareKeys(a: SortKey, b: SortKey, order: SortOrder, collator: Intl.Collator): number {
	switch (order) {
		case 'newest':
			return b.date - a.date || collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1);
		case 'oldest':
			return a.date - b.date || collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1);
		case 'az':
			return collator.compare(a.name, b.name) || b.date - a.date || (a.id < b.id ? -1 : 1);
		case 'za':
			return -collator.compare(a.name, b.name) || b.date - a.date || (a.id < b.id ? -1 : 1);
	}
}

function recordKey<T extends EntityBase>(record: T): SortKey {
	return { date: Date.parse(record.updated), name: record.name, id: record.id };
}

function groupKey<T extends EntityBase>(group: EntityGroup<T>): SortKey {
	const newestDate = Math.max(...group.items.map((item) => Date.parse(item.updated)));
	return { date: newestDate, name: group.label, id: group.key };
}

/**
 * A group's position is driven by its newest item's `updated` (in both
 * "newest" and "oldest" modes -- only the direction flips, not which item
 * decides) or by the group's own label (in "az"/"za"), never by aggregating
 * item names -- that is what makes adding a record to a group lift the
 * whole group.
 */
export function sortEntityRows<T extends EntityBase>(
	groups: EntityGroup<T>[],
	ungrouped: T[],
	order: SortOrder,
	locale: string,
): EntityRow<T>[] {
	const collator = new Intl.Collator(locale, { sensitivity: 'base' });
	const compareRecords = (a: T, b: T) => compareKeys(recordKey(a), recordKey(b), order, collator);

	const sortedGroups = groups.map((g) => ({ ...g, items: [...g.items].sort(compareRecords) }));
	const sortedUngrouped = [...ungrouped].sort(compareRecords);

	const units: Array<{ key: SortKey; row: EntityRow<T> }> = [
		...sortedGroups.map((g) => ({ key: groupKey(g), row: { type: 'group' as const, group: g } })),
		...sortedUngrouped.map((item) => ({ key: recordKey(item), row: { type: 'item' as const, item } })),
	];

	units.sort((a, b) => compareKeys(a.key, b.key, order, collator));

	return units.map((unit) => unit.row);
}
