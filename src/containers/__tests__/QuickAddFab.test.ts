// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Dream, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import QuickAddFab from '../QuickAddFab.vue';

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

async function mountAt(path: string, seed: { dreams?: Dream[]; goals?: Goal[] } = {}) {
	setActivePinia(createPinia());
	await useDreamsStore().load(async () => new EntityMemoryRepository<Dream>(seed.dreams ?? []));
	await useGoalsStore().load(async () => new EntityMemoryRepository<Goal>(seed.goals ?? []));
	await useTasksStore().load(async () => new EntityMemoryRepository<Task>());

	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
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

	it('defaults to Task everywhere else', async () => {
		const wrapper = await mountAt('/tasks');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('task');
	});
});

describe('QuickAddFab creating a dream', () => {
	it('adds a dream through the dreams store', async () => {
		const wrapper = await mountAt('/dreams');
		const dreams = useDreamsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan');
		await clickButtonByText(wrapper, 'Save');

		expect(dreams.records).toHaveLength(1);
		expect(dreams.records[0].name).toBe('Visit Japan');
	});
});

describe('QuickAddFab creating a goal', () => {
	it('adds a goal through the goals store, offering only active dreams', async () => {
		const wrapper = await mountAt('/goals', { dreams: [makeDream({ name: 'Visit Japan' })] });
		const goals = useGoalsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await clickButtonByText(wrapper, 'Save');

		expect(goals.records).toHaveLength(1);
		expect(goals.records[0]).toMatchObject({ name: 'Learn Japanese', dreamId: 'dream-1' });
	});
});

describe('QuickAddFab creating a task', () => {
	it('adds a task through the tasks store, offering only active goals', async () => {
		const wrapper = await mountAt('/tasks', { goals: [makeGoal({ name: 'Learn Japanese' })] });
		const tasks = useTasksStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Do Duolingo');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await clickButtonByText(wrapper, 'Save');

		expect(tasks.records).toHaveLength(1);
		expect(tasks.records[0]).toMatchObject({ name: 'Do Duolingo', goalId: 'goal-1' });
	});
});
