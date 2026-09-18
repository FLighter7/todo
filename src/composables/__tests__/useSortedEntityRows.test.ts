// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { computed, defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { Status, type Dream } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import type { EntityGroup, EntityRow } from '@/utils/sortEntities';
import { useSortedEntityRows } from '../useSortedEntityRows';

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

function useComposableInSetup<T>(setup: () => T): T {
	let result: T;
	const TestComponent = defineComponent({
		setup() {
			result = setup();
			return {};
		},
		template: '<div />',
	});

	mount(TestComponent, { global: { plugins: [i18n] } });
	return result!;
}

function ids(rows: EntityRow<Dream>[]): Array<string | null> {
	return rows.map((row) => (row.type === 'item' ? row.item.id : null));
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

describe('useSortedEntityRows', () => {
	it('sorts by the settings entity\'s current sortOrder', () => {
		const older = makeDream({ id: 'older', updated: '2026-08-01T00:00:00.000Z' });
		const newer = makeDream({ id: 'newer', updated: '2026-08-10T00:00:00.000Z' });
		const groups = computed<EntityGroup<Dream>[]>(() => []);
		const ungrouped = computed(() => [older, newer]);

		const rows = useComposableInSetup(() => useSortedEntityRows(groups, ungrouped, 'dreams'));

		expect(ids(rows.value)).toEqual(['newer', 'older']);
	});

	it('reacts to a sortOrder change on the settings store', () => {
		const older = makeDream({ id: 'older', updated: '2026-08-01T00:00:00.000Z' });
		const newer = makeDream({ id: 'newer', updated: '2026-08-10T00:00:00.000Z' });
		const groups = computed<EntityGroup<Dream>[]>(() => []);
		const ungrouped = computed(() => [older, newer]);

		const rows = useComposableInSetup(() => useSortedEntityRows(groups, ungrouped, 'dreams'));
		useSettingsStore().updatePageSettings('dreams', { sortOrder: 'oldest' });

		expect(ids(rows.value)).toEqual(['older', 'newer']);
	});

	it('reads the sortOrder for the given page independently of the others', () => {
		const older = makeDream({ id: 'older', updated: '2026-08-01T00:00:00.000Z' });
		const newer = makeDream({ id: 'newer', updated: '2026-08-10T00:00:00.000Z' });
		const groups = computed<EntityGroup<Dream>[]>(() => []);
		const ungrouped = computed(() => [older, newer]);

		const rows = useComposableInSetup(() => useSortedEntityRows(groups, ungrouped, 'tasks'));
		useSettingsStore().updatePageSettings('dreams', { sortOrder: 'oldest' });

		expect(ids(rows.value)).toEqual(['newer', 'older']);
	});
});
