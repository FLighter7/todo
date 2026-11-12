// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import {
	WorkspaceError,
	type SyncEngineOptions,
	type SyncState,
} from '@flighter7/workspace-client';
import { ItemType, type Item } from '@/types';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import { decodeSyncDocument } from '@/services/server/syncDocument';
import type { SyncDocumentErrorCode } from '@/services/server/syncDocument';
import { useItemsStore } from '../items';
import { useServerSyncStore } from '../serverSync';

/** The engine stands in; the package's page wiring and code parsing stay real. */
const { MockEngine } = vi.hoisted(() => {
	class MockEngine {
		static instances: MockEngine[] = [];
		readonly start = vi.fn();
		readonly setVisible = vi.fn();
		readonly online = vi.fn();
		readonly localChanged = vi.fn();
		readonly pair = vi.fn();
		readonly syncNow = vi.fn();
		readonly disconnect = vi.fn();

		constructor(readonly options: SyncEngineOptions<SyncDocumentErrorCode>) {
			MockEngine.instances.push(this);
		}
	}

	return { MockEngine };
});

vi.mock('@flighter7/workspace-client', async (importOriginal) => ({
	...(await importOriginal<typeof import('@flighter7/workspace-client')>()),
	SyncEngine: MockEngine,
}));

function engine(): InstanceType<typeof MockEngine> {
	expect(MockEngine.instances).toHaveLength(1);
	return MockEngine.instances[0];
}

function options(): SyncEngineOptions<SyncDocumentErrorCode> {
	return engine().options;
}

function setVisibility(state: DocumentVisibilityState): void {
	Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
	document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
	setActivePinia(createPinia());
	MockEngine.instances.length = 0;
	window.localStorage.clear();
});

afterEach(() => {
	Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('useServerSyncStore', () => {
	it('start is idempotent', () => {
		const store = useServerSyncStore();

		store.start();
		store.start();

		expect(MockEngine.instances).toHaveLength(1);
		expect(engine().start).toHaveBeenCalledTimes(1);
		expect(engine().start).toHaveBeenCalledWith(true);
	});

	it('syncs as the todo app, with the pairing kept where it always was', () => {
		const store = useServerSyncStore();
		store.start();

		expect(options().app).toBe('todo');
		options().pairingStore.save({
			serverId: 'S1',
			name: 'Desk',
			device: 'dev1',
			token: 'tok1',
			password: 'a'.repeat(24),
			fingerprint: 'AA:BB',
			port: 47800,
			hosts: ['a.local'],
			lastEtag: null,
			lastSyncAt: null,
		});
		expect(window.localStorage.getItem('todo.server')).not.toBeNull();
	});

	it('a change in changeCount calls localChanged', async () => {
		const items = useItemsStore();
		await items.load(async () => new ItemMemoryRepository<Item>([]));
		const store = useServerSyncStore();
		store.start();

		await items.add(ItemType.Dream, { name: 'See the sea' });
		await nextTick();

		expect(engine().localChanged).toHaveBeenCalledTimes(1);
	});

	it('hands the engine an adapter over the items', async () => {
		const items = useItemsStore();
		await items.load(async () => new ItemMemoryRepository<Item>([]));
		const store = useServerSyncStore();
		store.start();
		await items.add(ItemType.Dream, { name: 'See the sea' });
		const { adapter } = options();

		expect(adapter.changeCount()).toBe(1);
		const plan = adapter.plan({ etag: null, body: new Uint8Array(0) }, new Date());
		expect(plan.apply).toBeUndefined();
		expect(decodeSyncDocument(plan.write ?? new Uint8Array(0)).map((item) => item.name)).toEqual([
			'See the sea',
		]);
	});

	it('visibilitychange calls setVisible', () => {
		const store = useServerSyncStore();
		store.start();

		setVisibility('hidden');
		setVisibility('visible');

		expect(engine().setVisible.mock.calls).toEqual([[false], [true]]);
	});

	it('online calls online', () => {
		const store = useServerSyncStore();
		store.start();

		window.dispatchEvent(new Event('online'));

		expect(engine().online).toHaveBeenCalledTimes(1);
	});

	it('onState updates the refs', () => {
		const store = useServerSyncStore();
		store.start();
		const error = new WorkspaceError('x', 'blocked');
		const state: SyncState<SyncDocumentErrorCode> = {
			status: 'error',
			serverName: 'Desk',
			via: 'Laptop',
			lastSyncAt: '2026-11-07T12:00:00Z',
			error,
		};

		options().onState(state);

		expect(store.status).toBe('error');
		expect(store.serverName).toBe('Desk');
		expect(store.via).toBe('Laptop');
		expect(store.lastSyncAt).toBe('2026-11-07T12:00:00Z');
		expect(store.error).toBe(error);
	});

	it('knows the paired server once the engine reports a state, and forgets it with the pairing', () => {
		const store = useServerSyncStore();
		store.start();
		const state: SyncState<SyncDocumentErrorCode> = {
			status: 'connecting',
			serverName: 'Desk',
			via: null,
			lastSyncAt: null,
			error: null,
		};
		expect(store.serverId).toBeNull();

		options().pairingStore.save({
			serverId: 'S1',
			name: 'Desk',
			device: 'dev1',
			token: 'tok1',
			password: 'a'.repeat(24),
			fingerprint: 'AA:BB',
			port: 47800,
			hosts: ['a.local'],
			lastEtag: null,
			lastSyncAt: null,
		});
		options().onState(state);
		expect(store.serverId).toBe('S1');

		options().pairingStore.clear();
		options().onState({ ...state, status: 'unpaired', serverName: null });
		expect(store.serverId).toBeNull();
	});

	it('pair parses the code first', async () => {
		const store = useServerSyncStore();
		store.start();

		await expect(store.pair('hello')).rejects.toMatchObject({
			name: 'WorkspaceError',
			code: 'notPairingCode',
		});
		expect(engine().pair).not.toHaveBeenCalled();
	});

	it('syncNow and disconnect reach the engine', async () => {
		const store = useServerSyncStore();
		store.start();

		await store.syncNow();
		await store.disconnect();

		expect(engine().syncNow).toHaveBeenCalledTimes(1);
		expect(engine().disconnect).toHaveBeenCalledTimes(1);
	});
});
