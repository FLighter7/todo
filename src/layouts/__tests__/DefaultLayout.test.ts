// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import DefaultLayout from '../DefaultLayout.vue';

function makeTestRouter(): Router {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/tasks', name: 'tasks', component: { template: '<div />' } },
			{ path: '/matrix', name: 'matrix', component: { template: '<div />' } },
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/settings', name: 'settings', component: { template: '<div />' } },
			{ path: '/sync', name: 'sync', component: { template: '<div />' } },
		],
	});
}

async function mountAt(path: string) {
	window.localStorage.clear();
	setActivePinia(createPinia());
	const router = makeTestRouter();
	await router.push(path);
	await router.isReady();

	const wrapper = mount(DefaultLayout, { global: { plugins: [vuetify, i18n, router] } });
	return { wrapper, router };
}

/**
 * Navigating via a plain `@click` handler (not `RouterLink`) resolves later
 * than a handful of zero-delay `flushPromises()` ticks can reliably observe
 * here, so this polls with a real timer until the route settles.
 */
async function clickAndWaitForNavigation(target: ReturnType<VueWrapper['get']>): Promise<void> {
	await target.trigger('click');
	await new Promise((resolve) => setTimeout(resolve, 100));
	await flushPromises();
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('DefaultLayout header navigation icons', () => {
	it('opens sync from a main page and returns to it on a second click', async () => {
		const { wrapper, router } = await mountAt('/matrix');

		await clickAndWaitForNavigation(wrapper.get('[aria-label="Sync"]'));
		expect(router.currentRoute.value.name).toBe('sync');

		await clickAndWaitForNavigation(wrapper.get('[aria-label="Sync"]'));
		expect(router.currentRoute.value.name).toBe('matrix');
	});

	it('switches directly from settings to sync without detouring through the main page', async () => {
		const { wrapper, router } = await mountAt('/tasks');

		await clickAndWaitForNavigation(wrapper.get('[aria-label="Settings"]'));
		expect(router.currentRoute.value.name).toBe('settings');

		await clickAndWaitForNavigation(wrapper.get('[aria-label="Sync"]'));
		expect(router.currentRoute.value.name).toBe('sync');
	});
});
