import { parseEntityBase, type EntityBase } from './entity';

/**
 * A dream carries nothing beyond the shared base yet. The distinct type
 * still earns its place: it keeps stores and repositories for the three
 * entities from being interchangeable by accident.
 */
export type Dream = EntityBase;

export function parseDream(value: unknown): Dream {
	return parseEntityBase(value);
}
