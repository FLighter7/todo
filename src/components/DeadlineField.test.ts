// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Season, type Deadline } from '@/types';
import DeadlineField from './DeadlineField.vue';

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

describe('DeadlineField year validation', () => {
	it('rejects a non-integer year and behaves as if nothing was typed', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		// Establish a real value first so the subsequent rejection is an
		// observable change (undefined -> undefined would never emit).
		await wrapper.get('input[type="number"]').setValue('2027');
		await wrapper.get('input[type="number"]').setValue('2027.5');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('rejects a year above 9999', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');
		await wrapper.get('input[type="number"]').setValue('99999');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('rejects a zero or negative year', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');
		await wrapper.get('input[type="number"]').setValue('0');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('accepts a valid in-range year', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ year: 2027 }]);
	});
});

describe('DeadlineField precision switch on an existing deadline', () => {
	it('keeps the sub-form open when switching to a precision with unset fields', async () => {
		const wrapper = mountField({ year: 2027 });

		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'day');
		await wrapper.vm.$nextTick();

		// A collapse (the bug) hides the whole panel, including the switch
		// itself going back to unchecked and every select disappearing.
		expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', true);
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		expect(selects.length).toBe(3);

		const [, monthSelect, daySelect] = selects;
		await monthSelect.vm.$emit('update:modelValue', 3);
		await daySelect.vm.$emit('update:modelValue', 15);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ year: 2027, month: 3, day: 15 },
		]);
	});
});

describe('DeadlineField clearing and retyping the year', () => {
	it('does not collapse the form while the year field is momentarily empty', async () => {
		const wrapper = mountField({ year: 2027 });

		await wrapper.get('input[type="number"]').setValue('');
		await wrapper.vm.$nextTick();

		expect(wrapper.get('input[type="checkbox"]').element).toHaveProperty('checked', true);
		expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(true);

		await wrapper.get('input[type="number"]').setValue('2028');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ year: 2028 }]);
	});
});
