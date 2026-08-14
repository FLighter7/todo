// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import type { Todo } from '@/types/todo';
import { InMemoryRepository } from '@/repositories/InMemoryRepository';
import { useTodosStore } from '@/stores/todos';
import SyncCode from '../SyncCode.vue';
import SyncScanner from '../SyncScanner.vue';
import SyncFlow from './SyncFlow.vue';

// See the note in SyncScanner.test.ts: vi.mock's factory is hoisted above
// plain top-level `const`s, so the mocks it closes over must be declared
// through vi.hoisted() instead.
const { createOffer, acceptOffer, acceptAnswer, exchange, close } = vi.hoisted(() => ({
	createOffer: vi.fn(),
	acceptOffer: vi.fn(),
	acceptAnswer: vi.fn(),
	exchange: vi.fn(),
	close: vi.fn(),
}));

vi.mock('@/services/sync/SyncConnection', () => ({
	SyncConnection: vi.fn(function () {
		return {
			createOffer,
			acceptOffer,
			acceptAnswer,
			exchange,
			close,
		};
	}),
}));

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'local-1',
		title: 'Local task',
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

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('SyncFlow as initiator', () => {
	it('walks offer -> answer -> merged and updates the store', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue([
			makeTodo({ id: 'remote-1', title: 'Remote task', updated: '2026-08-07T10:00:00.000Z' }),
		]);

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([makeTodo()]));

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		expect(createOffer).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(SyncCode).props('code')).toBe('1oc.offer');

		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(acceptAnswer).toHaveBeenCalledWith('1oa.answer');
		expect(store.items.map((t) => t.id).sort()).toEqual(['local-1', 'remote-1']);
		expect(wrapper.text()).toContain('Sync finished');
	});

	it('shows the failure state when creating the offer rejects', async () => {
		createOffer.mockRejectedValue(new Error('No camera or WebRTC unavailable'));

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository());

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');

		expect(wrapper.text()).toContain('Sync failed');
	});
});

describe('SyncFlow as responder', () => {
	it('walks scan offer -> show answer -> merged and updates the store', async () => {
		acceptOffer.mockResolvedValue('1oa.answer');
		exchange.mockResolvedValue([
			makeTodo({ id: 'remote-2', title: 'From initiator', updated: '2026-08-07T10:00:00.000Z' }),
		]);

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([makeTodo({ id: 'local-2' })]));

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device joins');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oc.offer');
		await flushPromises();

		expect(acceptOffer).toHaveBeenCalledWith('1oc.offer');
		expect(store.items.map((t) => t.id).sort()).toEqual(['local-2', 'remote-2']);
		expect(wrapper.text()).toContain('Sync finished');
	});
});

describe('SyncFlow reset', () => {
	it('closes the connection and returns to idle', async () => {
		createOffer.mockResolvedValue('1oc.offer');

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository());

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		await clickButtonByText(wrapper, 'Cancel');

		expect(close).toHaveBeenCalledTimes(1);
		expect(wrapper.text()).toContain('This device starts');
	});
});
