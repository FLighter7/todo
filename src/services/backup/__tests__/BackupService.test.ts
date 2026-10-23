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
	it('creates a version 4 backup holding every item in one list', () => {
		const backup = backupService.create([dream, goal, task]);

		expect(backup.version).toBe(4);
		expect(backup.items).toEqual([dream, goal, task]);
		expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
	});

	it('includes closed records', () => {
		const closed = { ...task, status: Status.Cancelled };
		expect(backupService.create([closed]).items).toEqual([closed]);
	});
});

describe('BackupService.create settings', () => {
	it('leaves settings undefined when none are given', () => {
		const backup = backupService.create([]);
		expect(backup.settings).toBeUndefined();
	});

	it('includes a defensive copy of the given settings', () => {
		const settings: AppSettings = DEFAULT_SETTINGS;
		const backup = backupService.create([], settings);

		expect(backup.settings).toEqual(settings);
		expect(backup.settings).not.toBe(settings);
		expect(backup.settings?.general).not.toBe(settings.general);
	});
});

describe('BackupService.parse', () => {
	it('reads a version 4 file back', () => {
		const text = serialize(backupService.create([dream, goal, task]));
		const parsed = backupService.parse(text);

		expect(parsed.items).toEqual([dream, goal, task]);
	});

	// A tombstone has to survive an actual file, not just the in-memory object
	// `create()` returns: this is what an export followed by a restore does.
	it('keeps a closed record through create, JSON.stringify and parse', () => {
		const closed = { ...task, status: Status.Cancelled };
		const text = serialize(backupService.create([closed]));

		const parsed = backupService.parse(text);

		expect(parsed.items).toEqual([closed]);
	});

	it('accepts a backup with no items', () => {
		const text = serialize({ version: 4, exportedAt: '', items: [] });

		expect(backupService.parse(text).items).toEqual([]);
	});

	it('rejects a version 1, 2 or 3 file', () => {
		const files = [
			{ version: 1, exportedAt: '', todos: [] },
			{ version: 2, exportedAt: '', todos: [] },
			{ version: 3, exportedAt: '', dreams: [], goals: [], tasks: [] },
		];

		for (const file of files) {
			expect(() => backupService.parse(serialize(file))).toThrow(BackupFormatError);
		}
	});

	it('rejects a file whose version does not match the one this app supports', () => {
		expect(() => backupService.parse(serialize({ version: 5, items: [] }))).toThrow(
			BackupFormatError,
		);
	});

	it('names the index of a broken record', () => {
		const text = serialize({ version: 4, exportedAt: '', items: [dream, { id: 'a' }] });

		expect(() => backupService.parse(text)).toThrow(/items\[1\]/);
	});

	it('rejects a record of an unknown type', () => {
		const text = serialize({ version: 4, exportedAt: '', items: [{ ...dream, type: 9 }] });

		expect(() => backupService.parse(text)).toThrow(/items\[0\]/);
	});

	it('rejects two records sharing an id, even of different types', () => {
		const text = serialize({
			version: 4,
			exportedAt: '',
			items: [dream, { ...goal, id: dream.id }],
		});

		expect(() => backupService.parse(text)).toThrow(/items\[1\].*dream-1/);
	});

	it('rejects a file with no items list', () => {
		expect(() => backupService.parse(serialize({ version: 4, exportedAt: '' }))).toThrow(/"items"/);
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
		const text = serialize(backupService.create([], DEFAULT_SETTINGS));
		const parsed = backupService.parse(text);
		expect(parsed.settings).toEqual(DEFAULT_SETTINGS);
	});

	it('leaves settings undefined when the file has none', () => {
		const text = serialize(backupService.create([]));
		const parsed = backupService.parse(text);
		expect(parsed.settings).toBeUndefined();
	});

	it('rejects a corrupt settings block with an addressed error', () => {
		const text = serialize({
			version: 4,
			exportedAt: '',
			items: [],
			settings: { general: { theme: 'blue' } },
		});

		expect(() => backupService.parse(text)).toThrow(/settings/);
	});
});
