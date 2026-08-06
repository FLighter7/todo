/**
 * Asks the browser to keep this origin's storage out of automatic eviction.
 * Refusal is a normal outcome, not an error: the decision is the browser's.
 */
export async function requestPersistentStorage(): Promise<boolean> {
	const storage = navigator.storage;
	if (!storage?.persist || !storage.persisted) {
		return false;
	}

	try {
		if (await storage.persisted()) {
			return true;
		}

		return await storage.persist();
	} catch {
		return false;
	}
}
