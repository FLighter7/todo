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
		const [tzidSelect] = wrapper.findAllComponents({ name: 'VSelect' });
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

		const [tzidSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(tzidSelect.props('modelValue')).toBe('Europe/Warsaw');
	});

	it('emits undefined when the toggle is turned off', async () => {
		const wrapper = mountField({ start: '2026-08-21T09:00' });

		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('preserves an existing exdate/rdate through an unrelated field change', async () => {
		const wrapper = mountField({
			start: '2026-08-21T09:00',
			exdate: ['2026-08-28T09:00'],
			rdate: ['2026-08-30T09:00'],
		});

		await wrapper.findAll('input[type="checkbox"]')[1].setValue(true); // hasEndTime
		await wrapper.get('input[type="time"]').setValue('11:30');

		const emitted = wrapper.emitted('update:modelValue')?.at(-1)?.[0];
		expect(emitted).toMatchObject({
			exdate: ['2026-08-28T09:00'],
			rdate: ['2026-08-30T09:00'],
		});
	});
});

describe('ScheduleField repeat presets', () => {
	it('defaults the weekday to the day of the chosen start date', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00'); // a Friday
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{
				start: '2026-08-21T09:00',
				tzid: undefined,
				duration: undefined,
				rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR',
			},
		]);
	});

	it('never emits a weekly rule with every day unchecked', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();

		const fridayCheckbox = wrapper
			.findAllComponents({ name: 'VCheckbox' })
			.find((c) => c.props('modelValue') === true);
		await fridayCheckbox?.vm.$emit('update:modelValue', false);
		await wrapper.vm.$nextTick();

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR',
		});
	});

	it('marks the last remaining checked weekday readonly so the DOM cannot desync from the guard', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();

		const dayCheckboxes = wrapper.findAllComponents({ name: 'VCheckbox' });
		const checked = dayCheckboxes.filter((c) => c.props('modelValue') === true);
		const unchecked = dayCheckboxes.filter((c) => c.props('modelValue') !== true);

		expect(checked).toHaveLength(1);
		expect(checked[0]?.props('readonly')).toBe(true);
		for (const c of unchecked) {
			expect(c.props('readonly')).toBeFalsy();
		}
	});

	it('builds a monthly rule with a non-default interval', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'monthly');
		await wrapper.vm.$nextTick();
		await wrapper.get('input[type="number"]').setValue('3');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{
				start: '2026-08-21T09:00',
				tzid: undefined,
				duration: undefined,
				rrule: 'FREQ=MONTHLY;INTERVAL=3',
			},
		]);
	});

	it('rejects a negative interval instead of building an rrule that would hang', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'daily');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="number"]').setValue('-1');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('rejects an emptied interval field instead of building an rrule that would hang', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'daily');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="number"]').setValue('');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('defaults the weekday even when "Weekly" is picked before a start date is set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00'); // a Friday

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{
				start: '2026-08-21T09:00',
				tzid: undefined,
				duration: undefined,
				rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR',
			},
		]);
	});
});

describe('ScheduleField end condition', () => {
	async function mountWeekly() {
		const wrapper = mountField(undefined);
		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-21T09:00');
		const [repeatSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await repeatSelect.vm.$emit('update:modelValue', 'weekly');
		await wrapper.vm.$nextTick();
		return wrapper;
	}

	it('rejects an occurrence count below 2', async () => {
		const wrapper = await mountWeekly();
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const endTypeSelect = selects[selects.length - 1];
		await endTypeSelect.vm.$emit('update:modelValue', 'count');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="number"][min="2"]').setValue('1');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('emits COUNT once a valid occurrence count is set', async () => {
		const wrapper = await mountWeekly();
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const endTypeSelect = selects[selects.length - 1];
		await endTypeSelect.vm.$emit('update:modelValue', 'count');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="number"][min="2"]').setValue('5');

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;COUNT=5',
		});
	});

	it('emits UNTIL once an end date is set', async () => {
		const wrapper = await mountWeekly();
		const selects = wrapper.findAllComponents({ name: 'VSelect' });
		const endTypeSelect = selects[selects.length - 1];
		await endTypeSelect.vm.$emit('update:modelValue', 'until');
		await wrapper.vm.$nextTick();

		await wrapper.get('input[type="date"]').setValue('2027-01-01');

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=FR;UNTIL=20270101T235900Z',
		});
	});
});

describe('ScheduleField custom-rule fallback', () => {
	it('shows an unparseable existing rrule as a read-only custom rule', () => {
		const wrapper = mountField({
			start: '2026-08-21T09:00',
			rrule: 'FREQ=MONTHLY;BYMONTHDAY=15,20',
		});

		expect(wrapper.text()).toContain('FREQ=MONTHLY;BYMONTHDAY=15,20');
	});

	it('leaves a custom rule untouched when an unrelated field changes', async () => {
		const wrapper = mountField({
			start: '2026-08-21T09:00',
			rrule: 'FREQ=MONTHLY;BYMONTHDAY=15,20',
		});

		await wrapper.get('input[type="datetime-local"]').setValue('2026-08-22T10:00');

		expect(wrapper.emitted('update:modelValue')?.at(-1)?.[0]).toMatchObject({
			rrule: 'FREQ=MONTHLY;BYMONTHDAY=15,20',
		});
	});
});
