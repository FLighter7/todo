// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import GoalDialog from '../GoalDialog.vue';

const dreamOptions = [{ value: 'dream-1', title: 'Visit Japan' }];

beforeEach(() => {
	i18n.global.locale.value = 'en';
});

describe('GoalDialog add mode', () => {
	it('emits a draft including the picked dream', async () => {
		const wrapper = mount(GoalDialog, {
			props: { modelValue: true, mode: 'add', dreamOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('emits dreamId undefined when "no dream" stays selected', async () => {
		const wrapper = mount(GoalDialog, {
			props: { modelValue: true, mode: 'add', dreamOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined }],
		]);
	});
});

describe('GoalDialog dream picker', () => {
	it('offers "no dream" plus every option passed in', () => {
		const wrapper = mount(GoalDialog, {
			props: { modelValue: true, mode: 'add', dreamOptions },
			global: { plugins: [vuetify, i18n] },
		});

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('items')).toEqual([
			{ value: '', title: 'No dream' },
			{ value: 'dream-1', title: 'Visit Japan' },
		]);
	});
});

describe('GoalDialog edit mode', () => {
	it('shows the linked dream name in the read-only view', () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', dreamId: 'dream-1' },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Visit Japan');
	});

	it('preserves a closed dream that is present only because it is the current selection', async () => {
		const closedOptions = [{ value: 'closed-dream', title: 'Old dream' }];
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', dreamId: 'closed-dream' },
				dreamOptions: closedOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-dream');
	});
});

describe('GoalDialog deadline', () => {
	it('round-trips an existing deadline back out unchanged', async () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: { year: 2027 } }],
		]);
	});

	it('emits deadline undefined after the deadline switch is turned off', async () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input[type="checkbox"]').setValue(false);
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: undefined }],
		]);
	});

	it('shows the formatted deadline in the read-only view', () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027, month: 3 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('March 2027');
	});

	it('keeps the deadline switch on when switching precision away from year', async () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		// Select order: the dream picker, then DeadlineField's precision select.
		const [, precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'day');
		await wrapper.vm.$nextTick();

		expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', true);

		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const [, , monthSelect, daySelect] = selects;
		await monthSelect.vm.$emit('update:modelValue', 3);
		await daySelect.vm.$emit('update:modelValue', 15);
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[
				{
					name: 'Learn Japanese',
					note: undefined,
					dreamId: undefined,
					deadline: { year: 2027, month: 3, day: 15 },
				},
			],
		]);
	});

	it('resets the deadline switch off when reopening on a goal with no deadline', async () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', true);

		// Close without saving, then reopen on a different goal with no deadline.
		await wrapper.setProps({ modelValue: false });
		await wrapper.setProps({ initial: { name: 'Different goal' }, modelValue: true });

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', false);
	});
});
