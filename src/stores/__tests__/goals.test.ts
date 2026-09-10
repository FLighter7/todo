// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Goal } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useGoalsStore } from '../goals';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: daysAgo(1),
		updated: daysAgo(1),
		status: Status.Opened,
		...overrides,
	};
}

function daysAgo(days: number): string {
	return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('useGoalsStore groupedByDream', () => {
	it('puts a dreamless goal in the ungrouped tail', async () => {
		const store = useGoalsStore();
		await store.load(async () => new EntityMemoryRepository([makeGoal({ id: 'a' })]));

		expect(store.groupedByDream.active.groups).toEqual([]);
		expect(store.groupedByDream.active.ungrouped.map((g) => g.id)).toEqual(['a']);
	});

	it('groups multiple goals under the same dream together', async () => {
		const store = useGoalsStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'a', dreamId: 'dream-1' }),
					makeGoal({ id: 'b', dreamId: 'dream-1' }),
					makeGoal({ id: 'c', dreamId: 'dream-2' }),
				]),
		);

		const groups = store.groupedByDream.active.groups;
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.dreamId === 'dream-1')?.items.map((g) => g.id)).toEqual(['a', 'b']);
		expect(groups.find((g) => g.dreamId === 'dream-2')?.items.map((g) => g.id)).toEqual(['c']);
	});

	it('groups a goal by dreamId regardless of the dream record itself -- the getter never reads Dream data', async () => {
		const store = useGoalsStore();
		await store.load(
			async () => new EntityMemoryRepository([makeGoal({ id: 'a', dreamId: 'closed-dream' })]),
		);

		expect(store.groupedByDream.active.groups).toEqual([
			{ dreamId: 'closed-dream', items: [store.records[0]] },
		]);
	});

	it('groups active and closed goals separately, for the Active and History tabs', async () => {
		const store = useGoalsStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'a', dreamId: 'dream-1', status: Status.Opened }),
					makeGoal({ id: 'b', dreamId: 'dream-1', status: Status.Done }),
				]),
		);

		expect(store.groupedByDream.active.groups[0].items.map((g) => g.id)).toEqual(['a']);
		expect(store.groupedByDream.closed.groups[0].items.map((g) => g.id)).toEqual(['b']);
	});
});
