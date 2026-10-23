// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ItemType, Status, type Goal } from '@/types';
import { ItemMemoryRepository } from '@/repositories/ItemMemoryRepository';
import { useGoalsStore } from '../goals';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		type: ItemType.Goal,
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

describe('useGoalsStore goalsByDream', () => {
	it('puts a dreamless goal in the loose tail', async () => {
		const store = useGoalsStore();
		await store.load(async () => new ItemMemoryRepository([makeGoal({ id: 'a' })]));

		expect(store.goalsByDream.active.sections).toEqual([]);
		expect(store.goalsByDream.active.loose.map((g) => g.id)).toEqual(['a']);
	});

	it('groups multiple goals under the same dream together', async () => {
		const store = useGoalsStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([
					makeGoal({ id: 'a', dreamId: 'dream-1' }),
					makeGoal({ id: 'b', dreamId: 'dream-1' }),
					makeGoal({ id: 'c', dreamId: 'dream-2' }),
				]),
		);

		const groups = store.goalsByDream.active.sections;
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.parentId === 'dream-1')?.items.map((g) => g.id)).toEqual([
			'a',
			'b',
		]);
		expect(groups.find((g) => g.parentId === 'dream-2')?.items.map((g) => g.id)).toEqual(['c']);
	});

	it('groups a goal by dreamId regardless of the dream record itself -- the getter never reads Dream data', async () => {
		const store = useGoalsStore();
		await store.load(
			async () => new ItemMemoryRepository([makeGoal({ id: 'a', dreamId: 'closed-dream' })]),
		);

		expect(store.goalsByDream.active.sections).toEqual([
			{ parentId: 'closed-dream', items: [store.records[0]] },
		]);
	});

	it('groups active and closed goals separately, for the Active and History tabs', async () => {
		const store = useGoalsStore();
		await store.load(
			async () =>
				new ItemMemoryRepository([
					makeGoal({ id: 'a', dreamId: 'dream-1', status: Status.Opened }),
					makeGoal({ id: 'b', dreamId: 'dream-1', status: Status.Done }),
				]),
		);

		expect(store.goalsByDream.active.sections[0].items.map((g) => g.id)).toEqual(['a']);
		expect(store.goalsByDream.closed.sections[0].items.map((g) => g.id)).toEqual(['b']);
	});
});
