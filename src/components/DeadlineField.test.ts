// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Season, type Deadline } from '@/types';
import DeadlineField from './DeadlineField.vue';

beforeEach(() => {
	i18n.global.locale.value = 'en';
});

function mountField(modelValue?: Deadline) {
	return mount(DeadlineField, {
		props: { modelValue },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('DeadlineField collapsed state', () => {
	it('shows only the toggle when there is no deadline', () => {
		const wrapper = mountField(undefined);

		expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(false);
	});
});

describe('DeadlineField turning the toggle on', () => {
	it('reveals the precision selector, defaulting to year', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);

		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(precisionSelect.props('modelValue')).toBe('year');
	});

	it('emits a year-only deadline once a year is typed', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ year: 2027 }]);
	});
});

describe('DeadlineField season precision', () => {
	it('emits a season without a year when none is entered', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'season');
		await wrapper.vm.$nextTick();
		const [, seasonSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await seasonSelect.vm.$emit('update:modelValue', Season.Summer);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ year: undefined, season: Season.Summer },
		]);
	});
});

describe('DeadlineField day precision', () => {
	it('does not emit anything until both month and day are set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'day');
		await wrapper.vm.$nextTick();
		const [, monthSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await monthSelect.vm.$emit('update:modelValue', 3);

		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});

	it('emits an exact day without a year once month and day are both set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'day');
		await wrapper.vm.$nextTick();
		const [, monthSelect, daySelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await monthSelect.vm.$emit('update:modelValue', 3);
		await daySelect.vm.$emit('update:modelValue', 15);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ year: undefined, month: 3, day: 15 },
		]);
	});
});

describe('DeadlineField existing value', () => {
	it('derives the precision from an existing deadline', () => {
		const wrapper = mountField({ year: 2027, season: Season.Winter });

		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(precisionSelect.props('modelValue')).toBe('season');
	});

	it('emits undefined when the toggle is turned off', async () => {
		const wrapper = mountField({ year: 2027 });

		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});
});
