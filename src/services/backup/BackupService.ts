import {
	EntityFormatError,
	parseDream,
	parseGoal,
	parseTask,
	type Dream,
	type Goal,
	type Task,
} from '@/types';

export const BACKUP_VERSION = 3;

export interface Backup {
	version: number;
	/** ISO 8601 timestamp in UTC. */
	exportedAt: string;
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}

export class BackupFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupFormatError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Wraps the shared parsers so a bad record reports where it is. The parsers
 * already say what is wrong with it; only its address has to be added.
 */
function readAll<T>(raw: unknown, collection: string, parse: (value: unknown) => T): T[] {
	if (!Array.isArray(raw)) {
		throw new BackupFormatError(`The backup has no "${collection}" list`);
	}

	return raw.map((value, index) => {
		try {
			return parse(value);
		} catch (error) {
			if (error instanceof EntityFormatError) {
				throw new BackupFormatError(`${collection}[${index}] is invalid: ${error.message}`);
			}

			throw error;
		}
	});
}

export class BackupService {
	create(dreams: Dream[], goals: Goal[], tasks: Task[]): Backup {
		return {
			version: BACKUP_VERSION,
			exportedAt: new Date().toISOString(),
			// Closed records are included on purpose: a backup restores a complete
			// state, and dropping the tombstones would resurrect everything ever
			// finished or abandoned.
			dreams: dreams.map((dream) => ({ ...dream })),
			goals: goals.map((goal) => ({ ...goal })),
			tasks: tasks.map((task) => ({ ...task })),
		};
	}

	/**
	 * Parses and fully validates a backup file. Callers may only touch storage
	 * after this returns: a malformed file must never cost the user their data.
	 */
	parse(text: string): Backup {
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

		// Versions 1 and 2 held a single `todos` list against a model this app no
		// longer has. Guessing at a migration would invent dreams and goals that
		// were never written, so the file is refused instead.
		if (raw.version !== BACKUP_VERSION) {
			throw new BackupFormatError(
				`This app reads backup version ${BACKUP_VERSION} only, and the file is version ${raw.version}`,
			);
		}

		return {
			version: raw.version,
			exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
			dreams: readAll(raw.dreams, 'dreams', parseDream),
			goals: readAll(raw.goals, 'goals', parseGoal),
			tasks: readAll(raw.tasks, 'tasks', parseTask),
		};
	}
}

export const backupService = new BackupService();
