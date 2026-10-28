// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { ACCENT_SWATCHES, sectionColorFor } from '@/plugins/theme';
import type { Hex } from '@/types';
import SectionColorField from '../SectionColorField.vue';

function mountField(color?: Hex, paintItems = false) {
	return mount(SectionColorField, {
		props: { color, paintItems },
		global: { plugins: [vuetify, i18n] },
	});
}

function radios(wrapper: ReturnType<typeof mountField>) {
	return wrapper.findAll('input[type="radio"]');
}

function checkedValues(wrapper: ReturnType<typeof mountField>): string[] {
	return radios(wrapper)
		.filter((input) => (input.element as HTMLInputElement).checked)
		.map((input) => input.attributes('value') ?? '');
}

function paintSwitch(wrapper: ReturnType<typeof mountField>) {
	return wrapper.get('input[type="checkbox"]');
}

describe('SectionColorField', () => {
	it('offers the default grey and every swatch, each by name, in a group named by its label', () => {
		const wrapper = mountField();

		const group = wrapper.get('[role="radiogroup"]');
		expect(wrapper.get(`#${group.attributes('aria-labelledby')}`).text()).toBe('Colour');
		expect(group.findAll('label').map((label) => label.text())).toEqual([
			'Default',
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

	it('checks the default without a colour, and the swatch a colour came from', () => {
		expect(checkedValues(mountField())).toEqual(['default']);
		expect(checkedValues(mountField('#d81b60'))).toEqual(['pink']);
	});

	it("reports a swatch's seed, and no colour for the default", async () => {
		const wrapper = mountField();

		await radios(wrapper)[3].setValue();
		expect(wrapper.emitted('update:color')?.at(-1)).toEqual([ACCENT_SWATCHES[2].seed]);

		await wrapper.setProps({ color: ACCENT_SWATCHES[2].seed });
		await radios(wrapper)[0].setValue();
		expect(wrapper.emitted('update:color')?.at(-1)).toEqual([undefined]);
	});

	it('draws each swatch the way a section would draw it', () => {
		const wrapper = mountField();

		const orange = wrapper.findAll('[role="radiogroup"] label')[8];
		expect(orange.attributes('style')).toContain(sectionColorFor('standard', 'light', '#EF6C00'));
	});

	it('reports a colour picked by hand', async () => {
		const wrapper = mountField();
		const input = wrapper.get('input[type="color"]');

		(input.element as HTMLInputElement).value = '#123456';
		await input.trigger('change');
		expect(wrapper.emitted('update:color')).toEqual([['#123456']]);
	});

	it('keeps the paint switch out of reach until there is a colour', async () => {
		const wrapper = mountField();
		expect(paintSwitch(wrapper).attributes('disabled')).toBeDefined();

		await wrapper.setProps({ color: '#1E6FD9' });
		expect(paintSwitch(wrapper).attributes('disabled')).toBeUndefined();

		await paintSwitch(wrapper).setValue(true);
		expect(wrapper.emitted('update:paintItems')?.at(-1)).toEqual([true]);
	});

	it('names the paint switch', () => {
		const wrapper = mountField('#1E6FD9');
		const id = paintSwitch(wrapper).attributes('id');

		expect(wrapper.get(`label[for="${id}"]`).text()).toBe('Colour the text inside');
	});
});
