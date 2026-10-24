// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText, loadItems } from '@/vitestHelpers';
import {
	ItemType,
	DEFAULT_SETTINGS,
	Status,
	isTask,
	type AppSettings,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
import type { SyncDataPayload, SyncSettingsPayload } from '@/services/sync/SyncConnection';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import SyncCode from '../../SyncCode.vue';
import SyncScanner from '../../SyncScanner.vue';
import SyncFlow from '../SyncFlow.vue';

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
	SYNC_SCHEMA: 4,
}));

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
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
		type: ItemType.Goal,
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
		type: ItemType.Task,
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
	await loadItems([...dreams, ...goals, ...tasks]);
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Local has one record of each type; remote sends back a newer copy of that
 * same record (an "updated") plus a brand-new one (an "added"), for all three
 * types at once — the only way to prove the added/updated counters are not
 * silently reading from a single type.
 */
function remotePayload(): SyncDataPayload {
	return {
		schema: 4,
		kind: 'data',
		items: [
			makeDream({ updated: '2026-08-07T10:00:00.000Z' }),
			makeDream({ id: 'dream-remote', name: 'Remote dream' }),
			makeGoal({ updated: '2026-08-07T10:00:00.000Z' }),
			makeGoal({ id: 'goal-remote', name: 'Remote goal' }),
			makeTask({ updated: '2026-08-07T10:00:00.000Z' }),
			makeTask({ id: 'task-remote', name: 'Remote task' }),
		],
	};
}

function remoteSettingsPayload(general: Partial<AppSettings['general']> = {}): SyncSettingsPayload {
	return {
		schema: 4,
		kind: 'settings',
		settings: { ...DEFAULT_SETTINGS, general: { ...DEFAULT_SETTINGS.general, ...general } },
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('SyncFlow as initiator', () => {
	it('walks offer -> answer -> merged and updates every type', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(remotePayload());

		await loadStores([makeDream()], [makeGoal()], [makeTask()]);
		const items = useItemsStore();

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
			schema: 4,
			kind: 'data',
			items: [makeDream(), makeGoal(), makeTask()],
		});

		expect(items.dreams.all.map((r) => r.id).sort()).toEqual(['dream-local', 'dream-remote']);
		expect(items.goals.all.map((r) => r.id).sort()).toEqual(['goal-local', 'goal-remote']);
		expect(items.tasks.all.map((r) => r.id).sort()).toEqual(['task-local', 'task-remote']);

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
		const items = useItemsStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(wrapper.text()).toContain(
			'Sync failed: The other device runs a different version. Update it and retry.',
		);
		expect(items.dreams.all.map((r) => r.id)).toEqual(['dream-local']);
		expect(items.goals.all.map((r) => r.id)).toEqual(['goal-local']);
		expect(items.tasks.all.map((r) => r.id)).toEqual(['task-local']);
	});
});

describe('SyncFlow as responder', () => {
	it('walks scan offer -> show answer -> merged and updates every type', async () => {
		acceptOffer.mockResolvedValue('1oa.answer');
		exchange.mockResolvedValue(remotePayload());

		await loadStores([makeDream()], [makeGoal()], [makeTask()]);
		const items = useItemsStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device joins');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oc.offer');
		await flushPromises();

		expect(acceptOffer).toHaveBeenCalledWith('1oc.offer');
		expect(items.dreams.all.map((r) => r.id).sort()).toEqual(['dream-local', 'dream-remote']);
		expect(items.goals.all.map((r) => r.id).sort()).toEqual(['goal-local', 'goal-remote']);
		expect(items.tasks.all.map((r) => r.id).sort()).toEqual(['task-local', 'task-remote']);
		expect(wrapper.text()).toContain('Sync finished');
	});
});

