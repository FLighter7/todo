import { ItemType, parseItemBase, type ItemBase } from './item';

/**
 * A dream carries nothing beyond the shared base yet. Its `type` is what tells
 * it apart from a group, which has the same shape.
 */
export interface Dream extends ItemBase {
	type: ItemType.Dream;
}

export interface DreamDraft {
	name: string;
	note?: string;
}

export function parseDream(value: unknown): Dream {
	return parseItemBase(value, ItemType.Dream);
}
