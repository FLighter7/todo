// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Status, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useTasksStore } from '@/stores/tasks';
import MatrixBoard from './MatrixBoard.vue';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
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

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('MatrixBoard', () => {
	it('places each seeded task in its own quadrant', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', name: 'Do task', important: true, urgent: true }),
					makeTask({ id: 'b', name: 'Schedule task', important: true, urgent: false }),
				]),
		);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		expect(wrapper.text()).toContain('Do task');
		expect(wrapper.text()).toContain('Schedule task');
	});

	it('opens the form pre-flagged for the quadrant whose add button was clicked', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository<Task>());

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		// The four quadrant add buttons render in QUADRANT_KEYS order: do, schedule, delegate, eliminate.
		const addButtons = wrapper.findAll('button[aria-label="Add task"]');
		await addButtons[2].trigger('click'); // delegate: urgent, not important

		await wrapper.get('input').setValue('Call the bank');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(store.records[0]).toMatchObject({
			name: 'Call the bank',
			important: false,
			urgent: true,
		});
	});

	it('closes a task with Status.Done when its checkbox is checked, and it leaves the quadrant', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', name: 'Eliminate task', important: false, urgent: false }),
				]),
		);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });
		expect(wrapper.text()).toContain('Eliminate task');

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.vm.$nextTick();

		expect(store.records.find((task) => task.id === 'a')?.status).toBe(Status.Done);
		expect(wrapper.text()).not.toContain('Eliminate task');
	});
});
