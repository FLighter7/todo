import { ItemType, parseItemBase, type ItemBase } from './item';

/**
 * A plain way to gather tasks, with no goal or dream behind it. It carries
 * nothing beyond the shared base yet: the stage that brings groups their UI
 * also adds the task's link to one.
 */
export interface Group extends ItemBase {
	type: ItemType.Group;
}

export interface GroupDraft {
	name: string;
	note?: string;
}

export function parseGroup(value: unknown): Group {
	return parseItemBase(value, ItemType.Group);
}
