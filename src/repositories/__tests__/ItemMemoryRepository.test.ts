import { describe, expect, it } from 'vitest';
import { ItemType, Status, type Dream } from '@/types';
import { ItemMemoryRepository } from '../ItemMemoryRepository';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
		id: 'id-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('ItemMemoryRepository', () => {
	it('starts empty', async () => {
		await expect(new ItemMemoryRepository<Dream>().getAll()).resolves.toEqual([]);
	});

	it('returns what it was seeded with', async () => {
		const repository = new ItemMemoryRepository([makeDream()]);

		await expect(repository.getAll()).resolves.toEqual([makeDream()]);
	});

	it('replaces a record with the same id', async () => {
		const repository = new ItemMemoryRepository([makeDream()]);

		await repository.put(makeDream({ name: 'Renamed' }));

		const all = await repository.getAll();
		expect(all).toHaveLength(1);
		expect(all[0].name).toBe('Renamed');
	});

	it('removes by id and clears everything', async () => {
		const repository = new ItemMemoryRepository([makeDream(), makeDream({ id: 'id-2' })]);

		await repository.remove('id-1');
		await expect(repository.getAll()).resolves.toHaveLength(1);

		await repository.clear();
		await expect(repository.getAll()).resolves.toEqual([]);
	});

	it('hands out copies so callers cannot mutate its state', async () => {
		const repository = new ItemMemoryRepository([makeDream()]);

		const [first] = await repository.getAll();
		first.name = 'Mutated';

		const [second] = await repository.getAll();
		expect(second.name).toBe('Visit Japan');
	});
});
