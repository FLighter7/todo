// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { DocumentError, WorkspaceError, type SyncStatus } from '@flighter7/wss-client';
import type { ServerSyncError } from '@/stores/serverSync';
import { useAnnouncerStore } from '@/stores/announcer';
import { clickButtonByText } from '@/vitestHelpers';
import SyncScanner from '../../SyncScanner.vue';
import PairingRelay from '../PairingRelay.vue';
import ServerSyncPanel from '../ServerSyncPanel.vue';

const fake = await vi.hoisted(async () => {
	const { reactive } = await import('vue');
	return reactive({
		status: 'unpaired' as SyncStatus,
		serverId: null as string | null,
		serverName: null as string | null,
		via: null as string | null,
		lastSyncAt: null as string | null,
		error: null as ServerSyncError | null,
		start: vi.fn(),
		pair: vi.fn(),
		syncNow: vi.fn(),
		disconnect: vi.fn(),
	});
});

vi.mock('@/stores/serverSync', () => ({ useServerSyncStore: () => fake }));

function mountPanel() {
	return mount(ServerSyncPanel, {
		global: { plugins: [vuetify, i18n], stubs: { SyncScanner: true, PairingRelay: true } },
	});
}

function paired(status: SyncStatus, error: ServerSyncError | null = null): void {
	fake.status = status;
	fake.serverName = 'Desk';
	fake.lastSyncAt = '2026-11-07T08:12:00.000Z';
	fake.error = error;
}

function buttonByText(wrapper: ReturnType<typeof mountPanel>, text: string) {
	return wrapper.findAllComponents({ name: 'VBtn' }).find((button) => button.text() === text);
}

beforeEach(() => {
	setActivePinia(createPinia());
	fake.status = 'unpaired';
	fake.serverName = null;
	fake.via = null;
	fake.lastSyncAt = null;
	fake.error = null;
	vi.clearAllMocks();
});

afterEach(() => {
	i18n.global.locale.value = 'en';
});

