import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types/todo';
import { BACKUP_VERSION, BackupFormatError, createBackup, parseBackup } from './format';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		...overrides,
	};
}

function serialize(value: unknown): string {
	return JSON.stringify(value);
}

describe('createBackup', () => {
	it('wraps todos with the current version and a timestamp', () => {
		const backup = createBackup([makeTodo()]);

		expect(backup.version).toBe(BACKUP_VERSION);
		expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
		expect(backup.todos).toHaveLength(1);
	});

	it('round-trips through parseBackup', () => {
		const todos = [makeTodo(), makeTodo({ id: 'id-2', period: 'periodic', done: true })];

		const parsed = parseBackup(serialize(createBackup(todos)));

		expect(parsed.todos).toEqual(todos);
	});
});

describe('parseBackup', () => {
	it('accepts an empty list', () => {
		const parsed = parseBackup(
			serialize({ version: 1, exportedAt: '2026-08-06T10:00:00.000Z', todos: [] }),
		);

		expect(parsed.todos).toEqual([]);
	});

	it('keeps an optional note', () => {
		const parsed = parseBackup(serialize(createBackup([makeTodo({ note: 'with milk' })])));

		expect(parsed.todos[0].note).toBe('with milk');
	});

	it('rejects text that is not json', () => {
		expect(() => parseBackup('not json at all')).toThrow(BackupFormatError);
	});

	it('rejects a bare array', () => {
		expect(() => parseBackup(serialize([makeTodo()]))).toThrow(BackupFormatError);
	});

	it('rejects null', () => {
		expect(() => parseBackup(serialize(null))).toThrow(BackupFormatError);
	});

	it('rejects a missing todos array', () => {
		expect(() => parseBackup(serialize({ version: 1, exportedAt: 'x' }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects a version newer than supported', () => {
		const text = serialize({ version: BACKUP_VERSION + 1, exportedAt: 'x', todos: [] });

		expect(() => parseBackup(text)).toThrow(/newer/i);
	});

	it('rejects a missing required field', () => {
		const todo = makeTodo();
		delete (todo as Partial<Todo>).title;

		expect(() => parseBackup(serialize({ version: 1, exportedAt: 'x', todos: [todo] }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects a field of the wrong type', () => {
		const todo = { ...makeTodo(), done: 'yes' };

		expect(() => parseBackup(serialize({ version: 1, exportedAt: 'x', todos: [todo] }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects an unknown period value', () => {
		const todo = { ...makeTodo(), period: 'weekly' };

		expect(() => parseBackup(serialize({ version: 1, exportedAt: 'x', todos: [todo] }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects a non-object entry inside todos', () => {
		expect(() => parseBackup(serialize({ version: 1, exportedAt: 'x', todos: ['nope'] }))).toThrow(
			BackupFormatError,
		);
	});

	it('reports which entry failed so the file can be fixed', () => {
		const todos = [makeTodo(), { ...makeTodo({ id: 'id-2' }), title: 42 }];

		expect(() => parseBackup(serialize({ version: 1, exportedAt: 'x', todos }))).toThrow(/1/);
	});
});
