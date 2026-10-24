import type { ItemBase, SortOrder } from '@/types';

/**
 * A titled block of records inside a list -- the tasks under one goal, say.
 * Called a section rather than a group so it never reads as the Group record
 * type: a section is a way of laying out a list, not something stored.
 */
export interface ListSection<T extends ItemBase> {
	key: string;
	label: string;
	items: T[];
}

export type EntityRow<T extends ItemBase> =
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

interface Keyed<V> {
	key: SortKey;
	value: V;
}

function recordKey<T extends ItemBase>(record: T): SortKey {
	return { date: Date.parse(record.updated), name: record.name, id: record.id };
}

function sectionKey<T extends ItemBase>(section: ListSection<T>, items: Keyed<T>[]): SortKey {
	const newestDate = Math.max(...items.map((item) => item.key.date));
	return { date: newestDate, name: section.label, id: section.key };
}

/**
 * A section's position is driven by its newest item's `updated` (in both
 * "newest" and "oldest" modes -- only the direction flips, not which item
 * decides) or by the section's own label (in "az"/"za"), never by
 * aggregating item names -- that is what makes adding a record to a section
 * lift the whole section. `loose` are the records that sit in no section.
 */
export function sortEntityRows<T extends ItemBase>(
	sections: ListSection<T>[],
	loose: T[],
	order: SortOrder,
	locale: string,
): EntityRow<T>[] {
	const collator = new Intl.Collator(locale, { sensitivity: 'base' });
	const byKey = (a: Keyed<unknown>, b: Keyed<unknown>) =>
		compareKeys(a.key, b.key, order, collator);
	// Keys are computed once per record, not inside the comparator: a sort
	// compares each record about log2(n) times, and parsing its date anew on
	// every comparison was most of what sorting a long list cost.
	const sortRecords = (records: T[]): Keyed<T>[] =>
		records.map((record) => ({ key: recordKey(record), value: record })).sort(byKey);

	const units: Keyed<EntityRow<T>>[] = [
		...sections.map((section) => {
			const items = sortRecords(section.items);
			return {
				key: sectionKey(section, items),
				value: {
					kind: 'section' as const,
					section: { ...section, items: items.map((item) => item.value) },
				},
			};
		}),
		...sortRecords(loose).map(({ key, value }) => ({
			key,
			value: { kind: 'item' as const, item: value },
		})),
	];

	units.sort(byKey);

	return units.map((unit) => unit.value);
}
