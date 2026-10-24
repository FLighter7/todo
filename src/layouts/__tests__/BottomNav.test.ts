// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import type { OptionalPage } from '@/types';
import BottomNav from '../BottomNav.vue';

async function mountAt(path: string, hidden: OptionalPage[] = []) {
	window.localStorage.clear();
	setActivePinia(createPinia());
	const settings = useSettingsStore();
	for (const page of hidden) {
		settings.setPageVisible(page, false);
	}
	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/groups', name: 'groups', component: { template: '<div />' } },
			{ path: '/tasks', name: 'tasks', component: { template: '<div />' } },
			{ path: '/matrix', name: 'matrix', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(BottomNav, { global: { plugins: [vuetify, i18n, testRouter] } });
}

function labelsOf(wrapper: Awaited<ReturnType<typeof mountAt>>): Array<string | undefined> {
	return wrapper
		.findAllComponents({ name: 'VBtn' })
		.map((btn) => btn.text() || btn.attributes('aria-label'));
}

describe('BottomNav', () => {
	it('renders all five pages plus the add button, Groups right after Goals', async () => {
		const wrapper = await mountAt('/dreams');

		expect(labelsOf(wrapper)).toEqual(['Dreams', 'Goals', 'Groups', 'Add task', 'Tasks', 'Matrix']);
		expect(wrapper.findComponent({ name: 'QuickAddFab' }).exists()).toBe(true);
	});

	it('leaves out a hidden page and keeps the add button right before Tasks', async () => {
		const withoutDreams = await mountAt('/tasks', ['dreams']);
		expect(labelsOf(withoutDreams)).toEqual(['Goals', 'Groups', 'Add task', 'Tasks', 'Matrix']);

		const goalsOnly = await mountAt('/tasks', ['dreams', 'groups']);
		expect(labelsOf(goalsOnly)).toEqual(['Goals', 'Add task', 'Tasks', 'Matrix']);
	});

	it('puts Tasks before the add button once every optional page is hidden', async () => {
		const wrapper = await mountAt('/tasks', ['dreams', 'goals', 'groups']);

		expect(labelsOf(wrapper)).toEqual(['Tasks', 'Add task', 'Matrix']);
	});

	it('brings a page back when it is shown again', async () => {
		const wrapper = await mountAt('/tasks', ['groups']);

		useSettingsStore().setPageVisible('groups', true);
		await wrapper.vm.$nextTick();

		expect(labelsOf(wrapper)).toEqual(['Dreams', 'Goals', 'Groups', 'Add task', 'Tasks', 'Matrix']);
	});

	it('highlights the Groups button on the groups page', async () => {
		const wrapper = await mountAt('/groups');

		const buttons = wrapper.findAllComponents({ name: 'VBtn' });

		expect(buttons.find((btn) => btn.text() === 'Groups')?.props('color')).toBe('primary');
		expect(buttons.find((btn) => btn.text() === 'Goals')?.props('color')).toBeUndefined();
	});

	it('highlights the current route among the pages', async () => {
		const wrapper = await mountAt('/goals');

		const buttons = wrapper.findAllComponents({ name: 'VBtn' });
		const goalsButton = buttons.find((btn) => btn.text() === 'Goals');
		const dreamsButton = buttons.find((btn) => btn.text() === 'Dreams');

		expect(goalsButton?.props('color')).toBe('primary');
		expect(dreamsButton?.props('color')).toBeUndefined();
	});
});
