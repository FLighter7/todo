// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { mdiCalendarClockOutline, mdiFire } from '@mdi/js';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import type { Todo } from '@/types/todo';
import TodoQuadrant from './TodoQuadrant.vue';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

describe('TodoQuadrant', () => {
	it('renders every item it is given', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo()], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
	});

	it('shows the empty state when there are no items', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Empty');
	});

	it('strikes through a done item', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo({ done: true })], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		const title = wrapper.find('.v-list-item-title');
		expect(title.classes().some((cls) => cls.includes('done'))).toBe(true);
	});

	it('emits toggle with the todo id when its checkbox is clicked', async () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo({ id: 'target' })], icon: mdiFire, accent: true },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('toggle')).toEqual([['target']]);
	});

	it('emits add with the quadrant key when the add button is clicked', async () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'schedule', items: [], icon: mdiCalendarClockOutline },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, ''); // the add button has an icon only, no text
		expect(wrapper.emitted('add')).toEqual([['schedule']]);
	});
});
