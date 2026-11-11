// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useAnnouncerStore } from '@/stores/announcer';
import { clickButtonByText } from '@/vitestHelpers';
import QrCode from '../../QrCode.vue';
import SyncScanner from '../../SyncScanner.vue';
import PairingRelay from '../PairingRelay.vue';

const fake = await vi.hoisted(async () => {
	const { reactive } = await import('vue');
	return reactive({
		serverId: 'S1' as string | null,
		pair: vi.fn(),
	});
});

vi.mock('@/stores/serverSync', () => ({ useServerSyncStore: () => fake }));

/** A pairing code as a server's page shows it. */
function pairingCode(id = 'S1', name = 'Desk'): string {
	const json = JSON.stringify({
		v: 1,
		id,
		n: name,
		p: 'a'.repeat(24),
		f: 'A'.repeat(43),
		o: 47801,
		h: ['x.local', '192.168.1.10'],
		s: 'secret',
	});

	return `wsrv1.${btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
}

function mountRelay() {
	return mount(PairingRelay, {
		props: { modelValue: true },
		global: { plugins: [vuetify, i18n], stubs: { SyncScanner: true } },
	});
}

async function read(
	wrapper: ReturnType<typeof mountRelay>,
	text: string,
	source: 'camera' | 'paste' = 'camera',
): Promise<void> {
	wrapper.findComponent(SyncScanner).vm.$emit('code', text, source);
	await flushPromises();
}

function buttonTexts(wrapper: ReturnType<typeof mountRelay>): string[] {
	return wrapper.findAllComponents({ name: 'VBtn' }).map((button) => button.text());
}

function setNavigator(key: 'share' | 'canShare' | 'clipboard', value: unknown): void {
	Object.defineProperty(navigator, key, { value, configurable: true, writable: true });
}

beforeEach(() => {
	setActivePinia(createPinia());
	fake.serverId = 'S1';
	vi.clearAllMocks();
	setNavigator('share', undefined);
	setNavigator('canShare', undefined);
	setNavigator('clipboard', { writeText: vi.fn(async () => undefined) });
});

afterEach(() => {
	i18n.global.locale.value = 'en';
});

describe('PairingRelay', () => {
	it('starts with the scanner and says what it is for', () => {
		const wrapper = mountRelay();

		expect(wrapper.text()).toContain('Pair another device');
		expect(wrapper.text()).toContain('its own pairing stays as it is');
		expect(wrapper.findComponent(SyncScanner).exists()).toBe(true);
		expect(wrapper.findComponent(QrCode).exists()).toBe(false);
	});

	it('shows a code it read as a QR code with Copy, and never pairs with it', async () => {
		const wrapper = mountRelay();
		const code = pairingCode();

		await read(wrapper, `  ${code}\n`);

		const qr = wrapper.findComponent(QrCode);
		expect(qr.props('value')).toBe(code);
		expect(qr.props('label')).toBe('Pairing code for Desk');
		expect(wrapper.findComponent(SyncScanner).exists()).toBe(false);
		expect(wrapper.text()).toContain('within 10 minutes');
		expect(buttonTexts(wrapper)).toContain('Copy the code');
		expect(useAnnouncerStore().message).toBe(
			'The code for Desk is ready. Show it to the other device.',
		);
		expect(fake.pair).not.toHaveBeenCalled();
		expect(window.localStorage.getItem('todo.server')).toBeNull();
	});

	it('offers Share only where the browser can share text', async () => {
		const wrapper = mountRelay();
		await read(wrapper, pairingCode());
		expect(buttonTexts(wrapper)).not.toContain('Share the code');

		const share = vi.fn(async () => undefined);
		setNavigator('share', share);
		setNavigator('canShare', () => true);
		const sharing = mountRelay();
		await read(sharing, pairingCode());
		await clickButtonByText(sharing, 'Share the code');

		expect(share).toHaveBeenCalledWith({ text: pairingCode() });

		setNavigator('canShare', () => false);
		const refusing = mountRelay();
		await read(refusing, pairingCode());
		expect(buttonTexts(refusing)).not.toContain('Share the code');
	});

	it('says nothing when the share sheet is closed, and says so when sharing fails', async () => {
		const share = vi.fn().mockRejectedValueOnce(new DOMException('closed', 'AbortError'));
		setNavigator('share', share);
		const wrapper = mountRelay();
		await read(wrapper, pairingCode());

		await clickButtonByText(wrapper, 'Share the code');
		await flushPromises();
		expect(wrapper.text()).not.toContain('Could not share');

		share.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
		await clickButtonByText(wrapper, 'Share the code');
		await flushPromises();
		expect(wrapper.text()).toContain('Could not share the code.');
	});

	it('copies the code and says so', async () => {
		const wrapper = mountRelay();
		await read(wrapper, pairingCode());

		await clickButtonByText(wrapper, 'Copy the code');
		await flushPromises();

		expect(navigator.clipboard.writeText).toHaveBeenCalledWith(pairingCode());
		expect(wrapper.text()).toContain('Code copied. Paste it on the other device.');
		expect(useAnnouncerStore().message).toBe('Code copied. Paste it on the other device.');
	});

	it('says when the clipboard refuses', async () => {
		setNavigator('clipboard', { writeText: vi.fn().mockRejectedValue(new Error('denied')) });
		const wrapper = mountRelay();
		await read(wrapper, pairingCode());

		await clickButtonByText(wrapper, 'Copy the code');
		await flushPromises();

		expect(wrapper.text()).toContain('Could not copy the code.');
	});

	it('shows why a code cannot be passed on, and says it once for a code the camera keeps seeing', async () => {
		const wrapper = mountRelay();
		const announce = vi.spyOn(useAnnouncerStore(), 'announce');

		await read(wrapper, 'https://example.com');
		await read(wrapper, 'https://example.com');

		expect(wrapper.findComponent({ name: 'VAlert' }).text()).toBe(
			'Cannot pass this code on: this is not a workspace-server pairing code',
		);
		expect(announce).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(QrCode).exists()).toBe(false);

		await read(wrapper, 'https://example.com', 'paste');
		expect(announce).toHaveBeenCalledTimes(2);
	});

	it('passes on a code for another server, with a word about it', async () => {
		const wrapper = mountRelay();

		await read(wrapper, pairingCode('S2', 'Laptop'));

		expect(wrapper.text()).toContain(
			'This code is for the server Laptop, not the one this device syncs with.',
		);
		expect(wrapper.findComponent(QrCode).exists()).toBe(true);
	});

	it('says nothing about the server for a code of its own', async () => {
		const wrapper = mountRelay();

		await read(wrapper, pairingCode('S1'));

		expect(wrapper.findComponent({ name: 'VAlert' }).exists()).toBe(false);
	});

	it('goes back to the scanner for another code', async () => {
		const wrapper = mountRelay();
		await read(wrapper, pairingCode());

		await clickButtonByText(wrapper, 'Scan another code');

		expect(wrapper.findComponent(SyncScanner).exists()).toBe(true);
		expect(wrapper.findComponent(QrCode).exists()).toBe(false);
	});

	it('forgets the code when it closes', async () => {
		const wrapper = mountRelay();
		await read(wrapper, pairingCode());

		await wrapper.setProps({ modelValue: false });
		await wrapper.setProps({ modelValue: true });
		await flushPromises();

		expect(wrapper.findComponent(QrCode).exists()).toBe(false);
		expect(wrapper.findComponent(SyncScanner).exists()).toBe(true);
	});

	it('has a Close button', async () => {
		const wrapper = mountRelay();

		await wrapper.get('button[aria-label="Close"]').trigger('click');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('speaks the user’s language', async () => {
		i18n.global.locale.value = 'ru';
		const wrapper = mountRelay();

		await read(wrapper, pairingCode());

		expect(wrapper.text()).toContain('Подключить другое устройство');
		expect(buttonTexts(wrapper)).toContain('Скопировать код');
	});
});
