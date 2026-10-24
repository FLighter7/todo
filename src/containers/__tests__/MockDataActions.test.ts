// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText, loadItems } from '@/vitestHelpers';
import { ItemType } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import MockDataActions from '../MockDataActions.vue';

async function loadEmptyStores(): Promise<void> {
	await loadItems();
}

/**
 * The confirm dialog's "Generate" action shares the word "Generate" with the
 * list item's own title ("Generate sample data") -- `clickButtonByText`'s
 * substring match would find the list item first, since it comes first in
 * DOM order. The dialog's actions render as real `<button>` elements while
 * the list item renders as a `.v-list-item` div, so restricting to buttons
 * with an exact text match disambiguates the two.
 */
function clickDialogAction(wrapper: VueWrapper, text: string): Promise<void> {
	const target = wrapper.findAll('button').find((candidate) => candidate.text().trim() === text);
	if (!target) {
		throw new Error(`No dialog button with text "${text}"`);
	}

	return target.trigger('click');
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('MockDataActions', () => {
	it('generates immediately, with no confirm dialog, when the store is empty', async () => {
		await loadEmptyStores();
		const items = useItemsStore();

		const wrapper = mount(MockDataActions, { global: { plugins: [vuetify, i18n] } });

		expect(wrapper.text()).not.toContain('Replace everything?');

		await clickButtonByText(wrapper, 'Generate sample data');
		await flushPromises();

		expect(wrapper.text()).not.toContain('Replace everything?');
		expect(items.records.length).toBe(41);
		expect(wrapper.emitted('notify')?.at(-1)?.[0]).toBe('Sample data generated. Records: 41.');
	});

	it('confirms before replacing when data already exists, and honours Cancel/Generate', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.add(ItemType.Dream, { name: 'Existing dream' });

		const wrapper = mount(MockDataActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Generate sample data');
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('Replace everything?');
		expect(wrapper.text()).toContain('1 records total');

		await clickDialogAction(wrapper, 'Cancel');
		await flushPromises();

		expect(items.records.map((r) => r.name)).toEqual(['Existing dream']);
		expect(wrapper.emitted('notify')).toBeUndefined();

		await clickButtonByText(wrapper, 'Generate sample data');
		await wrapper.vm.$nextTick();
		await clickDialogAction(wrapper, 'Generate');
		await flushPromises();

		expect(items.records.map((r) => r.name)).not.toContain('Existing dream');
		expect(items.records.length).toBe(41);
		expect(wrapper.emitted('notify')?.at(-1)?.[0]).toBe('Sample data generated. Records: 41.');
	});

	it('notifies mockData.failed when replaceAll rejects', async () => {
		await loadEmptyStores();
		const items = useItemsStore();

		vi.spyOn(items, 'replaceAll').mockRejectedValue(new Error('quota exceeded'));

		const wrapper = mount(MockDataActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Generate sample data');
		await flushPromises();

		expect(items.records).toHaveLength(0);
		expect(wrapper.emitted('notify')?.at(-1)?.[0]).toBe(
			'Could not generate sample data: quota exceeded',
		);
	});

	it('leaves AppSettings untouched by generation', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const wrapper = mount(MockDataActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Generate sample data');
		await flushPromises();

		expect(settings.general.theme).toBe('dark');
	});
});
