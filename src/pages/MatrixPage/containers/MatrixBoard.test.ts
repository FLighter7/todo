// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import type { Todo } from '@/types/todo';
import { InMemoryRepository } from '@/repositories/InMemoryRepository';
import { useTodosStore } from '@/stores/todos';
import MatrixBoard from './MatrixBoard.vue';

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

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('MatrixBoard', () => {
	it('places each seeded task in its own quadrant', async () => {
		const store = useTodosStore();
		await store.load(
			async () =>
				new InMemoryRepository([
					makeTodo({ id: 'a', title: 'Do task', important: true, urgent: true }),
					makeTodo({ id: 'b', title: 'Schedule task', important: true, urgent: false }),
				]),
		);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		expect(wrapper.text()).toContain('Do task');
		expect(wrapper.text()).toContain('Schedule task');
	});

	it('opens the form pre-flagged for the quadrant whose add button was clicked', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository());

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		// The four quadrant add buttons render in QUADRANT_KEYS order: do, schedule, delegate, eliminate.
		const addButtons = wrapper.findAll('button[aria-label="Add task"]');
		await addButtons[2].trigger('click'); // delegate: urgent, not important

		await wrapper.get('input').setValue('Call the bank');
		await clickButtonByText(wrapper, 'Save');

		expect(store.items[0]).toMatchObject({
			title: 'Call the bank',
			important: false,
			urgent: true,
		});
	});

	it('moves a task to its new quadrant reactively when it is toggled', async () => {
		const store = useTodosStore();
		await store.load(
			async () =>
				new InMemoryRepository([
					makeTodo({ id: 'a', title: 'Eliminate task', important: false, urgent: false }),
				]),
		);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });
		expect(wrapper.text()).toContain('Eliminate task');

		await store.update('a', { important: true, urgent: true });
		await wrapper.vm.$nextTick();

		expect(store.quadrants.do.map((t) => t.id)).toEqual(['a']);
	});
});
