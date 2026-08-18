// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import type { OccurrenceEntry } from '@/utils/schedule';
import TaskCompletions from './TaskCompletions.vue';

function mountWith(occurrences: OccurrenceEntry[]) {
	return mount(TaskCompletions, {
		props: { occurrences, locale: 'en' },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('TaskCompletions', () => {
	it('shows a mark-done and a skip action for a pending occurrence', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		expect(wrapper.find('button[aria-label="Mark done"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Skip"]').exists()).toBe(true);
	});

	it('shows a mark-not-done action for a done occurrence and no skip action', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'done' },
		]);

		expect(wrapper.find('button[aria-label="Mark not done"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Skip"]').exists()).toBe(false);
	});

	it('shows only an un-skip action for a skipped occurrence', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'skipped' },
		]);

		expect(wrapper.find('button[aria-label="Un-skip"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Mark done"]').exists()).toBe(false);
	});

	it('emits toggle-done with the occurrence and the new value', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		await wrapper.get('button[aria-label="Mark done"]').trigger('click');

		expect(wrapper.emitted('toggle-done')).toEqual([['2026-08-21T09:00', true]]);
	});

	it('emits toggle-done with false from a mark-not-done action', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'done' },
		]);

		await wrapper.get('button[aria-label="Mark not done"]').trigger('click');

		expect(wrapper.emitted('toggle-done')).toEqual([['2026-08-21T09:00', false]]);
	});

	it('emits toggle-skip with the occurrence and the new value', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		await wrapper.get('button[aria-label="Skip"]').trigger('click');

		expect(wrapper.emitted('toggle-skip')).toEqual([['2026-08-21T09:00', true]]);
	});

	it('emits toggle-skip with false from an un-skip action', async () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'skipped' },
		]);

		await wrapper.get('button[aria-label="Un-skip"]').trigger('click');

		expect(wrapper.emitted('toggle-skip')).toEqual([['2026-08-21T09:00', false]]);
	});

	it('shows the done count, pluralized', () => {
		const wrapper = mountWith([
			{ start: '2026-08-07T09:00', end: '2026-08-07T09:00', state: 'done' },
			{ start: '2026-08-14T09:00', end: '2026-08-14T09:00', state: 'done' },
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		expect(wrapper.text()).toContain('2 times done');
	});

	it('omits the done-count caption when nothing is done yet', () => {
		const wrapper = mountWith([
			{ start: '2026-08-21T09:00', end: '2026-08-21T09:00', state: 'pending' },
		]);

		expect(wrapper.text()).not.toContain('time done');
	});
});
