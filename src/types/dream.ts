import { ItemType, parseItemBase, type ItemBase } from './item';
import { readSectionColor, type SectionColor } from './color';

/**
 * A dream carries nothing beyond the shared base but the colour of the section
 * its goals sit in. Its `type` is what tells it apart from a group, which has
 * the same shape.
 */
export interface Dream extends ItemBase, SectionColor {
	type: ItemType.Dream;
}

export interface DreamDraft extends SectionColor {
	name: string;
	note?: string;
}

export function parseDream(value: unknown): Dream {
	const base = parseItemBase(value, ItemType.Dream);
	return { ...base, ...readSectionColor(value as Record<string, unknown>) };
}
