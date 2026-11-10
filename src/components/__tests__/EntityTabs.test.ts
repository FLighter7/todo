// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import EntityTabs from '../EntityTabs.vue';

async function mountTabs(modelValue: 'active' | 'history' = 'active') {
	setActivePinia(createPinia());

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [{ path: '/tasks', name: 'tasks', component: { template: '<div />' } }],
	});
	await router.push('/tasks');
	await router.isReady();

	return mount(EntityTabs, {
		props: { modelValue },
		global: { plugins: [vuetify, i18n, router] },
	});
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('EntityTabs', () => {
	it('renders both labels', async () => {
		const wrapper = await mountTabs();

		expect(wrapper.text()).toContain('Active');
		expect(wrapper.text()).toContain('History');
	});

	it('emits update:modelValue with the clicked tab', async () => {
		const wrapper = await mountTabs('active');

		await clickButtonByText(wrapper, 'History');

		expect(wrapper.emitted('update:modelValue')).toEqual([['history']]);
	});

	it('renders the sort menu alongside the tabs', async () => {
		const wrapper = await mountTabs();

		expect(wrapper.find('button[aria-label="Sort"]').exists()).toBe(true);
	});
});
