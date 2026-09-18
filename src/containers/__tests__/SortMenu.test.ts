// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import SortMenu from '../SortMenu.vue';

async function mountAt(path: string): Promise<{ wrapper: VueWrapper; router: Router }> {
	setActivePinia(createPinia());

	const router = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/tasks', name: 'tasks', component: { template: '<div />' } },
		],
	});
	await router.push(path);
	await router.isReady();

	const wrapper = mount(SortMenu, { global: { plugins: [vuetify, i18n, router] } });
	return { wrapper, router };
}

function openMenu(wrapper: VueWrapper): Promise<void> {
	return wrapper.get('button[aria-label="Sort"]').trigger('click');
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('SortMenu options', () => {
	it('lists the four sort options in order', async () => {
		const { wrapper } = await mountAt('/tasks');

		await openMenu(wrapper);

		const labels = wrapper
			.findAll('.v-list-item')
			.map((item) => item.text())
			.filter((text) => text.length > 0);

		expect(labels).toEqual(['Newest first', 'Oldest first', 'A-Z', 'Z-A']);
	});

	it('marks the currently stored sortOrder with a checkmark', async () => {
		const { wrapper } = await mountAt('/tasks');
		useSettingsStore().updatePageSettings('tasks', { sortOrder: 'az' });

		await openMenu(wrapper);

		const items = wrapper.findAllComponents({ name: 'VListItem' });
		const az = items.find((item) => item.text().includes('A-Z'));
		const newest = items.find((item) => item.text().includes('Newest first'));

		expect(az?.props('appendIcon')).toBeTruthy();
		expect(newest?.props('appendIcon')).toBeFalsy();
	});
});

describe('SortMenu selection', () => {
	it('updates the sortOrder of the page it was mounted at, and no other page', async () => {
		const { wrapper } = await mountAt('/goals');

		await openMenu(wrapper);
		const items = wrapper.findAllComponents({ name: 'VListItem' });
		await items.find((item) => item.text().includes('A-Z'))?.trigger('click');

		const settings = useSettingsStore();
		expect(settings.goals.sortOrder).toBe('az');
		expect(settings.tasks.sortOrder).toBe('newest');
		expect(settings.dreams.sortOrder).toBe('newest');
	});

	it('closes the menu after a selection', async () => {
		const { wrapper } = await mountAt('/tasks');

		await openMenu(wrapper);
		const items = wrapper.findAllComponents({ name: 'VListItem' });
		await items.find((item) => item.text().includes('Oldest first'))?.trigger('click');
		await wrapper.vm.$nextTick();

		expect(wrapper.findComponent({ name: 'VOverlay' }).props('modelValue')).toBeFalsy();
	});
});
