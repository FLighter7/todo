// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Status, type Dream, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import QuickAddFab from './QuickAddFab.vue';

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

async function mountAt(path: string, seed: { dreams?: Dream[] } = {}) {
	setActivePinia(createPinia());
	await useDreamsStore().load(async () => new EntityMemoryRepository<Dream>(seed.dreams ?? []));
	await useGoalsStore().load(async () => new EntityMemoryRepository<Goal>());
	await useTasksStore().load(async () => new EntityMemoryRepository<Task>());

	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/list', name: 'list', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(QuickAddFab, { global: { plugins: [vuetify, i18n, testRouter] } });
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('QuickAddFab route awareness', () => {
	it('opens a Dream-create dialog on /dreams', async () => {
		const wrapper = await mountAt('/dreams');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.text()).toContain('Dream');
		expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(false);
	});

	it('opens a Goal-create dialog on /goals', async () => {
		const wrapper = await mountAt('/goals');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.text()).toContain('Goal');
	});

	it('opens TaskForm everywhere else', async () => {
		const wrapper = await mountAt('/list');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.text()).toContain('Add task');
	});
});

describe('QuickAddFab creating a dream', () => {
	it('adds a dream through the dreams store', async () => {
		const wrapper = await mountAt('/dreams');
		const dreams = useDreamsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(dreams.records).toHaveLength(1);
		expect(dreams.records[0].name).toBe('Visit Japan');
	});
});

describe('QuickAddFab creating a goal', () => {
	it('adds a goal through the goals store, offering only active dreams', async () => {
		const wrapper = await mountAt('/goals', { dreams: [makeDream({ name: 'Visit Japan' })] });
		const goals = useGoalsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect((select.props('items') as Array<{ title: string }>).map((item) => item.title)).toEqual([
			'No dream',
			'Visit Japan',
		]);

		await wrapper.get('input').setValue('Learn Japanese');
		await select.vm.$emit('update:modelValue', 'dream-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(goals.records).toHaveLength(1);
		expect(goals.records[0]).toMatchObject({ name: 'Learn Japanese', dreamId: 'dream-1' });
	});
});
