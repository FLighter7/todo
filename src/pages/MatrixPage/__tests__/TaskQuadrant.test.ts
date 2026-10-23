// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { mdiCalendarClockOutline, mdiFire } from '@mdi/js';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { ItemType, Status, type Task } from '@/types';
import TaskQuadrant from '../TaskQuadrant.vue';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		type: ItemType.Task,
		id: 'id-1',
		name: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

describe('TaskQuadrant', () => {
	it('renders every item it is given', () => {
		const wrapper = mount(TaskQuadrant, {
			props: { quadrant: 'do', items: [makeTask()], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
	});

	it('shows the empty state when there are no items', () => {
		const wrapper = mount(TaskQuadrant, {
			props: { quadrant: 'do', items: [], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Empty');
	});

	it('emits done with the task id when its checkbox is clicked', async () => {
		const wrapper = mount(TaskQuadrant, {
			props: { quadrant: 'do', items: [makeTask({ id: 'target' })], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('done')).toEqual([['target']]);
	});

	it('emits add with the quadrant key when the add button is clicked', async () => {
		const wrapper = mount(TaskQuadrant, {
			props: { quadrant: 'schedule', items: [], icon: mdiCalendarClockOutline },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, ''); // the add button has an icon only, no text
		expect(wrapper.emitted('add')).toEqual([['schedule']]);
	});
});
