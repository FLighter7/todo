// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Status, type Dream } from '@/types';
import type { EntityRow } from '@/utils/sortEntities';
import EntityList from '../EntityList.vue';

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

function itemRow(dream: Dream): EntityRow<Dream> {
	return { type: 'item', item: dream };
}

function groupRow(key: string, label: string, items: Dream[]): EntityRow<Dream> {
	return { type: 'group', group: { key, label, items } };
}

describe('EntityList empty state', () => {
	it('shows the empty text when there is nothing to render', () => {
		const wrapper = mount(EntityList, {
			props: { rows: [], emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Nothing here yet.');
	});
});

describe('EntityList grouped rendering', () => {
	it('renders a group row with its label and items', () => {
		const rows: EntityRow<Dream>[] = [
			groupRow('dream-1', 'Visit Japan', [makeDream({ id: 'g1', name: 'Learn Japanese' })]),
			itemRow(makeDream({ id: 'g2', name: 'Read more' })),
		];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Read more');
	});

	it('renders item rows with no group wrapper when there are no group rows', () => {
		const rows: EntityRow<Dream>[] = [itemRow(makeDream({ id: 'a', name: 'Visit Japan' }))];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Visit Japan');
	});

	it('renders rows in the given order, interleaving groups and items', () => {
		const rows: EntityRow<Dream>[] = [
			itemRow(makeDream({ id: 'first', name: 'First item' })),
			groupRow('mid-group', 'Middle group', [makeDream({ id: 'mid', name: 'Middle item' })]),
			itemRow(makeDream({ id: 'last', name: 'Last item' })),
		];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		const titles = wrapper.findAll('.v-list-item-title').map((title) => title.text());
		expect(titles).toEqual(['First item', 'Middle item', 'Last item']);
	});
});

describe('EntityList note visibility', () => {
	it('hides the note when showNote is false', () => {
		const rows: EntityRow<Dream>[] = [itemRow(makeDream({ id: 'a', note: 'Cherry blossoms' }))];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).not.toContain('Cherry blossoms');
	});

	it('shows the note when showNote is true', () => {
		const rows: EntityRow<Dream>[] = [itemRow(makeDream({ id: 'a', note: 'Cherry blossoms' }))];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: true },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Cherry blossoms');
	});

	it('hides the note for items inside a group when showNote is false', () => {
		const rows: EntityRow<Dream>[] = [
			groupRow('g1', 'A goal', [makeDream({ id: 'a', note: 'Cherry blossoms' })]),
		];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).not.toContain('Cherry blossoms');
	});
});

describe('EntityList events', () => {
	it('emits toggle with the item id and the new done value', async () => {
		const rows: EntityRow<Dream>[] = [itemRow(makeDream({ id: 'a' }))];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('toggle')).toEqual([['a', true]]);
	});

	it('emits open with the clicked item', async () => {
		const dream = makeDream({ id: 'a' });
		const wrapper = mount(EntityList, {
			props: { rows: [itemRow(dream)], emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('.v-list-item').trigger('click');

		expect(wrapper.emitted('open')).toEqual([[dream]]);
	});

	it('emits toggle and open for an item rendered inside a group', async () => {
		const dream = makeDream({ id: 'a' });
		const wrapper = mount(EntityList, {
			props: { rows: [groupRow('g1', 'A goal', [dream])], emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('.v-list-item').trigger('click');

		expect(wrapper.emitted('toggle')).toEqual([['a', true]]);
		expect(wrapper.emitted('open')).toEqual([[dream]]);
	});
});

describe('EntityList date label', () => {
	it('passes the formatted date through to each item when dateLabel is provided', () => {
		const rows: EntityRow<Dream>[] = [itemRow(makeDream({ id: 'a', name: 'Visit Japan' }))];
		const wrapper = mount(EntityList, {
			props: {
				rows,
				emptyText: 'Nothing here yet.',
				showNote: false,
				dateLabel: () => 'March 2027',
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('March 2027');
	});

	it('shows nothing extra when dateLabel is omitted', () => {
		const rows: EntityRow<Dream>[] = [itemRow(makeDream({ id: 'a' }))];
		const wrapper = mount(EntityList, {
			props: { rows, emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('.text-body-small').exists()).toBe(false);
	});
});
