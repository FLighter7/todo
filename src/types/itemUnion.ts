import { ItemType, fail, isItemType, isRecordObject } from './item';
import { parseDream, type Dream, type DreamDraft } from './dream';
import { parseGoal, type Goal, type GoalDraft } from './goal';
import { parseGroup, type Group, type GroupDraft } from './group';
import { parseTask, type Task, type TaskDraft } from './task';

/**
 * The one place that ties each `ItemType` to its record and draft shapes.
 * Kept out of `item.ts`, which every per-type file imports from, so the
 * imports never run in a circle.
 */
export interface ItemTypeMap {
	[ItemType.Task]: Task;
	[ItemType.Group]: Group;
	[ItemType.Goal]: Goal;
	[ItemType.Dream]: Dream;
}

export interface DraftTypeMap {
	[ItemType.Task]: TaskDraft;
	[ItemType.Group]: GroupDraft;
	[ItemType.Goal]: GoalDraft;
	[ItemType.Dream]: DreamDraft;
}

export type Item = ItemTypeMap[ItemType];
export type ItemOf<K extends ItemType> = ItemTypeMap[K];
export type DraftOf<K extends ItemType> = DraftTypeMap[K];

/**
 * What an update may change. `type` is left out on purpose: switching it by
 * patch would leave the old type's fields behind in memory and on disk, so a
 * future type change has to rebuild the record instead.
 */
export type ItemPatch<K extends ItemType> = Partial<
	Omit<ItemOf<K>, 'id' | 'type' | 'created' | 'updated'>
>;

export function isTask(item: Item): item is Task {
	return item.type === ItemType.Task;
}

export function isGroup(item: Item): item is Group {
	return item.type === ItemType.Group;
}

export function isGoal(item: Item): item is Goal {
	return item.type === ItemType.Goal;
}

export function isDream(item: Item): item is Dream {
	return item.type === ItemType.Dream;
}

/** A mapped type, so leaving a new `ItemType` without a parser fails to compile. */
const PARSERS: { [K in ItemType]: (value: unknown) => ItemOf<K> } = {
	[ItemType.Task]: parseTask,
	[ItemType.Group]: parseGroup,
	[ItemType.Goal]: parseGoal,
	[ItemType.Dream]: parseDream,
};

/**
 * Reads any item by its `type`. An unknown type is a format error like any
 * other: on load the row is skipped and counted, in a backup or a sync
 * payload the whole thing is refused.
 */
export function parseItem(value: unknown): Item {
	if (!isRecordObject(value)) {
		fail('the record is not an object');
	}

	if (!isItemType(value.type)) {
		fail('"type" must be one of 1 (Task), 2 (Group), 3 (Goal), 4 (Dream)');
	}

	return PARSERS[value.type](value);
}
