import { describe, expect, it, vi } from 'vitest';
import {
	DocumentError,
	SyncEngine,
	type Pairing,
	type SyncState,
} from '@flighter7/workspace-client';
import { FakeServer } from '@flighter7/workspace-client/testing';
import { Status, type Item, type Task } from '@/types';
import {
	decodeSyncDocument,
	encodeSyncDocument,
	type SyncDocumentErrorCode,
} from '../syncDocument';
import { createTodoSyncAdapter } from '../todoSyncAdapter';
import { makeDream, makePairing, makeTask } from './fixtures';

const START = new Date('2026-11-07T12:00:00.000Z').getTime();
const NOW = new Date(START);
const EMPTY = { etag: null, body: new Uint8Array(0) };

function source(local: Item[], cleanupDays = 30) {
	const state = { local };
	const replaceLocalItems = vi.fn(async (items: Item[]) => {
		state.local = items;
	});
	const adapter = createTodoSyncAdapter({
		localItems: () => state.local,
		replaceLocalItems,
		cleanupDays: () => cleanupDays,
		changeCount: () => 7,
	});

	return { state, adapter, replaceLocalItems };
}

describe('createTodoSyncAdapter', () => {
	it('passes the change count through', () => {
		expect(source([]).adapter.changeCount()).toBe(7);
	});

	it('writes local items to an empty server and changes nothing here', () => {
		const { adapter } = source([makeTask()]);

		const plan = adapter.plan(EMPTY, NOW);

		expect(plan.apply).toBeUndefined();
		expect(decodeSyncDocument(plan.write ?? new Uint8Array(0))).toEqual([makeTask()]);
	});

	it('takes a newer server item without writing', async () => {
		const newer = makeTask({ name: 'Buy oat milk', updated: '2026-11-06T10:00:00.000Z' });
		const { adapter, state } = source([makeTask({ updated: '2026-11-05T10:00:00.000Z' })]);

		const plan = adapter.plan({ etag: 'e1', body: encodeSyncDocument([newer], NOW) }, NOW);
		await plan.apply?.();

		expect(plan.write).toBeNull();
		expect(state.local).toEqual([newer]);
	});

	it('refuses a document from a newer build', () => {
		const { adapter } = source([makeTask()]);
		const body = new TextEncoder().encode(
			JSON.stringify({ version: 4, exportedAt: '', items: [], syncSchema: 99 }),
		);

		expect(() => adapter.plan({ etag: 'e1', body }, NOW)).toThrow(DocumentError);
	});
});

/*
 * This app's merge rules through the package's engine and its in-memory
 * server: what has to hold across devices, not only within one merge.
 */

interface Timer {
	callback: () => void;
	ms: number;
	cleared: boolean;
}

