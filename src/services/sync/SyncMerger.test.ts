import { describe, expect, it } from 'vitest';
import type { Todo } from '@/types/todo';
import { SyncMerger } from './SyncMerger';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-01T10:00:00.000Z',
		updated: '2026-08-01T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

function byId(todos: Todo[]): Record<string, Todo> {
	return Object.fromEntries(todos.map((todo) => [todo.id, todo]));
}

const merger = new SyncMerger();

describe('SyncMerger.merge', () => {
	it('returns nothing when both sides are empty', () => {
		expect(merger.merge([], [])).toEqual([]);
	});

	it('keeps a record that exists only locally', () => {
		const local = [makeTodo()];

		expect(merger.merge(local, [])).toEqual(local);
	});

	it('takes a record that exists only remotely', () => {
		const remote = [makeTodo({ id: 'remote-only' })];

		expect(merger.merge([], remote)).toEqual(remote);
	});

	it('keeps the local version when it was updated later', () => {
		const local = [makeTodo({ title: 'Local wins', updated: '2026-08-02T00:00:00.000Z' })];
		const remote = [makeTodo({ title: 'Remote loses', updated: '2026-08-01T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].title).toBe('Local wins');
	});

	it('takes the remote version when it was updated later', () => {
		const local = [makeTodo({ title: 'Local loses', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTodo({ title: 'Remote wins', updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].title).toBe('Remote wins');
	});

	it('prefers the local version on identical timestamps so the result is deterministic', () => {
		const local = [makeTodo({ title: 'Local' })];
		const remote = [makeTodo({ title: 'Remote' })];

		expect(merger.merge(local, remote)[0].title).toBe('Local');
		expect(merger.merge(remote, local)[0].title).toBe('Remote');
	});

	it('lets a newer tombstone win over an older edit', () => {
		const local = [makeTodo({ title: 'Edited', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTodo({ deleted: true, updated: '2026-08-02T00:00:00.000Z' })];

		expect(merger.merge(local, remote)[0].deleted).toBe(true);
	});

	it('lets a newer edit win over an older tombstone', () => {
		const local = [makeTodo({ title: 'Resurrected', updated: '2026-08-03T00:00:00.000Z' })];
		const remote = [makeTodo({ deleted: true, updated: '2026-08-02T00:00:00.000Z' })];

		const merged = merger.merge(local, remote)[0];
		expect(merged.deleted).toBe(false);
		expect(merged.title).toBe('Resurrected');
	});

	it('keeps a tombstone that only the remote side knows about', () => {
		const remote = [makeTodo({ id: 'gone', deleted: true })];

		expect(merger.merge([], remote)[0].deleted).toBe(true);
	});

	it('combines records from both sides', () => {
		const local = [makeTodo({ id: 'a' }), makeTodo({ id: 'b' })];
		const remote = [makeTodo({ id: 'b' }), makeTodo({ id: 'c' })];

		const merged = merger.merge(local, remote);

		expect(merged).toHaveLength(3);
		expect(Object.keys(byId(merged)).sort()).toEqual(['a', 'b', 'c']);
	});

	it('does not mutate either input', () => {
		const local = [makeTodo({ title: 'Local', updated: '2026-08-01T00:00:00.000Z' })];
		const remote = [makeTodo({ title: 'Remote', updated: '2026-08-02T00:00:00.000Z' })];
		const localCopy = structuredClone(local);
		const remoteCopy = structuredClone(remote);

		merger.merge(local, remote);

		expect(local).toEqual(localCopy);
		expect(remote).toEqual(remoteCopy);
	});

	it('is idempotent: merging the result again changes nothing', () => {
		const local = [
			makeTodo({ id: 'a' }),
			makeTodo({ id: 'b', updated: '2026-08-05T00:00:00.000Z' }),
		];
		const remote = [makeTodo({ id: 'b' }), makeTodo({ id: 'c', deleted: true })];

		const once = merger.merge(local, remote);
		const twice = merger.merge(once, remote);

		expect(byId(twice)).toEqual(byId(once));
	});

	it('gives the same result regardless of which side runs it', () => {
		const local = [makeTodo({ id: 'a', updated: '2026-08-04T00:00:00.000Z' })];
		const remote = [
			makeTodo({ id: 'a', updated: '2026-08-05T00:00:00.000Z' }),
			makeTodo({ id: 'b' }),
		];

		expect(byId(merger.merge(local, remote))).toEqual(byId(merger.merge(remote, local)));
	});
});
