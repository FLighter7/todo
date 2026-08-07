import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types/todo';
import { BACKUP_VERSION, BackupFormatError, BackupService } from './BackupService';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

function serialize(value: unknown): string {
	return JSON.stringify(value);
}

const service = new BackupService();

describe('BackupService.create', () => {
	it('wraps todos with the current version and a timestamp', () => {
		const backup = service.create([makeTodo()]);

		expect(backup.version).toBe(BACKUP_VERSION);
		expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
		expect(backup.todos).toHaveLength(1);
	});

	it('round-trips through parse', () => {
		const todos = [makeTodo(), makeTodo({ id: 'id-2', period: 'periodic', done: true })];

		const parsed = service.parse(serialize(service.create(todos)));

		expect(parsed.todos).toEqual(todos);
	});
});

describe('BackupService.parse', () => {
	it('accepts an empty list', () => {
		const parsed = service.parse(
			serialize({ version: 1, exportedAt: '2026-08-06T10:00:00.000Z', todos: [] }),
		);

		expect(parsed.todos).toEqual([]);
	});

	it('keeps an optional note', () => {
		const parsed = service.parse(serialize(service.create([makeTodo({ note: 'with milk' })])));

		expect(parsed.todos[0].note).toBe('with milk');
	});

	it('rejects text that is not json', () => {
		expect(() => service.parse('not json at all')).toThrow(BackupFormatError);
	});

	it('rejects a bare array', () => {
		expect(() => service.parse(serialize([makeTodo()]))).toThrow(BackupFormatError);
	});

	it('rejects null', () => {
		expect(() => service.parse(serialize(null))).toThrow(BackupFormatError);
	});

	it('rejects a missing todos array', () => {
		expect(() => service.parse(serialize({ version: 1, exportedAt: 'x' }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects a version newer than supported', () => {
		const text = serialize({ version: BACKUP_VERSION + 1, exportedAt: 'x', todos: [] });

		expect(() => service.parse(text)).toThrow(/newer/i);
	});

	it('rejects a missing required field', () => {
		const todo = makeTodo();
		delete (todo as Partial<Todo>).title;

		expect(() => service.parse(serialize({ version: 1, exportedAt: 'x', todos: [todo] }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects a field of the wrong type', () => {
		const todo = { ...makeTodo(), done: 'yes' };

		expect(() => service.parse(serialize({ version: 1, exportedAt: 'x', todos: [todo] }))).toThrow(
			BackupFormatError,
		);
	});

	it('rejects an unknown period value', () => {
		const todo = { ...makeTodo(), period: 'weekly' };

		expect(() => service.parse(serialize({ version: 1, exportedAt: 'x', todos: [todo] }))).toThrow(
			BackupFormatError,
		);
	});

	it('reads a version 1 file and fills in the sync fields', () => {
		const legacy = {
			id: 'old-1',
			title: 'Written before sync existed',
			created: '2026-07-01T09:00:00.000Z',
			period: 'one-time',
			important: true,
			urgent: false,
			done: false,
		};

		const parsed = service.parse(serialize({ version: 1, exportedAt: 'x', todos: [legacy] }));

		expect(parsed.todos[0].updated).toBe(legacy.created);
		expect(parsed.todos[0].deleted).toBe(false);
	});

	it('keeps tombstones from a version 2 file', () => {
		const text = serialize(service.create([makeTodo({ deleted: true })]));

		expect(service.parse(text).todos[0].deleted).toBe(true);
	});

	it('rejects a non-object entry inside todos', () => {
		expect(() => service.parse(serialize({ version: 1, exportedAt: 'x', todos: ['nope'] }))).toThrow(
			BackupFormatError,
		);
	});

	it('reports which entry failed so the file can be fixed', () => {
		const todos = [makeTodo(), { ...makeTodo({ id: 'id-2' }), title: 42 }];

		expect(() => service.parse(serialize({ version: 1, exportedAt: 'x', todos }))).toThrow(/1/);
	});
});
