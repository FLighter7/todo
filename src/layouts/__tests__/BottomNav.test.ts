// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import BottomNav from '../BottomNav.vue';

async function mountAt(path: string) {
	setActivePinia(createPinia());
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

describe('BottomNav', () => {
	it('renders all five pages plus the add button, Groups right after Goals', async () => {
		const wrapper = await mountAt('/dreams');

		const labels = wrapper
			.findAllComponents({ name: 'VBtn' })
			.map((btn) => btn.text() || btn.attributes('aria-label'));

		expect(labels).toEqual(['Dreams', 'Goals', 'Groups', 'Add task', 'Tasks', 'Matrix']);
		expect(wrapper.findComponent({ name: 'QuickAddFab' }).exists()).toBe(true);
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
