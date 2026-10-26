// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { ItemType, Status, type AppPage, type Dream, type Goal, type Group } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { loadItems } from '@/vitestHelpers';
import QuickAddFab from '../QuickAddFab.vue';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
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
		type: ItemType.Goal,
		id: 'goal-1',
		name: 'Learn Japanese',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeGroup(overrides: Partial<Group> = {}): Group {
	return {
		type: ItemType.Group,
		id: 'group-1',
		name: 'Errands',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

async function mountAt(
	path: string,
	seed: { dreams?: Dream[]; goals?: Goal[]; groups?: Group[] } = {},
) {
	setActivePinia(createPinia());
	await loadItems([...(seed.dreams ?? []), ...(seed.goals ?? []), ...(seed.groups ?? [])]);

	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/groups', name: 'groups', component: { template: '<div />' } },
			{ path: '/tasks', name: 'tasks', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(QuickAddFab, { global: { plugins: [vuetify, i18n, testRouter] } });
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('QuickAddFab default tab', () => {
	it('defaults to Dream on /dreams', async () => {
		const wrapper = await mountAt('/dreams');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('dream');
	});

	it('defaults to Goal on /goals', async () => {
		const wrapper = await mountAt('/goals');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('goal');
	});

	it('defaults to Group on /groups', async () => {
		const wrapper = await mountAt('/groups');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('group');
	});

	it('defaults to Task everywhere else', async () => {
		const wrapper = await mountAt('/tasks');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('task');
	});
});

describe('QuickAddFab with pages switched off', () => {
	it('passes the hidden pages on to the add dialog', async () => {
		const wrapper = await mountAt('/tasks');
		useSettingsStore().setPageVisible('dreams', false);
		useSettingsStore().setPageVisible('groups', false);

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		const dialog = wrapper.findComponent({ name: 'AddEntityDialog' });

		expect(dialog.props('showDream')).toBe(false);
		expect(dialog.props('showGoal')).toBe(true);
		expect(dialog.props('showGroup')).toBe(false);
		expect(wrapper.findAllComponents({ name: 'VTab' }).map((tab) => tab.text())).toEqual([
			'Goal',
			'Task',
		]);
	});
});

describe('QuickAddFab with Tasks or the matrix switched off', () => {
	async function taskTabShown(hidden: AppPage[]): Promise<boolean> {
		// Saved settings would otherwise carry over from the previous call.
		window.localStorage.clear();
		const wrapper = await mountAt('/dreams');
		for (const page of hidden) {
			useSettingsStore().setPageVisible(page, false);
		}

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		return wrapper.findComponent({ name: 'AddEntityDialog' }).props('showTask');
	}

	it('keeps the task tab while either page still shows tasks', async () => {
		expect(await taskTabShown(['tasks'])).toBe(true);
		expect(await taskTabShown(['matrix'])).toBe(true);
	});

	it('drops the task tab once neither page is shown', async () => {
		expect(await taskTabShown(['tasks', 'matrix'])).toBe(false);
	});

	it('keeps the task tab once every page is off, since Tasks is then the one page left', async () => {
		expect(await taskTabShown(['tasks', 'matrix', 'dreams', 'goals', 'groups'])).toBe(true);
	});
});

describe('QuickAddFab creating a dream', () => {
	it('adds a dream through the items store', async () => {
		const wrapper = await mountAt('/dreams');
		const items = useItemsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(items.dreams.all).toHaveLength(1);
		expect(items.dreams.all[0].name).toBe('Visit Japan');
	});
});

describe('QuickAddFab creating a goal', () => {
	it('adds a goal through the items store, offering only active dreams', async () => {
		const wrapper = await mountAt('/goals', { dreams: [makeDream({ name: 'Visit Japan' })] });
		const items = useItemsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(items.goals.all).toHaveLength(1);
		expect(items.goals.all[0]).toMatchObject({ name: 'Learn Japanese', dreamId: 'dream-1' });
	});
});

describe('QuickAddFab creating a group', () => {
	it('adds a group, carrying a name only, through the items store', async () => {
		const wrapper = await mountAt('/groups');
		const items = useItemsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Errands');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(items.groups.all).toHaveLength(1);
		expect(items.groups.all[0]).toMatchObject({ type: ItemType.Group, name: 'Errands' });
		expect(items.groups.all[0].note).toBeUndefined();
	});
});

describe('QuickAddFab creating a task', () => {
	it('adds a task through the items store, offering only active goals', async () => {
		const wrapper = await mountAt('/tasks', { goals: [makeGoal({ name: 'Learn Japanese' })] });
		const items = useItemsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Do Duolingo');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(items.tasks.all).toHaveLength(1);
		expect(items.tasks.all[0]).toMatchObject({ name: 'Do Duolingo', goalId: 'goal-1' });
	});

	it('puts a task in a goal and a group at once, offering only active groups', async () => {
		const wrapper = await mountAt('/tasks', {
			goals: [makeGoal()],
			groups: [
				makeGroup(),
				makeGroup({ id: 'group-closed', name: 'Old errands', status: Status.Done }),
			],
		});
		const items = useItemsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Buy stamps');
		const [goalSelect, groupSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(groupSelect.props('items')).toEqual([
			{ value: '', title: 'No group' },
			{ value: 'group-1', title: 'Errands' },
		]);
		await goalSelect.vm.$emit('update:modelValue', 'goal-1');
		await groupSelect.vm.$emit('update:modelValue', 'group-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(items.tasks.all[0]).toMatchObject({ goalId: 'goal-1', groupId: 'group-1' });
	});
});
