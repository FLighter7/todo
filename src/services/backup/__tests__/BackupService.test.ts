import { describe, expect, it } from 'vitest';
import {
	ItemType,
	DEFAULT_SETTINGS,
	Status,
	type AppSettings,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
import { BackupFormatError, BackupService } from '../BackupService';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
		id: 'dream-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		type: ItemType.Goal,
		id: 'goal-1',
		name: 'Save for the trip',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		type: ItemType.Task,
		id: 'task-1',
		name: 'Book flights',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

function serialize(value: unknown): string {
	return JSON.stringify(value);
}

const dream = makeDream();
const goal = makeGoal();
const task = makeTask();

const backupService = new BackupService();

describe('BackupService.create', () => {
	it('creates a version 3 backup holding all three collections', () => {
		const backup = backupService.create([dream], [goal], [task]);

		expect(backup.version).toBe(3);
		expect(backup.dreams).toEqual([dream]);
		expect(backup.goals).toEqual([goal]);
		expect(backup.tasks).toEqual([task]);
		expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
	});

	it('includes closed records', () => {
		const closed = { ...task, status: Status.Cancelled };
		expect(backupService.create([], [], [closed]).tasks).toEqual([closed]);
	});
});

describe('BackupService.create settings', () => {
	it('leaves settings undefined when none are given', () => {
		const backup = backupService.create([], [], []);
		expect(backup.settings).toBeUndefined();
	});

	it('includes a defensive copy of the given settings', () => {
		const settings: AppSettings = DEFAULT_SETTINGS;
		const backup = backupService.create([], [], [], settings);

		expect(backup.settings).toEqual(settings);
		expect(backup.settings).not.toBe(settings);
		expect(backup.settings?.general).not.toBe(settings.general);
	});
});

describe('BackupService.parse', () => {
	it('reads a version 3 file back', () => {
		const text = serialize(backupService.create([dream], [goal], [task]));
		const parsed = backupService.parse(text);

		expect(parsed.dreams).toEqual([dream]);
		expect(parsed.goals).toEqual([goal]);
		expect(parsed.tasks).toEqual([task]);
	});

	// A tombstone has to survive an actual file, not just the in-memory object
	// `create()` returns: this is what an export followed by a restore does.
	it('keeps a closed record through create, JSON.stringify and parse', () => {
		const closed = { ...task, status: Status.Cancelled };
		const text = serialize(backupService.create([], [], [closed]));

		const parsed = backupService.parse(text);

		expect(parsed.tasks).toEqual([closed]);
	});

	it('accepts a backup whose three collections are all empty', () => {
		const text = serialize({ version: 3, exportedAt: '', dreams: [], goals: [], tasks: [] });

		const parsed = backupService.parse(text);

		expect(parsed.dreams).toEqual([]);
		expect(parsed.goals).toEqual([]);
		expect(parsed.tasks).toEqual([]);
	});

	it('rejects a version 1 or 2 file', () => {
		for (const version of [1, 2]) {
			const text = serialize({ version, exportedAt: '', todos: [] });
			expect(() => backupService.parse(text)).toThrow(BackupFormatError);
		}
	});

	it('rejects a file whose version does not match the one this app supports', () => {
		expect(() => backupService.parse(serialize({ version: 4 }))).toThrow(BackupFormatError);
	});

	it('names the collection and the index of a broken record', () => {
		const text = serialize({
			version: 3,
			exportedAt: '',
			dreams: [],
			goals: [],
			tasks: [{ id: 'a' }],
		});

		expect(() => backupService.parse(text)).toThrow(/tasks.*0/);
	});

	it('rejects a file missing any of the three collections, naming which one', () => {
		for (const collection of ['dreams', 'goals', 'tasks'] as const) {
			const backup: Record<string, unknown> = {
				version: 3,
				exportedAt: '',
				dreams: [],
				goals: [],
				tasks: [],
			};
			delete backup[collection];

			expect(() => backupService.parse(serialize(backup))).toThrow(new RegExp(`"${collection}"`));
		}
	});

	it('rejects a file that is not JSON', () => {
		expect(() => backupService.parse('{')).toThrow(BackupFormatError);
	});

	it('rejects a top-level bare array', () => {
		expect(() => backupService.parse('[]')).toThrow(BackupFormatError);
	});

	it('rejects a top-level null', () => {
		expect(() => backupService.parse('null')).toThrow(BackupFormatError);
	});
});

describe('BackupService.parse settings', () => {
	it('round-trips settings through create, JSON.stringify and parse', () => {
		const text = serialize(backupService.create([], [], [], DEFAULT_SETTINGS));
		const parsed = backupService.parse(text);
		expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
	});

	it('leaves settings undefined when the file has none', () => {
		const text = serialize(backupService.create([], [], []));
		const parsed = backupService.parse(text);
		expect(parsed.settings).toBeUndefined();
	});

	it('rejects a corrupt settings block with an addressed error', () => {
		const text = serialize({
			version: 3,
			exportedAt: '',
			dreams: [],
			goals: [],
			tasks: [],
			settings: { general: { theme: 'blue' } },
		});

		expect(() => backupService.parse(text)).toThrow(/settings/);
	});
});
