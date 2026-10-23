import { describe, expect, it } from 'vitest';
import { ItemFormatError, ItemType, Status } from '../item';
import { isDream, isGoal, isGroup, isTask, parseItem, type Item } from '../itemUnion';

function makeRaw(type: ItemType, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: `id-${type}`,
		type,
		name: 'Something',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...(type === ItemType.Task ? { important: false, urgent: false } : {}),
		...overrides,
	};
}

describe('parseItem', () => {
	it('reads each type with its own parser', () => {
		expect(parseItem(makeRaw(ItemType.Task)).type).toBe(ItemType.Task);
		expect(parseItem(makeRaw(ItemType.Group)).type).toBe(ItemType.Group);
		expect(parseItem(makeRaw(ItemType.Goal, { dreamId: 'dream-1' }))).toMatchObject({
			type: ItemType.Goal,
			dreamId: 'dream-1',
		});
		expect(parseItem(makeRaw(ItemType.Dream)).type).toBe(ItemType.Dream);
	});

	it('applies the per-type rules, not just the shared ones', () => {
		expect(() => parseItem(makeRaw(ItemType.Task, { important: 'yes' }))).toThrow(ItemFormatError);
	});

	it('rejects an unknown or missing type', () => {
		expect(() => parseItem(makeRaw(ItemType.Dream, { type: 5 }))).toThrow(ItemFormatError);
		expect(() => parseItem(makeRaw(ItemType.Dream, { type: 'Dream' }))).toThrow(ItemFormatError);
		expect(() => parseItem(makeRaw(ItemType.Dream, { type: undefined }))).toThrow(ItemFormatError);
	});

	it('rejects a value that is not an object', () => {
		expect(() => parseItem(null)).toThrow(ItemFormatError);
		expect(() => parseItem([])).toThrow(ItemFormatError);
	});

	it('drops fields that do not belong to the type', () => {
		const parsed = parseItem(makeRaw(ItemType.Dream, { important: true, goalId: 'goal-1' }));

		expect(parsed).not.toHaveProperty('important');
		expect(parsed).not.toHaveProperty('goalId');
	});
});

describe('type guards', () => {
	it('tell each type apart', () => {
		const items = [ItemType.Task, ItemType.Group, ItemType.Goal, ItemType.Dream].map((type) =>
			parseItem(makeRaw(type)),
		);
		const kinds = (guard: (item: Item) => boolean) => items.filter(guard).map((item) => item.type);

		expect(kinds(isTask)).toEqual([ItemType.Task]);
		expect(kinds(isGroup)).toEqual([ItemType.Group]);
		expect(kinds(isGoal)).toEqual([ItemType.Goal]);
		expect(kinds(isDream)).toEqual([ItemType.Dream]);
	});
});
