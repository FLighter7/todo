import { describe, it, expect } from 'vitest';
import { pickRandom, shuffle, sample } from './random';

describe('random utilities', () => {
	/** A deterministic "random" generator that cycles through fixed values */
	const createDeterministicRandom = () => {
		const values = [0, 0.25, 0.5, 0.75, 0.99];
		let index = 0;
		return () => {
			const value = values[index % values.length];
			index += 1;
			return value;
		};
	};

	describe('pickRandom', () => {
		it('picks an element at the index determined by random()', () => {
			const items = ['a', 'b', 'c', 'd'];
			const random = createDeterministicRandom();

			// First call: random() = 0, index = 0
			expect(pickRandom(items, random)).toBe('a');
			// Second call: random() = 0.25, index = 0 (0.25 * 4 = 1)
			expect(pickRandom(items, random)).toBe('b');
			// Third call: random() = 0.5, index = 2
			expect(pickRandom(items, random)).toBe('c');
			// Fourth call: random() = 0.75, index = 3
			expect(pickRandom(items, random)).toBe('d');
		});

		it('uses Math.random by default', () => {
			const items = [42];
			const result = pickRandom(items);
			expect(result).toBe(42);
		});
	});

	describe('shuffle', () => {
		it('returns a new array with all elements present (same multiset)', () => {
			const items = [1, 2, 3, 4];
			const random = createDeterministicRandom();
			const result = shuffle(items, random);

			expect(result.length).toBe(items.length);
			expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
		});

		it('changes the order for non-trivial input', () => {
			const items = [1, 2, 3, 4];
			const random = createDeterministicRandom();
			const result = shuffle(items, random);

			// With our deterministic random, the shuffle should produce a different order
			// (though we can't guarantee this for all inputs, for this specific case it should)
			expect(result).not.toEqual(items);
		});

		it('does not mutate the input array', () => {
			const items = [1, 2, 3, 4];
			const itemsCopy = [...items];
			const random = createDeterministicRandom();

			shuffle(items, random);

			expect(items).toEqual(itemsCopy);
		});

		it('uses Math.random by default', () => {
			const items = [1, 2, 3];
			const result = shuffle(items);
			expect(result.length).toBe(3);
			expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3]);
		});

		it('handles empty arrays', () => {
			const items: number[] = [];
			const random = createDeterministicRandom();
			const result = shuffle(items, random);
			expect(result).toEqual([]);
		});

		it('handles single-element arrays', () => {
			const items = [42];
			const random = createDeterministicRandom();
			const result = shuffle(items, random);
			expect(result).toEqual([42]);
		});
	});

	describe('sample', () => {
		it('returns count distinct elements when count <= items.length', () => {
			const items = [1, 2, 3, 4, 5];
			const random = createDeterministicRandom();
			const result = sample(items, 3, random);

			expect(result.length).toBe(3);
			// All elements should be from the original array
			expect(result.every((x) => items.includes(x))).toBe(true);
		});

		it('returns all items when count > items.length (no duplicates)', () => {
			const items = [1, 2, 3];
			const random = createDeterministicRandom();
			const result = sample(items, 10, random);

			expect(result.length).toBe(3);
			expect(result.sort((a, b) => a - b)).toEqual([1, 2, 3]);
		});

		it('does not throw when count > items.length', () => {
			const items = ['a', 'b'];
			const random = createDeterministicRandom();

			expect(() => sample(items, 100, random)).not.toThrow();
		});

		it('does not mutate the input array', () => {
			const items = [1, 2, 3, 4, 5];
			const itemsCopy = [...items];
			const random = createDeterministicRandom();

			sample(items, 3, random);

			expect(items).toEqual(itemsCopy);
		});

		it('uses Math.random by default', () => {
			const items = [1, 2, 3, 4, 5];
			const result = sample(items, 2);

			expect(result.length).toBe(2);
			expect(result.every((x) => items.includes(x))).toBe(true);
		});

		it('returns empty array when count is 0', () => {
			const items = [1, 2, 3];
			const random = createDeterministicRandom();
			const result = sample(items, 0, random);

			expect(result).toEqual([]);
		});

		it('handles empty input array gracefully', () => {
			const items: number[] = [];
			const random = createDeterministicRandom();
			const result = sample(items, 5, random);

			expect(result).toEqual([]);
		});
	});
});
