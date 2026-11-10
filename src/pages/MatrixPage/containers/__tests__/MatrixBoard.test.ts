// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { ItemType, Status, type Task } from '@/types';
import { useItemsStore } from '@/stores/items';
import { loadItems } from '@/vitestHelpers';
import MatrixBoard from '../MatrixBoard.vue';

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

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('MatrixBoard', () => {
	it('places each seeded task in its own quadrant', async () => {
		await loadItems([
			makeTask({ id: 'a', name: 'Do task', important: true, urgent: true }),
			makeTask({ id: 'b', name: 'Schedule task', important: true, urgent: false }),
		]);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		expect(wrapper.text()).toContain('Do task');
		expect(wrapper.text()).toContain('Schedule task');
	});

	it('opens the form pre-flagged for the quadrant whose add button was clicked', async () => {
		await loadItems();
		const store = useItemsStore();

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		// The four quadrant add buttons render in QUADRANT_KEYS order: do, schedule, delegate, eliminate.
		const addButtons = wrapper.findAll('button[aria-label^="Add a task to "]');
		await addButtons[2].trigger('click'); // delegate: urgent, not important

		await wrapper.get('input').setValue('Call the bank');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(store.tasks.all[0]).toMatchObject({
			name: 'Call the bank',
			important: false,
			urgent: true,
		});
	});

	it('closes a task with Status.Done when its checkbox is checked, and it leaves the quadrant', async () => {
		await loadItems([
			makeTask({ id: 'a', name: 'Eliminate task', important: false, urgent: false }),
		]);
		const store = useItemsStore();

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });
		expect(wrapper.text()).toContain('Eliminate task');

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.vm.$nextTick();

		expect(store.tasks.all.find((task) => task.id === 'a')?.status).toBe(Status.Done);
		expect(wrapper.text()).not.toContain('Eliminate task');
	});
});
