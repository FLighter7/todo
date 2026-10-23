import { parseItemBase, type ItemBase } from './item';

/**
 * A dream carries nothing beyond the shared base yet. The distinct type
 * still earns its place: it keeps stores and repositories for the three
 * entities from being interchangeable by accident.
 */
export type Dream = ItemBase;

export interface DreamDraft {
	name: string;
	note?: string;
}

export function parseDream(value: unknown): Dream {
	return parseItemBase(value);
}
