import { nextTick } from 'vue';
import type { VueWrapper } from '@vue/test-utils';
import type { Item } from '@/types';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import { useEntityTabsStore } from '@/stores/entityTabs';
import { useItemsStore } from '@/stores/items';

/**
 * Vuetify renders clickable actions as either a native <button> (v-btn) or a
 * <div class="v-list-item"> (v-list-item, e.g. inside a v-menu) — neither
 * exposes a stable selector on its own, and this project uses
 * @vue/test-utils rather than testing-library, so matching by visible text
 * across both element kinds is the pragmatic way to click "the Save button"
 * or "the Export to a file menu entry".
 */
export function clickButtonByText(wrapper: VueWrapper, text: string): Promise<void> {
	const target = wrapper
		.findAll('button, .v-list-item')
		.find((candidate) => candidate.text().includes(text));

	if (!target) {
		throw new Error(`No clickable element with text "${text}"`);
	}

	return target.trigger('click');
}

/**
 * The Active/History toggle lives in DefaultLayout, not in the page
 * container, so tests that mount a page container directly can't click a
 * "History" button that isn't rendered there — this flips the shared store
 * the toggle and the page container both read from. One value for all the
 * list pages, so no page argument.
 */
export function setEntityTab(value: 'active' | 'history'): Promise<void> {
	useEntityTabsStore().tab = value;
	return nextTick();
}

/**
 * Seeds the items store from memory, the way `DefaultLayout` loads it from
 * IndexedDB in the app. Goes through `load()`, so closed fixtures need a
 * recent `updated` or garbage collection drops them.
 */
export async function loadItems(records: Item[] = []): Promise<void> {
	await useItemsStore().load(async () => new ItemMemoryRepository<Item>(records));
}
