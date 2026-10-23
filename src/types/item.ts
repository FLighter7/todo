export enum Status {
	Opened = 1,
	Done = 2,
	Cancelled = 3,
}

export interface ItemBase {
	id: string;
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

export function parseItemBase(value: unknown): ItemBase {
	if (!isRecordObject(value)) {
		fail('the record is not an object');
	}

	if (!isStatus(value.status)) {
		fail('"status" must be one of Opened, Done, Cancelled');
	}

	return {
		id: readString(value, 'id'),
		name: readString(value, 'name'),
		note: readOptionalString(value, 'note'),
		created: readString(value, 'created'),
		updated: readString(value, 'updated'),
		status: value.status,
	};
}
