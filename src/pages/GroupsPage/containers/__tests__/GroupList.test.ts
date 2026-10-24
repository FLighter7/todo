// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText, loadItems, setEntityTab } from '@/vitestHelpers';
import { ItemType, Status, type Group, type Task } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import GroupList from '../GroupList.vue';

function makeGroup(overrides: Partial<Group> = {}): Group {
	return {
		type: ItemType.Group,
		id: 'group-1',
		name: 'Errands',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		type: ItemType.Task,
		id: 'task-1',
		name: 'Buy stamps',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

async function mountWithGroups(groups: Group[], tasks: Task[] = []) {
	await loadItems([...groups, ...tasks]);

	const wrapper = mount(GroupList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, items: useItemsStore() };
}

describe('GroupList empty state', () => {
	it('shows the empty message when there are no groups', async () => {
		const { wrapper } = await mountWithGroups([]);

		expect(wrapper.text()).toContain('No groups yet.');
	});
});

describe('GroupList editing', () => {
	it('opens a group read-only on click and saves a new name', async () => {
		const { wrapper, items } = await mountWithGroups([makeGroup()]);

		await wrapper.get('.v-list-item').trigger('click');
		expect(wrapper.text()).toContain('Errands');

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Errands in town');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(items.groups.all[0].name).toBe('Errands in town');
	});

	it('never shows a note, even with two rows set and a note stored', async () => {
		const { wrapper } = await mountWithGroups([makeGroup({ note: 'Left over from elsewhere' })]);
		useSettingsStore().updatePageSettings('groups', { rows: 2 });
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).not.toContain('Left over from elsewhere');
	});
});

describe('GroupList done / reopen', () => {
	it('marks a group done immediately when confirmDone is off', async () => {
		const { wrapper, items } = await mountWithGroups([makeGroup()]);

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(items.groups.all[0].status).toBe(Status.Done);
	});

	it("asks first when the groups page's own confirmDone is on", async () => {
		const { wrapper, items } = await mountWithGroups([makeGroup()]);
		useSettingsStore().updatePageSettings('groups', { confirmDone: true });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(items.groups.all[0].status).toBe(Status.Opened);
		expect(wrapper.text()).toContain('Mark "Errands" as done?');

		await clickButtonByText(wrapper, 'Confirm');

		expect(items.groups.all[0].status).toBe(Status.Done);
	});

	it('reopens a closed group from the History tab', async () => {
		const { wrapper, items } = await mountWithGroups([makeGroup({ status: Status.Done })]);

		await setEntityTab('history');
		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(items.groups.all[0].status).toBe(Status.Opened);
	});
});

describe('GroupList cancel', () => {
	it('cancels immediately when the group has no active tasks', async () => {
		const { wrapper, items } = await mountWithGroups([makeGroup()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(items.groups.all[0].status).toBe(Status.Cancelled);
		expect(wrapper.text()).not.toContain('Cancel the whole branch');
	});

	it('offers the cascade when the group has active tasks, and "only this" leaves them alone', async () => {
		const { wrapper, items } = await mountWithGroups(
			[makeGroup()],
			[makeTask({ groupId: 'group-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.text()).toContain('Active tasks in this group: 1.');

		await clickButtonByText(wrapper, 'Cancel only this');

		expect(items.groups.all[0].status).toBe(Status.Cancelled);
		expect(items.tasks.all[0].status).toBe(Status.Opened);
	});

	it('cancels the group and its active tasks when the whole branch is chosen', async () => {
		const { wrapper, items } = await mountWithGroups(
			[makeGroup()],
			[
				makeTask({ id: 'in-group', groupId: 'group-1' }),
				makeTask({ id: 'elsewhere', goalId: 'goal-1' }),
			],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');
		await clickButtonByText(wrapper, 'Cancel the whole branch');

		expect(items.groups.all[0].status).toBe(Status.Cancelled);
		expect(items.byId.get('in-group')?.status).toBe(Status.Cancelled);
		expect(items.byId.get('elsewhere')?.status).toBe(Status.Opened);
	});
});

describe('GroupList tabs and sorting', () => {
	it('shows only open groups on Active and only closed ones on History', async () => {
		const { wrapper } = await mountWithGroups([
			makeGroup({ id: 'open', name: 'Open group' }),
			makeGroup({ id: 'done', name: 'Done group', status: Status.Done }),
		]);

		expect(wrapper.text()).toContain('Open group');
		expect(wrapper.text()).not.toContain('Done group');

		await setEntityTab('history');

		expect(wrapper.text()).not.toContain('Open group');
		expect(wrapper.text()).toContain('Done group');
	});

	it("follows the groups page's own sortOrder", async () => {
		const { wrapper } = await mountWithGroups([
			makeGroup({ id: 'a', name: 'Alpha', updated: daysAgo(1) }),
			makeGroup({ id: 'b', name: 'Beta', updated: daysAgo(5) }),
		]);

		const titles = () => wrapper.findAll('.v-list-item-title').map((title) => title.text());
		expect(titles()).toEqual(['Alpha', 'Beta']);

		useSettingsStore().updatePageSettings('groups', { sortOrder: 'za' });
		await wrapper.vm.$nextTick();

		expect(titles()).toEqual(['Beta', 'Alpha']);
	});
});
