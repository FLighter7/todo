/**
 * Pick a random element from an array.
 *
 * The `random` parameter allows injection of a custom RNG for testing.
 */
export function pickRandom<T>(items: readonly T[], random: () => number = Math.random): T {
	return items[Math.floor(random() * items.length)];
}

/**
 * Shuffle an array in-place using Fisher-Yates, returning a new copy.
 *
 * Does not mutate the input array. The `random` parameter allows injection
 * of a custom RNG for testing.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(random() * (i + 1));
		[copy[i], copy[j]] = [copy[j], copy[i]];
	}
	return copy;
}

/**
 * Sample a random subset of distinct items from an array.
 *
 * Never throws if `count` exceeds `items.length` — returns however many
 * distinct items exist, so a content pool that shrinks below what a caller
 * needs degrades to fewer/duplicate picks rather than crashing.
 *
 * Does not mutate the input array. The `random` parameter allows injection
 * of a custom RNG for testing.
 */
export function sample<T>(
	items: readonly T[],
	count: number,
	random: () => number = Math.random,
): T[] {
	return shuffle(items, random).slice(0, Math.min(count, items.length));
}
