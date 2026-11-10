import { computed, readonly, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import {
	SyncEngine,
	createPairingStore,
	parsePairingCode,
	startInPage,
	type SyncStatus,
	type WorkspaceError,
	type WorkspaceErrorCode,
} from '@flighter7/workspace-client';
import type { SyncDocumentErrorCode } from '@/services/server/syncDocument';
import { createTodoSyncAdapter } from '@/services/server/todoSyncAdapter';
import { useItemsStore } from './items';
import { useSettingsStore } from './settings';

/** This app's id on the server: its folder there, and what `hello` and `pair` name. */
export const APP_ID = 'todo';
/** Where this device keeps its pairing. Device-local: never in a backup, never synced. */
export const SERVER_PAIRING_KEY = 'todo.server';

/** Every failure the Sync page may show: the package's codes, and this app's document codes. */
export type ServerSyncError = WorkspaceError<WorkspaceErrorCode | SyncDocumentErrorCode>;

/**
 * Sync through the user's workspace-server: wires one `SyncEngine` from
 * `@flighter7/workspace-client` to the items store, the settings store and
 * the page, and holds what the Sync page shows. `DefaultLayout` starts it
 * once the items have loaded; everything after that runs on its own.
 */
export const useServerSyncStore = defineStore('serverSync', () => {
	const status = ref<SyncStatus>('unpaired');
	const serverName = ref<string | null>(null);
	const lastSyncAt = ref<string | null>(null);
	const error = shallowRef<ServerSyncError | null>(null);

	const items = useItemsStore();
	const settings = useSettingsStore();
	let engine: SyncEngine<SyncDocumentErrorCode> | null = null;

	function createEngine(): SyncEngine<SyncDocumentErrorCode> {
		return new SyncEngine<SyncDocumentErrorCode>({
			app: APP_ID,
			pairingStore: createPairingStore({ key: SERVER_PAIRING_KEY }),
			adapter: createTodoSyncAdapter({
				localItems: () => [...items.records],
				replaceLocalItems: (next) => items.replaceAll(next),
				cleanupDays: () => settings.general.cleanupDays,
				changeCount: () => items.changeCount,
			}),
			onState: (state) => {
				status.value = state.status;
				serverName.value = state.serverName;
				lastSyncAt.value = state.lastSyncAt;
				error.value = state.error;
			},
		});
	}

	/** The one engine of this app run, created and started on first use. */
	function ensureEngine(): SyncEngine<SyncDocumentErrorCode> {
		if (engine) return engine;
		const created = createEngine();
		engine = created;

		watch(
			() => items.changeCount,
			() => created.localChanged(),
		);
		startInPage(created);

		return created;
	}

	/** Parses a scanned or pasted code and pairs with it; rethrows a `WorkspaceError` to show. */
	async function pair(text: string): Promise<void> {
		const code = parsePairingCode(text);
		await ensureEngine().pair(code);
	}

	/** Starts sync once per app run; later calls do nothing. */
	function start(): void {
		ensureEngine();
	}

	async function syncNow(): Promise<void> {
		await ensureEngine().syncNow();
	}

	async function disconnect(): Promise<void> {
		await ensureEngine().disconnect();
	}

	return {
		status: readonly(status),
		serverName: readonly(serverName),
		lastSyncAt: readonly(lastSyncAt),
		// Not `readonly()`: that would hand out a proxy of the error object itself.
		error: computed(() => error.value),
		start,
		pair,
		syncNow,
		disconnect,
	};
});
