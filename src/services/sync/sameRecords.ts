import type { Item } from '@/types';

/** JSON with every object's keys sorted, so two equal records always serialize alike. */
function canonical(value: unknown): string {
	return JSON.stringify(value, (_key, inner: unknown) => {
		if (typeof inner !== 'object' || inner === null || Array.isArray(inner)) return inner;
		const entries = Object.entries(inner as Record<string, unknown>).sort(([a], [b]) =>
			a < b ? -1 : a > b ? 1 : 0,
		);

		return Object.fromEntries(entries);
	});
}

/** Whether two records hold the same data, whatever the order of their keys. */
export function sameRecord(a: Item, b: Item): boolean {
	return canonical(a) === canonical(b);
}

/** Whether two lists hold the same records, in whatever order and with whatever key order. */
export function sameRecords(a: Item[], b: Item[]): boolean {
	if (a.length !== b.length) return false;
	const byId = (x: Item, y: Item): number => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

	return canonical([...a].sort(byId)) === canonical([...b].sort(byId));
}
