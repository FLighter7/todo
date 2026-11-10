import { ItemType, parseItemBase, type ItemBase } from './item';
import { readSectionColor, type SectionColor } from './color';

/**
 * A plain way to gather tasks, with no dream, deadline or note behind it --
 * a name and a colour. A task joins one through `Task.groupId`, independently
 * of its goal: a task can sit in a goal and a group at once. No list sections
 * by group yet, so the colour shows in the group's own dialog alone.
 */
export interface Group extends ItemBase, SectionColor {
	type: ItemType.Group;
}

export interface GroupDraft extends SectionColor {
	name: string;
}

export function parseGroup(value: unknown): Group {
	const base = parseItemBase(value, ItemType.Group);
	return { ...base, ...readSectionColor(value as Record<string, unknown>) };
}
