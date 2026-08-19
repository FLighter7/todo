// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import DreamDialog from '../DreamDialog.vue';

describe('DreamDialog add mode', () => {
	it('opens directly editable and emits a trimmed draft on save', async () => {
		const wrapper = mount(DreamDialog, {
			props: { modelValue: true, mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('  Visit Japan  ');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(DreamDialog, {
			props: { modelValue: true, mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('DreamDialog edit mode', () => {
	it('opens read-only, showing the existing name and note as plain text', () => {
		const wrapper = mount(DreamDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Visit Japan', note: 'Cherry blossom season' },
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Visit Japan');
		expect(wrapper.text()).toContain('Cherry blossom season');
		expect(wrapper.find('input').exists()).toBe(false);
	});

	it('prefills the fields once editing starts', async () => {
		const wrapper = mount(DreamDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Visit Japan', note: 'Cherry blossom season' },
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Visit Japan');
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(DreamDialog, {
			props: { modelValue: true, mode: 'edit', initial: { name: 'Visit Japan' } },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});
