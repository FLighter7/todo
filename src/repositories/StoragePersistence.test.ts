import { afterEach, describe, expect, it, vi } from 'vitest';
import { StoragePersistence } from './StoragePersistence';

const original = globalThis.navigator;

afterEach(() => {
	Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true });
});

function stubNavigator(storage: unknown): void {
	Object.defineProperty(globalThis, 'navigator', {
		value: { storage },
		configurable: true,
	});
}

describe('StoragePersistence', () => {
	it('returns true when the browser grants persistence', async () => {
		stubNavigator({ persisted: async () => false, persist: async () => true });

		await expect(new StoragePersistence().request()).resolves.toBe(true);
	});

	it('returns false when the browser refuses', async () => {
		stubNavigator({ persisted: async () => false, persist: async () => false });

		await expect(new StoragePersistence().request()).resolves.toBe(false);
	});

	it('does not ask again when storage is already persistent', async () => {
		const persist = vi.fn(async () => true);
		stubNavigator({ persisted: async () => true, persist });

		await expect(new StoragePersistence().request()).resolves.toBe(true);
		expect(persist).not.toHaveBeenCalled();
	});

	it('returns false when the api is missing', async () => {
		stubNavigator(undefined);

		await expect(new StoragePersistence().request()).resolves.toBe(false);
	});

	it('returns false instead of throwing when the api rejects', async () => {
		stubNavigator({
			persisted: async () => false,
			persist: async () => {
				throw new Error('denied');
			},
		});

		await expect(new StoragePersistence().request()).resolves.toBe(false);
	});
});
