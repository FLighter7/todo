// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import TodoForm from './TodoForm.vue';

describe('TodoForm', () => {
	it('blocks submit and shows an error when the title is empty', async () => {
		const wrapper = mount(TodoForm, {
			props: { modelValue: true },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.text()).toContain('Title is required');
	});

	it('emits a trimmed draft and closes on a valid submit', async () => {
		const wrapper = mount(TodoForm, {
			props: { modelValue: true },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('  Buy milk  ');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('submit')).toEqual([
			[
				{
					title: 'Buy milk',
					note: undefined,
					period: 'one-time',
					important: true,
					urgent: false,
				},
			],
		]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('closes without emitting submit when cancelled', async () => {
		const wrapper = mount(TodoForm, {
			props: { modelValue: true },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await clickButtonByText(wrapper, 'Cancel');

		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('prefills from the initial draft when it opens in edit mode', async () => {
		const wrapper = mount(TodoForm, {
			props: {
				modelValue: false,
				mode: 'edit',
				initial: { title: 'Existing task', important: true, urgent: true, period: 'periodic' },
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.setProps({ modelValue: true });

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Existing task');
		expect(wrapper.text()).toContain('Edit task');
	});
});
