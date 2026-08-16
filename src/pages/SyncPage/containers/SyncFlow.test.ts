// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Dream, type Goal, type Task } from '@/types';
import type { SyncDataPayload } from '@/services/sync/SyncConnection';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
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

// SYNC_SCHEMA is re-exported here rather than pulled in through
// vi.importActual: SyncFlow.vue imports it as a plain value, and the mocked
// module has to supply every binding it reaches for.
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
	SYNC_SCHEMA: 3,
}));

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'dream-local',
		name: 'Local dream',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-local',
		name: 'Local goal',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-local',
		name: 'Local task',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

async function loadStores(dreams: Dream[], goals: Goal[], tasks: Task[]): Promise<void> {
	await useDreamsStore().load(async () => new EntityMemoryRepository(dreams));
	await useGoalsStore().load(async () => new EntityMemoryRepository(goals));
	await useTasksStore().load(async () => new EntityMemoryRepository(tasks));
}

/**
 * Local has one record per collection; remote sends back a newer copy of
 * that same record (an "updated") plus a brand-new one (an "added"), for all
 * three collections at once — the shape a whole-envelope exchange actually
 * produces, and the only way to prove the added/updated counters are not
 * silently reading from a single collection.
 */
function remotePayload(): SyncDataPayload {
	return {
		schema: 3,
		kind: 'data',
		dreams: [
			makeDream({ updated: '2026-08-07T10:00:00.000Z' }),
			makeDream({ id: 'dream-remote', name: 'Remote dream' }),
		],
		goals: [
			makeGoal({ updated: '2026-08-07T10:00:00.000Z' }),
			makeGoal({ id: 'goal-remote', name: 'Remote goal' }),
		],
		tasks: [
			makeTask({ updated: '2026-08-07T10:00:00.000Z' }),
			makeTask({ id: 'task-remote', name: 'Remote task' }),
		],
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('SyncFlow as initiator', () => {
	it('walks offer -> answer -> merged and updates all three stores', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(remotePayload());

		await loadStores([makeDream()], [makeGoal()], [makeTask()]);
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		expect(createOffer).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(SyncCode).props('code')).toBe('1oc.offer');

		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(acceptAnswer).toHaveBeenCalledWith('1oa.answer');
		expect(exchange).toHaveBeenCalledWith({
			schema: 3,
			kind: 'data',
			dreams: [makeDream()],
			goals: [makeGoal()],
			tasks: [makeTask()],
		});

		expect(dreams.records.map((r) => r.id).sort()).toEqual(['dream-local', 'dream-remote']);
		expect(goals.records.map((r) => r.id).sort()).toEqual(['goal-local', 'goal-remote']);
		expect(tasks.records.map((r) => r.id).sort()).toEqual(['task-local', 'task-remote']);

		// One added and one updated per collection: three of each in total.
		expect(wrapper.text()).toContain('Sync finished. Added: 3. Updated: 3.');
	});

	it('shows the failure state when creating the offer rejects', async () => {
		createOffer.mockRejectedValue(new Error('No camera or WebRTC unavailable'));

		await loadStores([], [], []);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');

		expect(wrapper.text()).toContain('Sync failed');
	});

	it('fails instead of merging when the other device sends a mismatched schema', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		// SyncConnection.exchange() itself rejects on a schema mismatch, before
		// SyncFlow ever sees a payload to merge - that guard is the whole reason
		// the envelope exists, and it must stop the merge from running at all.
		exchange.mockRejectedValue(
			new Error('The other device runs a different version. Update it and retry.'),
		);

		await loadStores([makeDream()], [makeGoal()], [makeTask()]);
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(wrapper.text()).toContain(
			'Sync failed: The other device runs a different version. Update it and retry.',
		);
		expect(dreams.records.map((r) => r.id)).toEqual(['dream-local']);
		expect(goals.records.map((r) => r.id)).toEqual(['goal-local']);
		expect(tasks.records.map((r) => r.id)).toEqual(['task-local']);
	});
});

describe('SyncFlow as responder', () => {
	it('walks scan offer -> show answer -> merged and updates all three stores', async () => {
		acceptOffer.mockResolvedValue('1oa.answer');
		exchange.mockResolvedValue(remotePayload());

		await loadStores([makeDream()], [makeGoal()], [makeTask()]);
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device joins');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oc.offer');
		await flushPromises();

		expect(acceptOffer).toHaveBeenCalledWith('1oc.offer');
		expect(dreams.records.map((r) => r.id).sort()).toEqual(['dream-local', 'dream-remote']);
		expect(goals.records.map((r) => r.id).sort()).toEqual(['goal-local', 'goal-remote']);
		expect(tasks.records.map((r) => r.id).sort()).toEqual(['task-local', 'task-remote']);
		expect(wrapper.text()).toContain('Sync finished');
	});
});

describe('SyncFlow reset', () => {
	it('closes the connection and returns to idle', async () => {
		createOffer.mockResolvedValue('1oc.offer');

		await loadStores([], [], []);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		await clickButtonByText(wrapper, 'Cancel');

		expect(close).toHaveBeenCalledTimes(1);
		expect(wrapper.text()).toContain('This device starts');
	});
});
