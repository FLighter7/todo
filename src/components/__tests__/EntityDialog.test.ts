// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import EntityDialog from '../EntityDialog.vue';

describe('EntityDialog add mode', () => {
	it('opens directly editable, with no pencil and no cancel-record button', () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'New dream', mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('button[aria-label="Edit"]').exists()).toBe(false);
		expect(wrapper.find('button[aria-label="Save"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Cancel this record');
	});
});

describe('EntityDialog edit mode', () => {
	it('opens read-only, with a pencil and a cancel-record button', () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('button[aria-label="Edit"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Save"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('Cancel this record');
	});

	it('switches to editing when the pencil is clicked, exposing editing:true to the slot', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			slots: {
				default: (props: { editing: boolean }) => h('span', props.editing ? 'editing' : 'viewing'),
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('viewing');

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		expect(wrapper.text()).toContain('editing');
		expect(wrapper.find('button[aria-label="Save"]').exists()).toBe(true);
	});

	it('emits save when the checkmark is clicked', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toHaveLength(1);
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});

	it('resets to read-only the next time it opens', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.setProps({ modelValue: false });
		await wrapper.setProps({ modelValue: true });

		expect(wrapper.find('button[aria-label="Edit"]').exists()).toBe(true);
	});
});

describe('EntityDialog close button', () => {
	it('closes the dialog, for a touch screen reader with no Escape key', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Close"]').trigger('click');

		expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
	});
});
