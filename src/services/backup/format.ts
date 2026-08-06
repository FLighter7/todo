import type { Todo, TodoPeriod } from '@/types/todo';

export const BACKUP_VERSION = 1;

export interface TodoBackup {
	version: number;
	/** ISO 8601 timestamp in UTC. */
	exportedAt: string;
	todos: Todo[];
}

export class BackupFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupFormatError';
	}
}

const PERIODS: readonly TodoPeriod[] = ['one-time', 'periodic'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTodo(value: unknown, index: number): Todo {
	const fail = (reason: string): never => {
		throw new BackupFormatError(`Task ${index} is invalid: ${reason}`);
	};

	if (!isRecord(value)) {
		fail('it is not an object');
	}

	const entry = value as Record<string, unknown>;

	for (const key of ['id', 'title', 'created'] as const) {
		if (typeof entry[key] !== 'string') fail(`"${key}" must be a string`);
	}

	for (const key of ['important', 'urgent', 'done'] as const) {
		if (typeof entry[key] !== 'boolean') fail(`"${key}" must be true or false`);
	}

	if (!PERIODS.includes(entry.period as TodoPeriod)) {
		fail(`"period" must be one of ${PERIODS.join(', ')}`);
	}

	if (entry.note !== undefined && typeof entry.note !== 'string') {
		fail('"note" must be a string when present');
	}

	return {
		id: entry.id as string,
		title: entry.title as string,
		note: entry.note as string | undefined,
		created: entry.created as string,
		period: entry.period as TodoPeriod,
		important: entry.important as boolean,
		urgent: entry.urgent as boolean,
		done: entry.done as boolean,
	};
}

export function createBackup(todos: Todo[]): TodoBackup {
	return {
		version: BACKUP_VERSION,
		exportedAt: new Date().toISOString(),
		todos: todos.map((todo) => ({ ...todo })),
	};
}

/**
 * Parses and fully validates a backup file. Callers may only touch storage
 * after this returns: a malformed file must never cost the user their list.
 */
export function parseBackup(text: string): TodoBackup {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new BackupFormatError('The file is not valid JSON');
	}

	if (!isRecord(raw)) {
		throw new BackupFormatError('The file does not contain a backup object');
	}

	if (typeof raw.version !== 'number') {
		throw new BackupFormatError('The backup has no version');
	}

	if (raw.version > BACKUP_VERSION) {
		throw new BackupFormatError(
			`The backup is newer than this app supports (version ${raw.version})`,
		);
	}

	if (!Array.isArray(raw.todos)) {
		throw new BackupFormatError('The backup has no list of tasks');
	}

	return {
		version: raw.version,
		exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
		todos: raw.todos.map(readTodo),
	};
}
