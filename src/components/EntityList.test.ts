// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Status, type Dream } from '@/types';
import EntityList from './EntityList.vue';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'a',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('EntityList empty state', () => {
	it('shows the empty text when there is nothing to render', () => {
		const wrapper = mount(EntityList, {
			props: { groups: [], ungrouped: [], emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Nothing here yet.');
	});
});

describe('EntityList grouped rendering', () => {
	it('renders each group with its label and items, then the ungrouped tail', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [
					{
						key: 'dream-1',
						label: 'Visit Japan',
						items: [makeDream({ id: 'g1', name: 'Learn Japanese' })],
					},
				],
				ungrouped: [makeDream({ id: 'g2', name: 'Read more' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Read more');
	});

	it('renders ungrouped items with no group wrapper when there are no groups', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', name: 'Visit Japan' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Visit Japan');
	});
});

describe('EntityList note visibility', () => {
	it('hides the note when showNote is false', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', note: 'Cherry blossoms' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).not.toContain('Cherry blossoms');
	});

	it('shows the note when showNote is true', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', note: 'Cherry blossoms' })],
				emptyText: 'Nothing here yet.',
				showNote: true,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Cherry blossoms');
	});
});

describe('EntityList events', () => {
	it('emits toggle with the item id and the new done value', async () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('toggle')).toEqual([['a', true]]);
	});

	it('emits open with the clicked item', async () => {
		const dream = makeDream({ id: 'a' });
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [dream],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('.v-list-item').trigger('click');

		expect(wrapper.emitted('open')).toEqual([[dream]]);
	});
});
