// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import type { Schedule } from '@/types';
import ScheduleField from './ScheduleField.vue';

function mountField(modelValue?: Schedule) {
	return mount(ScheduleField, {
		props: { modelValue },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('ScheduleField collapsed state', () => {
	it('shows only the toggle when there is no schedule', () => {
		const wrapper = mountField(undefined);

		expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(false);
	});
});

describe('ScheduleField turning the toggle on', () => {
	it('reveals the start field and emits nothing until a start is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.find('input[type="datetime-local"]').exists()).toBe(true);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('emits a floating schedule once a start is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ start: '2026-08-21T09:00', tzid: undefined, duration: undefined, rrule: undefined },
		]);
	});
});

describe('ScheduleField end time', () => {
	it('computes a duration once an end time is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true); // hasEndTime
		await wrapper.get('input[type="time"]').setValue('11:30');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ start: '2026-08-21T09:00', tzid: undefined, duration: 'PT2H30M', rrule: undefined },
		]);
	});

	it('emits nothing while the end-time switch is on but no time is chosen yet', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});
});

describe('ScheduleField timezone anchor', () => {
	it('emits tzid once the switch is on and a zone is picked', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		await wrapper.findAll('input[type="checkbox"]')[2].setValue(true); // hasTzid
		const [, tzidSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await tzidSelect.vm.$emit('update:modelValue', 'America/New_York');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{
				start: '2026-08-21T09:00',
				tzid: 'America/New_York',
				duration: undefined,
				rrule: undefined,
			},
		]);
	});
});

describe('ScheduleField existing value', () => {
	it('derives the end-time switch and field from an existing duration', () => {
		const wrapper = mountField({ start: '2026-08-21T09:00', duration: 'PT4H' });

		expect((wrapper.get('input[type="time"]').element as HTMLInputElement).value).toBe('13:00');
	});

	it('derives the timezone switch and field from an existing tzid', () => {
		const wrapper = mountField({ start: '2026-08-21T09:00', tzid: 'Europe/Warsaw' });

		const [, tzidSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(tzidSelect.props('modelValue')).toBe('Europe/Warsaw');
	});

	it('emits undefined when the toggle is turned off', async () => {
		const wrapper = mountField({ start: '2026-08-21T09:00' });

		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});
});
