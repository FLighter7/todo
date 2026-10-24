// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import GroupDialog from '../GroupDialog.vue';

describe('GroupDialog add mode', () => {
	it('opens directly editable with a name field only, and emits a trimmed draft', async () => {
		const wrapper = mount(GroupDialog, {
			props: { modelValue: true, mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findAll('input')).toHaveLength(1);
		expect(wrapper.find('textarea').exists()).toBe(false);

		await wrapper.get('input').setValue('  Errands  ');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([[{ name: 'Errands' }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(GroupDialog, {
			props: { modelValue: true, mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('GroupDialog edit mode', () => {
	it('opens read-only, showing the existing name as plain text', () => {
		const wrapper = mount(GroupDialog, {
			props: { modelValue: true, mode: 'edit', initial: { name: 'Errands' } },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Group');
		expect(wrapper.text()).toContain('Errands');
		expect(wrapper.find('input').exists()).toBe(false);
	});

	it('prefills the name once editing starts', async () => {
		const wrapper = mount(GroupDialog, {
			props: { modelValue: true, mode: 'edit', initial: { name: 'Errands' } },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Errands');
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(GroupDialog, {
			props: { modelValue: true, mode: 'edit', initial: { name: 'Errands' } },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});