describe('SyncFlow task completions', () => {
	it('merges per-occurrence marks instead of letting the newer whole record take all', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);

		// Two devices out of contact, one marking a different occurrence than
		// the other: mergeItems has to preserve both marks no matter which
		// whole record wins the last-write-wins tie-break. Giving the remote
		// task a strictly newer `updated` makes it win that tie-break outright,
		// so a plain merge() would return exactly the remote object -
		// completions and all - and the local mark would vanish with nothing in
		// the UI saying so. That silent loss is exactly what this test exists
		// to catch: it fails if and only if SyncFlow.vue calls merge() instead
		// of mergeItems().
		const localTask = makeTask({
			completions: [{ occurrence: daysAgo(7), done: true, at: daysAgo(7) }],
		});
		const remoteTask = makeTask({
			updated: '2026-08-07T10:00:00.000Z',
			completions: [{ occurrence: daysAgo(1), done: true, at: daysAgo(1) }],
		});

		exchange.mockResolvedValue({
			schema: 4,
			kind: 'data',
			items: [remoteTask],
		});

		await loadStores([], [], [localTask]);
		const replaceAll = vi.spyOn(useItemsStore(), 'replaceAll');

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(replaceAll).toHaveBeenCalledTimes(1);
		const synced = replaceAll.mock.calls[0][0].filter(isTask);
		expect(synced).toHaveLength(1);

		// mergeCompletions documents that its output order carries no meaning,
		// so the comparison sorts both sides rather than asserting on order.
		const occurrences = (synced[0].completions ?? []).map((completion) => completion.occurrence);
		expect(occurrences.sort()).toEqual(
			[localTask.completions![0].occurrence, remoteTask.completions![0].occurrence].sort(),
		);
	});
});

describe('SyncFlow busy flag', () => {
	it('is false while idle, true once a pairing starts, and false again once it fails', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		exchange.mockRejectedValue(new Error('boom'));

		await loadStores([], [], []);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		expect(wrapper.vm.busy).toBe(false);

		await clickButtonByText(wrapper, 'This device starts');
		expect(wrapper.vm.busy).toBe(true);

		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(wrapper.vm.busy).toBe(false);
	});

	it('is false again once a pairing finishes successfully', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(remotePayload());

		await loadStores([], [], []);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		expect(wrapper.vm.busy).toBe(true);

		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(wrapper.vm.busy).toBe(false);
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

describe('SyncFlow settings mode', () => {
	it('sends the local settings and shows a confirmation with the incoming ones', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ theme: 'dark', locale: 'ru', startPage: 'matrix', cleanupDays: 90 }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(exchange).toHaveBeenCalledWith({
			schema: 4,
			kind: 'settings',
			settings: {
				general: settings.general,
				dreams: settings.dreams,
				goals: settings.goals,
				groups: settings.groups,
				tasks: settings.tasks,
			},
		});
		expect(wrapper.text()).toContain('The other device sent its settings');
		expect(settings.general.theme).not.toBe('dark');
	});

	it('replaces local settings when the incoming ones are accepted', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ theme: 'dark', locale: 'ru', startPage: 'matrix', cleanupDays: 90 }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(settings.general.theme).toBe('dark');
		expect(settings.general.cleanupDays).toBe(90);
		expect(wrapper.text()).toContain('Settings synced');
	});

	it("keeps this device's own text size when the incoming settings are accepted", async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(remoteSettingsPayload({ theme: 'dark', fontScale: 0.875 }));

		await loadStores([], [], []);
		const settings = useSettingsStore();
		settings.setFontScale(1.25);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(settings.general.theme).toBe('dark');
		expect(settings.general.fontScale).toBe(1.25);
	});

	it('takes the incoming set of pages along with the rest when accepted', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ pages: { dreams: false, goals: true, groups: false } }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();
		settings.setFontScale(1.25);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(settings.general.pages).toEqual({ dreams: false, goals: true, groups: false });
		expect(settings.general.fontScale).toBe(1.25);
	});

	it('leaves local settings untouched when the incoming ones are declined', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(
			remoteSettingsPayload({ theme: 'dark', locale: 'ru', startPage: 'matrix', cleanupDays: 90 }),
		);

		await loadStores([], [], []);
		const settings = useSettingsStore();
		const originalTheme = settings.general.theme;

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		await clickButtonByText(wrapper, 'Keep mine');
		await flushPromises();

		expect(settings.general.theme).toBe(originalTheme);
		expect(wrapper.text()).toContain('Settings synced');
	});

	it('closes the connection as soon as the settings exchange resolves, before the user decides', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue(remoteSettingsPayload());

		await loadStores([], [], []);

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'Settings');
		await clickButtonByText(wrapper, 'This device starts');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');
		await flushPromises();

		expect(close).toHaveBeenCalledTimes(1);
	});
});
