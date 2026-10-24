import { ItemType, parseItemBase, type ItemBase } from './item';

/**
 * A plain way to gather tasks, with no dream, deadline or note behind it --
 * only a name. A task joins one through `Task.groupId`, independently of its
 * goal: a task can sit in a goal and a group at once.
 */
export interface Group extends ItemBase {
	type: ItemType.Group;
}

export interface GroupDraft {
	name: string;
}

export function parseGroup(value: unknown): Group {
	return parseItemBase(value, ItemType.Group);
}
