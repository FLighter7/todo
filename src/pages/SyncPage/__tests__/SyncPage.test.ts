// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import SyncScanner from '../SyncScanner.vue';
import SyncPage from '../SyncPage.vue';

// See the note in SyncFlow.test.ts: vi.mock's factory is hoisted above plain
// top-level `const`s, so the mocks it closes over must come from vi.hoisted().
const { createOffer, exchange } = vi.hoisted(() => ({
	createOffer: vi.fn(),
	exchange: vi.fn(),
}));

vi.mock('@/services/sync/SyncConnection', () => ({
	SyncConnection: vi.fn(function () {
		return { createOffer, acceptOffer: vi.fn(), acceptAnswer: vi.fn(), exchange, close: vi.fn() };
	}),
	SYNC_SCHEMA: 3,
}));

async function loadEmptyStores(): Promise<void> {
	await useDreamsStore().load(async () => new EntityMemoryRepository([]));
	await useGoalsStore().load(async () => new EntityMemoryRepository([]));
	await useTasksStore().load(async () => new EntityMemoryRepository([]));
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

function mountPage() {
	return mount(SyncPage, {
		global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
	});
}

describe('SyncPage tabs', () => {
	it('shows the QR flow on the default tab and the placeholder on the Server tab', async () => {
		await loadEmptyStores();
		const wrapper = mountPage();

		expect(wrapper.text()).toContain('This device starts');

		const serverTab = wrapper
			.findAllComponents({ name: 'VTab' })
			.find((tab) => tab.text() === 'Server');
		await serverTab!.trigger('click');
		await flushPromises();

		expect(wrapper.text()).not.toContain('This device starts');
		expect(wrapper.text()).toContain('Server connection options will appear here soon.');
	});

	it('disables the Server tab while a pairing is in progress and re-enables it once it finishes', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		exchange.mockResolvedValue({ schema: 3, kind: 'data', dreams: [], goals: [], tasks: [] });

		await loadEmptyStores();
		const wrapper = mountPage();

		const serverTab = () =>
			wrapper.findAllComponents({ name: 'VTab' }).find((tab) => tab.text() === 'Server')!;

		expect(serverTab().props('disabled')).toBe(false);

		await clickButtonByText(wrapper, 'This device starts');
		expect(serverTab().props('disabled')).toBe(true);

		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(serverTab().props('disabled')).toBe(false);
	});
});