describe('ServerSyncPanel', () => {
	it('shows the explanation and the scanner when unpaired', () => {
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain('Sync this device with your workspace-server');
		expect(wrapper.findComponent(SyncScanner).exists()).toBe(true);
	});

	it('pairs with the scanned or pasted text', async () => {
		fake.pair.mockImplementation(async () => {
			paired('connected');
		});
		const wrapper = mountPanel();

		wrapper.findComponent(SyncScanner).vm.$emit('code', 'wsrv1.abc', 'paste');
		await flushPromises();

		expect(fake.pair).toHaveBeenCalledWith('wsrv1.abc');
		expect(useAnnouncerStore().message).toBe('Paired with Desk.');
	});

	it('shows progress while pairing', async () => {
		let finish: () => void = () => {};
		fake.pair.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
		const wrapper = mountPanel();

		wrapper.findComponent(SyncScanner).vm.$emit('code', 'wsrv1.abc', 'paste');
		await flushPromises();

		expect(wrapper.text()).toContain('Connecting to the server…');
		expect(wrapper.findComponent({ name: 'VProgressLinear' }).exists()).toBe(true);
		finish();
		await flushPromises();
	});

	it('shows why a pairing failed and keeps the scanner', async () => {
		fake.pair.mockRejectedValue(new WorkspaceError('used', 'badSecret'));
		const wrapper = mountPanel();

		wrapper.findComponent(SyncScanner).vm.$emit('code', 'wsrv1.abc', 'paste');
		await flushPromises();

		const alert = wrapper.findComponent({ name: 'VAlert' });
		expect(alert.text()).toBe(
			"Could not pair: the code has expired or was already used. Make a new one on the server's page",
		);
		expect(wrapper.findComponent(SyncScanner).isVisible()).toBe(true);
		expect(useAnnouncerStore().message).toContain('Could not pair');
	});

	it('does not retry a refused code the camera keeps seeing, but does a pasted one', async () => {
		fake.pair.mockRejectedValue(new WorkspaceError('used', 'badSecret'));
		const wrapper = mountPanel();
		const scanner = wrapper.findComponent(SyncScanner);

		scanner.vm.$emit('code', 'wsrv1.abc', 'camera');
		await flushPromises();
		scanner.vm.$emit('code', 'wsrv1.abc', 'camera');
		await flushPromises();
		expect(fake.pair).toHaveBeenCalledTimes(1);

		scanner.vm.$emit('code', 'wsrv1.abc', 'paste');
		await flushPromises();
		scanner.vm.$emit('code', 'wsrv1.new', 'camera');
		await flushPromises();
		expect(fake.pair).toHaveBeenCalledTimes(3);
	});

	it('the camera tries a blocked code again once a minute', async () => {
		vi.useFakeTimers({ toFake: ['Date'] });
		try {
			vi.setSystemTime(new Date('2026-11-10T12:00:00.000Z'));
			fake.pair.mockRejectedValue(new WorkspaceError('wait', 'blocked'));
			const wrapper = mountPanel();
			const scanner = wrapper.findComponent(SyncScanner);

			scanner.vm.$emit('code', 'wsrv1.abc', 'camera');
			await flushPromises();
			expect(wrapper.findComponent({ name: 'VAlert' }).text()).toContain(
				'too many failed attempts from this device',
			);

			vi.setSystemTime(new Date('2026-11-10T12:00:59.000Z'));
			scanner.vm.$emit('code', 'wsrv1.abc', 'camera');
			await flushPromises();
			expect(fake.pair).toHaveBeenCalledTimes(1);

			vi.setSystemTime(new Date('2026-11-10T12:01:00.000Z'));
			fake.pair.mockImplementation(async () => {
				paired('connected');
			});
			scanner.vm.$emit('code', 'wsrv1.abc', 'camera');
			await flushPromises();
			expect(fake.pair).toHaveBeenCalledTimes(2);
			expect(useAnnouncerStore().message).toBe('Paired with Desk.');
		} finally {
			vi.useRealTimers();
		}
	});

	it('shows the server, the state, the last sync and both buttons when connected', () => {
		paired('connected');
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain('Server: Desk');
		expect(wrapper.text()).toContain('Connected');
		expect(wrapper.text()).toMatch(/Last synced .*2026/);
		expect(buttonByText(wrapper, 'Sync now')?.props('disabled')).toBe(false);
		expect(buttonByText(wrapper, 'Disconnect from server')).toBeDefined();
		expect(wrapper.findComponent(SyncScanner).exists()).toBe(false);
		expect(wrapper.text()).not.toContain('Through');
	});

	it('names the server it syncs through while the paired one is out of reach', () => {
		paired('connected');
		fake.via = 'Laptop';
		i18n.global.locale.value = 'ru';
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain('Сервер: Desk');
		expect(wrapper.text()).toContain('Через Laptop, пока этот сервер недоступен');
	});

	it('Pair another device opens the relay, whatever the state', async () => {
		paired('unreachable');
		const wrapper = mountPanel();
		expect(wrapper.findComponent(PairingRelay).props('modelValue')).toBe(false);

		await clickButtonByText(wrapper, 'Pair another device');

		expect(wrapper.findComponent(PairingRelay).props('modelValue')).toBe(true);
		expect(fake.pair).not.toHaveBeenCalled();
	});

	it('offers no relay before this device is paired', () => {
		const wrapper = mountPanel();

		expect(wrapper.findComponent(PairingRelay).exists()).toBe(false);
		expect(buttonByText(wrapper, 'Pair another device')).toBeUndefined();
	});

	it('says when it has not synced yet', () => {
		paired('unreachable');
		fake.lastSyncAt = null;
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain('Server not reachable');
		expect(wrapper.text()).toContain('Not synced yet');
	});

	it('disables Sync now while syncing', () => {
		paired('syncing');
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain('Syncing…');
		expect(buttonByText(wrapper, 'Sync now')?.props('disabled')).toBe(true);
	});

	it('Sync now reaches the store', async () => {
		paired('connected');
		const wrapper = mountPanel();

		await clickButtonByText(wrapper, 'Sync now');

		expect(fake.syncNow).toHaveBeenCalledTimes(1);
	});

	it('shows the reason and Pair again for badToken', async () => {
		paired('error', new WorkspaceError('gone', 'badToken'));
		fake.disconnect.mockImplementation(async () => {
			fake.status = 'unpaired';
		});
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain(
			'Sync stopped: the server no longer knows this device. Pair it again',
		);
		expect(buttonByText(wrapper, 'Sync now')).toBeUndefined();

		await clickButtonByText(wrapper, 'Pair again');
		await flushPromises();

		expect(fake.disconnect).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(SyncScanner).exists()).toBe(true);
	});

	it('a blocked device is told it resumes on its own, and keeps Sync now', () => {
		paired('paused', new WorkspaceError('wait', 'blocked'));
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain(
			'Sync paused: the server refuses this device for a few minutes after too many failed attempts. It will try again on its own.',
		);
		expect(buttonByText(wrapper, 'Pair again')).toBeUndefined();
		expect(buttonByText(wrapper, 'Sync now')?.props('disabled')).toBe(false);
	});

	it('a server-side failure is shown as paused with its reason', () => {
		paired('paused', new WorkspaceError('disk', 'internal'));
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain(
			'Sync paused: the server reported an error. It will try again on its own.',
		);
	});

	it('a pause is announced once, not on every retry', async () => {
		paired('connected');
		const wrapper = mountPanel();
		const announcer = useAnnouncerStore();
		const announce = vi.spyOn(announcer, 'announce');

		for (let i = 0; i < 3; i++) {
			fake.status = 'connecting';
			await flushPromises();
			fake.status = 'paused';
			fake.error = new WorkspaceError('wait', 'blocked');
			await flushPromises();
		}
		expect(announce).toHaveBeenCalledTimes(1);
		expect(announce).toHaveBeenLastCalledWith(expect.stringContaining('Sync paused'));

		await clickButtonByText(wrapper, 'Sync now');
		fake.status = 'connecting';
		await flushPromises();
		fake.status = 'paused';
		await flushPromises();
		expect(announce).toHaveBeenCalledTimes(2);
	});

	it('an unreachable server suggests pairing again after a reset', () => {
		paired('unreachable', new WorkspaceError('timeout', 'connectTimeout'));
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain(
			"If the server's data was deleted or its port changed, disconnect and pair again with a new code.",
		);
		expect(buttonByText(wrapper, 'Disconnect from server')).toBeDefined();
	});

	it('a connected server shows no reset hint', () => {
		paired('connected');
		const wrapper = mountPanel();

		expect(wrapper.text()).not.toContain('pair again with a new code');
	});

	it('announces a move into an error', async () => {
		paired('connected');
		mountPanel();

		fake.status = 'error';
		fake.error = new DocumentError('newer', 'newerSchema');
		await flushPromises();

		expect(useAnnouncerStore().message).toBe(
			'Sync stopped: the server holds data from a newer version of the app. Update this one',
		);
	});

	it('Disconnect calls disconnect and announces', async () => {
		paired('connected');
		fake.disconnect.mockImplementation(async () => {
			fake.status = 'unpaired';
		});
		const wrapper = mountPanel();

		await clickButtonByText(wrapper, 'Disconnect from server');
		await flushPromises();

		expect(fake.disconnect).toHaveBeenCalledTimes(1);
		expect(useAnnouncerStore().message).toBe('Disconnected from the server.');
	});

	it('speaks the user’s language', () => {
		i18n.global.locale.value = 'ru';
		paired('unreachable');
		const wrapper = mountPanel();

		expect(wrapper.text()).toContain('Сервер: Desk');
		expect(wrapper.text()).toContain('Сервер недоступен');
	});
});
