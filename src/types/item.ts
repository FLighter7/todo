export enum Status {
	Opened = 1,
	Done = 2,
	Cancelled = 3,
}

/**
 * What kind of record an item is. The numbers are what IndexedDB, backups and
 * sync payloads store, so the list is append-only: a value is never renumbered
 * or reused, only added.
 */
export enum ItemType {
	Task = 1,
	Group = 2,
	Goal = 3,
	Dream = 4,
}

export interface ItemBase {
	id: string;
	type: ItemType;
	name: string;
	note?: string;
	/** ISO 8601 timestamp in UTC. */
	created: string;
	/** ISO 8601 timestamp in UTC, moved on every user-facing change. Drives sync merges. */
	updated: string;
	status: Status;
}

/**
 * Thrown when data crossing a boundary — a backup file, an IndexedDB row —
 * does not describe a valid record. A real `enum` lets the compiler wave
 * `value as Status` through, so the check has to happen at runtime.
 */
export class ItemFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ItemFormatError';
	}
}

export function isStatus(value: unknown): value is Status {
	return value === Status.Opened || value === Status.Done || value === Status.Cancelled;
}

/**
 * An explicit check rather than `Object.values(ItemType)`: a numeric enum's
 * values also hold the reverse-mapped names ('Task', 'Group', ...).
 */
export function isItemType(value: unknown): value is ItemType {
	return (
		value === ItemType.Task ||
		value === ItemType.Group ||
		value === ItemType.Goal ||
		value === ItemType.Dream
	);
}

export function isRecordObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function fail(reason: string): never {
	throw new ItemFormatError(reason);
}

export function readString(entry: Record<string, unknown>, key: string): string {
	const value = entry[key];
	if (typeof value !== 'string') {
		fail(`"${key}" must be a string`);
	}

	return value;
}

export function readOptionalString(
	entry: Record<string, unknown>,
	key: string,
): string | undefined {
	const value = entry[key];
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'string') {
		fail(`"${key}" must be a string when present`);
	}

	return value;
}

export function readBoolean(entry: Record<string, unknown>, key: string): boolean {
	const value = entry[key];
	if (typeof value !== 'boolean') {
		fail(`"${key}" must be true or false`);
	}

	return value;
}

export function readOptionalBoolean(
	entry: Record<string, unknown>,
	key: string,
): boolean | undefined {
	const value = entry[key];
	if (value === undefined) {
		return undefined;
	}

	if (typeof value !== 'boolean') {
		fail(`"${key}" must be true or false when present`);
	}

	return value;
}

/**
 * Checks the shared fields and that the record is of the `type` the caller
 * expects: each per-type parser passes its own, so a goal handed to
 * `parseTask` is refused rather than read with a goal's fields missing.
 */
export function parseItemBase<K extends ItemType>(value: unknown, type: K): ItemBase & { type: K } {
	if (!isRecordObject(value)) {
		fail('the record is not an object');
	}

	if (value.type !== type) {
		fail(`"type" must be ${type} (${ItemType[type]})`);
	}

	if (!isStatus(value.status)) {
		fail('"status" must be one of Opened, Done, Cancelled');
	}

	return {
		id: readString(value, 'id'),
		type,
		name: readString(value, 'name'),
		note: readOptionalString(value, 'note'),
		created: readString(value, 'created'),
		updated: readString(value, 'updated'),
		status: value.status,
	};
}
