// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import EntityListItem from '../EntityListItem.vue';

function mountItem(props: { name: string; note?: string; done: boolean; date?: string }) {
	return mount(EntityListItem, { props, global: { plugins: [vuetify, i18n] } });
}

describe('EntityListItem', () => {
	it('renders the name and, when present, the note', () => {
		const wrapper = mountItem({ name: 'Visit Japan', note: 'Cherry blossom season', done: false });

		expect(wrapper.text()).toContain('Visit Japan');
		expect(wrapper.text()).toContain('Cherry blossom season');
	});

	it('omits the note element entirely when there is none', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		expect(wrapper.findComponent({ name: 'VListItemSubtitle' }).exists()).toBe(false);
	});

	it('reflects the done prop on the checkbox', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: true });

		expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
	});

	it('emits update:done, not click, when the checkbox is toggled', async () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('update:done')).toEqual([[true]]);
		expect(wrapper.emitted('click')).toBeUndefined();
	});

	it('emits click when the item body is clicked', async () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		await wrapper.get('.v-list-item').trigger('click');

		expect(wrapper.emitted('click')).toHaveLength(1);
	});
});

describe('EntityListItem date', () => {
	it('renders the date when provided', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false, date: 'March 2027' });

		expect(wrapper.text()).toContain('March 2027');
	});

	it('omits the date element entirely when there is none', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		expect(wrapper.find('.text-body-small').exists()).toBe(false);
	});
});
