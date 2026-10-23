export interface ParentSection<T> {
	parentId: string;
	items: T[];
}

export interface SectionedByParent<T> {
	sections: ParentSection<T>[];
	/** Records with no parent link at all. */
	loose: T[];
}

/**
 * Splits records into one section per parent id, in first-seen order. Only
 * the id is looked at, never the parent record itself: a link to a closed or
 * missing parent still makes a section, because the label and whether to show
 * it are the caller's to decide.
 */
export function sectionByParent<T>(
	records: T[],
	parentOf: (record: T) => string | undefined,
): SectionedByParent<T> {
	const byParent = new Map<string, T[]>();
	const loose: T[] = [];

	for (const record of records) {
		const parentId = parentOf(record);
		if (parentId === undefined) {
			loose.push(record);
			continue;
		}

		const items = byParent.get(parentId) ?? [];
		items.push(record);
		byParent.set(parentId, items);
	}

	return {
		sections: [...byParent.entries()].map(([parentId, items]) => ({ parentId, items })),
		loose,
	};
}
