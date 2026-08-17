// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import BottomNav from './BottomNav.vue';

async function mountAt(path: string) {
	setActivePinia(createPinia());
	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/list', name: 'list', component: { template: '<div />' } },
			{ path: '/matrix', name: 'matrix', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(BottomNav, { global: { plugins: [vuetify, i18n, testRouter] } });
}

describe('BottomNav', () => {
	it('renders all five nav targets plus the add button', async () => {
		const wrapper = await mountAt('/dreams');

		expect(wrapper.text()).toContain('Dreams');
		expect(wrapper.text()).toContain('Goals');
		expect(wrapper.text()).toContain('List');
		expect(wrapper.text()).toContain('Matrix');
		expect(wrapper.findComponent({ name: 'QuickAddFab' }).exists()).toBe(true);
	});

	it('highlights the current route among all five targets', async () => {
		const wrapper = await mountAt('/goals');

		const buttons = wrapper.findAllComponents({ name: 'VBtn' });
		const goalsButton = buttons.find((btn) => btn.text() === 'Goals');
		const dreamsButton = buttons.find((btn) => btn.text() === 'Dreams');

		expect(goalsButton?.props('color')).toBe('primary');
		expect(dreamsButton?.props('color')).toBeUndefined();
	});
});