/** Lets every queued promise callback run. */
function settle(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function device(server: FakeServer, options: { local?: Item[]; cleanupDays?: number } = {}) {
	const state = {
		local: options.local ?? [],
		changeCount: 0,
		pairing: makePairing() as Pairing | null,
	};
	const timers: Timer[] = [];
	const states: SyncState<SyncDocumentErrorCode>[] = [];
	const replaceLocalItems = vi.fn(async (items: Item[]) => {
		state.local = items;
	});

	const engine = new SyncEngine<SyncDocumentErrorCode>({
		app: 'todo',
		pairingStore: {
			load: () => (state.pairing ? { ...state.pairing } : null),
			save: (pairing) => {
				state.pairing = { ...pairing };
			},
			clear: () => {
				state.pairing = null;
			},
		},
		adapter: createTodoSyncAdapter({
			localItems: () => state.local,
			replaceLocalItems,
			cleanupDays: () => options.cleanupDays ?? 30,
			changeCount: () => state.changeCount,
		}),
		onState: (next) => states.push(next),
		deviceName: () => 'iPhone Safari',
		connect: server.connect,
		now: () => NOW,
		timers: {
			set: (callback, ms) => {
				const timer = { callback, ms, cleared: false };
				timers.push(timer);
				return timer;
			},
			clear: (handle) => {
				(handle as Timer).cleared = true;
			},
		},
	});

	/** Fires the one pending timer, and lets what it starts run. */
	async function fire(): Promise<void> {
		const timer = timers.find((entry) => !entry.cleared);
		expect(timer).toBeDefined();
		if (!timer) return;
		timer.cleared = true;
		timer.callback();
		await settle();
	}

	function edit(items: Item[]): void {
		state.local = items;
		state.changeCount++;
		engine.localChanged();
	}

	return {
		state,
		engine,
		replaceLocalItems,
		last: () => states[states.length - 1],
		fire,
		edit,
	};
}

const itemsOn = (server: FakeServer): Item[] => decodeSyncDocument(server.body);
const ids = (items: Item[]): string[] => items.map((item) => item.id).sort();

describe('todo sync through the engine', () => {
	it('newer server items replace local ones without a write', async () => {
		const server = new FakeServer();
		const newer = makeTask({ name: 'Buy oat milk', updated: '2026-11-06T10:00:00.000Z' });
		server.store(encodeSyncDocument([newer], NOW));
		const a = device(server, { local: [makeTask({ updated: '2026-11-05T10:00:00.000Z' })] });

		a.engine.start(true);
		await settle();

		expect(a.replaceLocalItems).toHaveBeenCalledWith([newer]);
		expect(server.puts).toEqual([]);
	});

	it('a newer document is neither merged nor written', async () => {
		const server = new FakeServer();
		server.store(JSON.stringify({ version: 4, exportedAt: '', items: [], syncSchema: 99 }));
		const a = device(server, { local: [makeTask()] });

		a.engine.start(true);
		await settle();

		expect(a.last()).toMatchObject({ status: 'error', error: { code: 'newerSchema' } });
		expect(a.replaceLocalItems).not.toHaveBeenCalled();
		expect(server.puts).toEqual([]);
	});

	it('a damaged document is not overwritten', async () => {
		const server = new FakeServer();
		server.store(JSON.stringify({ version: 3, tasks: [] }));
		const a = device(server, { local: [makeTask()] });

		a.engine.start(true);
		await settle();
		await a.engine.syncNow();

		expect(a.last()).toMatchObject({ status: 'error', error: { code: 'badDocument' } });
		expect(server.puts).toEqual([]);
	});

	it('two devices with a tie on updated settle', async () => {
		const tied = '2026-11-07T11:00:00.000Z';
		const server = new FakeServer();
		const a = device(server, { local: [makeTask({ name: 'A', updated: tied })] });
		const b = device(server, { local: [makeTask({ name: 'B', updated: tied })] });

		a.engine.start(true);
		await settle();
		b.engine.start(true);
		await settle();
		await a.engine.syncNow();
		await b.engine.syncNow();
		await settle();

		expect(server.puts).toHaveLength(1);
		expect((a.state.local[0] as Task).name).toBe('A');
		expect((b.state.local[0] as Task).name).toBe('A');
	});

	it('two devices with different cleanup windows settle with live pushes', async () => {
		const closed = makeTask({
			id: 'closed',
			status: Status.Done,
			updated: '2026-09-23T12:00:00.000Z',
		});
		const server = new FakeServer();
		const a = device(server, { local: [makeDream()] });
		const b = device(server, { local: [makeDream(), closed], cleanupDays: 90 });

		b.engine.start(true);
		await settle();
		a.engine.start(true);
		await settle();
		a.edit([...a.state.local, makeTask({ id: 'new', updated: '2026-11-07T11:00:00.000Z' })]);
		await a.fire();
		await settle();
		await settle();

		const writes = server.puts.length;
		await a.engine.syncNow();
		await b.engine.syncNow();
		await settle();

		expect(server.puts).toHaveLength(writes);
		expect(ids(itemsOn(server))).toEqual(['closed', 'dream-1', 'new']);
		expect(ids(a.state.local)).toEqual(['dream-1', 'new']);
		expect(ids(b.state.local)).toEqual(['closed', 'dream-1', 'new']);
	});
});
