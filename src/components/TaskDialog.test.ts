// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import TaskDialog from './TaskDialog.vue';

const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];

describe('TaskDialog add mode', () => {
	it('emits a draft including flags and the picked goal', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});

	it('emits goalId undefined when "no goal" stays selected', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: false, urgent: false, goalId: undefined }],
		]);
	});
});

describe('TaskDialog goal picker', () => {
	it('offers "no goal" plus every option passed in', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('items')).toEqual([
			{ value: '', title: 'No goal' },
			{ value: 'goal-1', title: 'Learn Japanese' },
		]);
	});

	it('preserves a closed goal that is present only because it is the current selection', async () => {
		const closedOptions = [{ value: 'closed-goal', title: 'Old goal' }];
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: false, urgent: false, goalId: 'closed-goal' },
				goalOptions: closedOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-goal');
	});
});

describe('TaskDialog edit mode', () => {
	it('shows the linked goal name and important/urgent chips in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: true, urgent: false, goalId: 'goal-1' },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Important');
		expect(wrapper.text()).not.toContain('Urgent');
	});

	it('omits the important/urgent chips entirely when both flags are false', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: false, urgent: false },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent({ name: 'VChip' }).exists()).toBe(false);
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: false, urgent: false },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});
