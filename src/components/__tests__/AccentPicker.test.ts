// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { ACCENT_SWATCHES, paletteFor } from '@/plugins/theme';
import type { Hex } from '@/types';
import AccentPicker from '../AccentPicker.vue';

function mountPicker(modelValue: Hex | null = null) {
	return mount(AccentPicker, {
		props: { modelValue, scheme: 'standard', mode: 'light', labelledby: 'accent-heading' },
		global: { plugins: [vuetify, i18n] },
	});
}

function radios(wrapper: ReturnType<typeof mountPicker>) {
	return wrapper.findAll('input[type="radio"]');
}

function checkedValues(wrapper: ReturnType<typeof mountPicker>): string[] {
	return radios(wrapper)
		.filter((input) => (input.element as HTMLInputElement).checked)
		.map((input) => input.attributes('value') ?? '');
}

describe('AccentPicker', () => {
	it("offers the scheme's own accent and every swatch, each by name, in a named group", () => {
		const wrapper = mountPicker();

		expect(wrapper.get('[role="radiogroup"]').attributes('aria-labelledby')).toBe('accent-heading');
		expect(wrapper.findAll('[role="radiogroup"] label').map((label) => label.text())).toEqual([
			"The scheme's own",
			'Green',
			'Teal',
			'Blue',
			'Indigo',
			'Violet',
			'Pink',
			'Red',
			'Orange',
			'Brown',
			'Slate',
		]);
	});

	it("checks the scheme's own accent when there is none", () => {
		expect(checkedValues(mountPicker())).toEqual(['scheme']);
	});

	it('checks the swatch the accent came from', () => {
		expect(checkedValues(mountPicker('#d81b60'))).toEqual(['pink']);
	});

	it("reports a swatch's seed, and null for the scheme's own", async () => {
		const wrapper = mountPicker();

		await radios(wrapper)[3].setValue();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([ACCENT_SWATCHES[2].seed]);

		await wrapper.setProps({ modelValue: ACCENT_SWATCHES[2].seed });
		await radios(wrapper)[0].setValue();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
	});

	it('draws each swatch as the palette on screen would', () => {
		const wrapper = mountPicker();

		const blue = wrapper.findAll('[role="radiogroup"] label')[3];
		expect(blue.attributes('style')).toContain(
			paletteFor('standard', 'light', '#1E6FD9').colors.primary,
		);
	});

	it('reports a colour picked by hand, once the picker closes', async () => {
		const wrapper = mountPicker();
		const input = wrapper.get('input[type="color"]');

		(input.element as HTMLInputElement).value = '#123456';
		await input.trigger('input');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();

		await input.trigger('change');
		expect(wrapper.emitted('update:modelValue')).toEqual([['#123456']]);
	});

	it('names the custom colour and explains the fitting', () => {
		const wrapper = mountPicker();
		const input = wrapper.get('input[type="color"]');

		expect(wrapper.get(`label[for="${input.attributes('id')}"]`).text()).toBe('Custom colour');
		const hint = wrapper.get(`#${input.attributes('aria-describedby')}`);
		expect(hint.text()).toContain('lighter or darker');
	});

	it('leaves every radio unchecked for a colour of its own, and marks the custom circle', () => {
		const wrapper = mountPicker('#123456');

		expect(checkedValues(wrapper)).toEqual([]);
		const row = wrapper.get('input[type="color"]').element.parentElement as HTMLElement;
		const circle = row.firstElementChild as HTMLElement;
		expect(circle.querySelector('svg')).not.toBeNull();
		expect(circle.getAttribute('style')).toContain(
			paletteFor('standard', 'light', '#123456').colors.primary,
		);
	});
});
