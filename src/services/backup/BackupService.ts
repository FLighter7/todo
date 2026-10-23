import {
	ItemFormatError,
	SettingsFormatError,
	parseItem,
	parseSettings,
	type AppSettings,
	type Item,
} from '@/types';

export const BACKUP_VERSION = 4;

export interface Backup {
	version: number;
	/** ISO 8601 timestamp in UTC. */
	exportedAt: string;
	items: Item[];
	settings?: AppSettings;
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
 * Wraps `parseItem` so a bad record reports where it is. The parsers already
 * say what is wrong with it; only its address has to be added.
 *
 * Ids are checked for uniqueness too: every type shares one IndexedDB key
 * space, so two records with the same id -- a hand-edited file, say -- would
 * otherwise collapse into one on restore without a word.
 */
function readItems(raw: unknown): Item[] {
	if (!Array.isArray(raw)) {
		throw new BackupFormatError('The backup has no "items" list');
	}

	const seen = new Set<string>();

	return raw.map((value, index) => {
		let item: Item;
		try {
			item = parseItem(value);
		} catch (error) {
			if (error instanceof ItemFormatError) {
				throw new BackupFormatError(`items[${index}] is invalid: ${error.message}`);
			}

			throw error;
		}

		if (seen.has(item.id)) {
			throw new BackupFormatError(`items[${index}] repeats the id "${item.id}"`);
		}
		seen.add(item.id);

		return item;
	});
}

/**
 * Wraps `parseSettings` the same way `readItems` wraps `parseItem`:
 * the settings document is not a collection, so it gets one address
 * ("settings") instead of an index.
 */
function readSettings(raw: unknown): AppSettings | undefined {
	if (raw === undefined) {
		return undefined;
	}

	try {
		return parseSettings(raw);
	} catch (error) {
		if (error instanceof SettingsFormatError) {
			throw new BackupFormatError(`settings is invalid: ${error.message}`);
		}

		throw error;
	}
}

export class BackupService {
	create(items: Item[], settings?: AppSettings): Backup {
		return {
			version: BACKUP_VERSION,
			exportedAt: new Date().toISOString(),
			// Closed records are included on purpose: a backup restores a complete
			// state, and dropping the tombstones would resurrect everything ever
			// finished or abandoned.
			items: items.map((item) => ({ ...item })),
			settings:
				settings === undefined
					? undefined
					: {
							general: { ...settings.general },
							dreams: { ...settings.dreams },
							goals: { ...settings.goals },
							tasks: { ...settings.tasks },
						},
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

		// Versions 1 and 2 held a single `todos` list, version 3 separate
		// dreams/goals/tasks lists with no `type` on a record. Neither is carried
		// forward: the data model moved on, and the move deliberately started
		// clean rather than guess at a migration, so older files are refused.
		if (raw.version !== BACKUP_VERSION) {
			throw new BackupFormatError(
				`This app reads backup version ${BACKUP_VERSION} only, and the file is version ${raw.version}`,
			);
		}

		return {
			version: raw.version,
			exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
			items: readItems(raw.items),
			settings: readSettings(raw.settings),
		};
	}
}

export const backupService = new BackupService();
