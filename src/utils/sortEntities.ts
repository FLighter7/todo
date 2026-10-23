import type { EntityBase, SortOrder } from '@/types';

/**
 * A titled block of records inside a list -- the tasks under one goal, say.
 * Called a section rather than a group so it never reads as the Group record
 * type: a section is a way of laying out a list, not something stored.
 */
export interface ListSection<T extends EntityBase> {
	key: string;
	label: string;
	items: T[];
}

export type EntityRow<T extends EntityBase> =
	{ kind: 'section'; section: ListSection<T> } | { kind: 'item'; item: T };

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

function sectionKey<T extends EntityBase>(section: ListSection<T>): SortKey {
	const newestDate = Math.max(...section.items.map((item) => Date.parse(item.updated)));
	return { date: newestDate, name: section.label, id: section.key };
}

/**
 * A section's position is driven by its newest item's `updated` (in both
 * "newest" and "oldest" modes -- only the direction flips, not which item
 * decides) or by the section's own label (in "az"/"za"), never by
 * aggregating item names -- that is what makes adding a record to a section
 * lift the whole section. `loose` are the records that sit in no section.
 */
export function sortEntityRows<T extends EntityBase>(
	sections: ListSection<T>[],
	loose: T[],
	order: SortOrder,
	locale: string,
): EntityRow<T>[] {
	const collator = new Intl.Collator(locale, { sensitivity: 'base' });
	const compareRecords = (a: T, b: T) => compareKeys(recordKey(a), recordKey(b), order, collator);

	const sortedSections = sections.map((s) => ({ ...s, items: [...s.items].sort(compareRecords) }));
	const sortedLoose = [...loose].sort(compareRecords);

	const units: Array<{ key: SortKey; row: EntityRow<T> }> = [
		...sortedSections.map((s) => ({
			key: sectionKey(s),
			row: { kind: 'section' as const, section: s },
		})),
		...sortedLoose.map((item) => ({ key: recordKey(item), row: { kind: 'item' as const, item } })),
	];

	units.sort((a, b) => compareKeys(a.key, b.key, order, collator));

	return units.map((unit) => unit.row);
}
