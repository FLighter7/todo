// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText, setEntityTab } from '@/vitestHelpers';
import { Status, type Dream, type Goal } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
import DreamList from '../DreamList.vue';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'dream-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

async function mountWithDreams(dreams: Dream[], goals: Goal[] = []) {
	const dreamsStore = useDreamsStore();
	const goalsStore = useGoalsStore();
	const tasksStore = useTasksStore();
	await dreamsStore.load(async () => new EntityMemoryRepository(dreams));
	await goalsStore.load(async () => new EntityMemoryRepository(goals));
	await tasksStore.load(async () => new EntityMemoryRepository([]));

	const wrapper = mount(DreamList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, dreamsStore, goalsStore };
}

describe('DreamList empty state', () => {
	it('shows the empty message when there are no dreams', async () => {
		const { wrapper } = await mountWithDreams([]);

		expect(wrapper.text()).toContain('No dreams yet.');
	});
});

describe('DreamList editing', () => {
	it('opens a dream read-only on click and saves an edit', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);

		await wrapper.get('.v-list-item').trigger('click');
		expect(wrapper.text()).toContain('Visit Japan');

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan and Korea');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(dreamsStore.records[0].name).toBe('Visit Japan and Korea');
	});
});

describe('DreamList done / reopen', () => {
	it('marks a dream done immediately when confirmDone is off', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);
		useSettingsStore().updatePageSettings('dreams', { confirmDone: false });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(dreamsStore.records[0].status).toBe(Status.Done);
	});

	it('asks for confirmation before marking done when confirmDone is on', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);
		useSettingsStore().updatePageSettings('dreams', { confirmDone: true });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(dreamsStore.records[0].status).toBe(Status.Opened);
		expect(wrapper.text()).toContain('Mark "Visit Japan" as done?');

		await clickButtonByText(wrapper, 'Confirm');

		expect(dreamsStore.records[0].status).toBe(Status.Done);
	});

	it('reopens a closed dream from the History tab, gated by confirmReopen', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream({ status: Status.Done })]);
		useSettingsStore().updatePageSettings('dreams', { confirmReopen: false });

		await setEntityTab('history');
		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(dreamsStore.records[0].status).toBe(Status.Opened);
	});

	it('reopens a cancelled dream from the History tab when its checkbox is checked, not marks it done', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([
			makeDream({ status: Status.Cancelled }),
		]);
		useSettingsStore().updatePageSettings('dreams', { confirmReopen: false });

		await setEntityTab('history');
		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(dreamsStore.records[0].status).toBe(Status.Opened);
	});
});

describe('DreamList cancel', () => {
	it('cancels immediately when the dream has no active goals', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(dreamsStore.records[0].status).toBe(Status.Cancelled);
		expect(wrapper.text()).not.toContain('Cancel the whole branch');
	});

	it('shows the cascade choice when the dream has active goals, and "only this" leaves them alone', async () => {
		const { wrapper, dreamsStore, goalsStore } = await mountWithDreams(
			[makeDream()],
			[makeGoal({ dreamId: 'dream-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.text()).toContain('Cancel the whole branch');

		await clickButtonByText(wrapper, 'Cancel only this');

		expect(dreamsStore.records[0].status).toBe(Status.Cancelled);
		expect(goalsStore.records[0].status).toBe(Status.Opened);
	});

	it('cancels the whole branch, including active goals, when chosen', async () => {
		const { wrapper, dreamsStore, goalsStore } = await mountWithDreams(
			[makeDream()],
			[makeGoal({ dreamId: 'dream-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');
		await clickButtonByText(wrapper, 'Cancel the whole branch');

		expect(dreamsStore.records[0].status).toBe(Status.Cancelled);
		expect(goalsStore.records[0].status).toBe(Status.Cancelled);
	});
});

describe('DreamList tabs', () => {
	it('shows only open dreams on Active and only closed ones on History', async () => {
		const { wrapper } = await mountWithDreams([
			makeDream({ id: 'open', name: 'Open dream' }),
			makeDream({ id: 'done', name: 'Done dream', status: Status.Done }),
		]);

		expect(wrapper.text()).toContain('Open dream');
		expect(wrapper.text()).not.toContain('Done dream');

		await setEntityTab('history');

		expect(wrapper.text()).not.toContain('Open dream');
		expect(wrapper.text()).toContain('Done dream');
	});
});
