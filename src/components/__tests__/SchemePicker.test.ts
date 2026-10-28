// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { paletteFor } from '@/plugins/theme';
import type { ColorScheme, Hex } from '@/types';
import SchemePicker from '../SchemePicker.vue';

function mountPicker(modelValue: ColorScheme = 'standard', accent: Hex | null = null) {
	return mount(SchemePicker, {
		props: { modelValue, accent, labelledby: 'scheme-heading' },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('SchemePicker', () => {
	it('offers every scheme as a radio, named by the scheme alone, in a group named by the heading', () => {
		const wrapper = mountPicker();

		const group = wrapper.get('[role="radiogroup"]');
		expect(group.attributes('aria-labelledby')).toBe('scheme-heading');
		const names = wrapper.findAll('input[type="radio"]').map((input) => {
			return wrapper.get(`#${input.attributes('aria-labelledby')}`).text();
		});
		expect(names).toEqual(['Standard', 'Neutral', 'Cool', 'Pure black', 'High contrast']);
	});

	it('describes pure black by what it is in light mode', () => {
		const wrapper = mountPicker();

		const black = wrapper.get('input[value="black"]');
		expect(wrapper.get(`#${black.attributes('aria-describedby')}`).text()).toBe(
			'Neutral in light mode',
		);
	});

	it('checks the current scheme, and marks it with more than colour', () => {
		const wrapper = mountPicker('contrast');

		const checked = wrapper.findAll('input[type="radio"]').filter((input) => {
			return (input.element as HTMLInputElement).checked;
		});
		expect(checked.map((input) => input.attributes('value'))).toEqual(['contrast']);
		expect(wrapper.findAll('label')[4].find('svg').exists()).toBe(true);
		expect(wrapper.findAll('label')[0].find('.v-icon').exists()).toBe(false);
	});

	it('reports the scheme picked', async () => {
		const wrapper = mountPicker();

		await wrapper.findAll('input[type="radio"]')[2].setValue();

		expect(wrapper.emitted('update:modelValue')).toEqual([['cool']]);
	});

	it('previews each scheme with the accent as that scheme would draw it', () => {
		const wrapper = mountPicker('standard', '#D81B60');

		const darkContrast = wrapper.findAll('label')[4].findAll('[style]')[1];
		expect(darkContrast.attributes('style')).toContain(
			paletteFor('contrast', 'dark', '#D81B60').colors.primary,
		);
	});
});
