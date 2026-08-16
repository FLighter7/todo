import { ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * `persistent` and `lastError` belong to storage as a whole, not to any one
 * entity. Three entity stores each carrying their own copy would make the
 * layout's warning depend on which store happened to fail last.
 */
export const useStorageStore = defineStore('storage', () => {
	const persistent = ref(true);
	const lastError = ref<string | null>(null);

	function noteAvailable(): void {
		persistent.value = true;
	}

	function noteUnavailable(): void {
		persistent.value = false;
	}

	function noteWriteFailure(): void {
		lastError.value = 'storage.writeFailed';
	}

	function noteLoadSkipped(count: number): void {
		if (count > 0) {
			lastError.value = 'storage.recordsSkipped';
		}
	}

	function dismissError(): void {
		lastError.value = null;
	}

	return {
		persistent,
		lastError,
		noteAvailable,
		noteUnavailable,
		noteWriteFailure,
		noteLoadSkipped,
		dismissError,
	};
});
