import type { VueWrapper } from '@vue/test-utils';

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
