import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import type { Todo, TodoPeriod } from '@/types/todo';
import type { TodoStorage } from '@/services/storage/types';
import { createInMemoryStorage } from '@/services/storage/in-memory';
import { createIndexedDbStorage } from '@/services/storage/indexed-db';

export interface TodoDraft {
	title: string;
	note?: string;
	period: TodoPeriod;
	important: boolean;
	urgent: boolean;
}

export type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

export const QUADRANT_KEYS: readonly QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function quadrantOf(todo: Todo): QuadrantKey {
	if (todo.important) {
		return todo.urgent ? 'do' : 'schedule';
	}

	return todo.urgent ? 'delegate' : 'eliminate';
}

export function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean } {
	return {
		important: key === 'do' || key === 'schedule',
		urgent: key === 'do' || key === 'delegate',
	};
}

type StorageFactory = () => Promise<TodoStorage>;

export const useTodosStore = defineStore('todos', () => {
	/** Everything in storage, tombstones included. Sync needs those. */
	const records = ref<Todo[]>([]);
	const loading = ref(false);
	const persistent = ref(true);
	const lastError = ref<string | null>(null);

	/** What the user sees. Views never deal with tombstones. */
	const items = computed(() => records.value.filter((todo) => !todo.deleted));

	let storage: TodoStorage = createInMemoryStorage();

	async function persist(write: () => Promise<void>): Promise<void> {
		try {
			await write();
		} catch {
			lastError.value = 'storage.writeFailed';
		}
	}

	async function load(createStorage: StorageFactory = createIndexedDbStorage): Promise<void> {
		loading.value = true;

		try {
			storage = await createStorage();
			persistent.value = true;
		} catch {
			storage = createInMemoryStorage();
			persistent.value = false;
		}

		records.value = await storage.getAll();
		loading.value = false;
	}

	async function add(draft: TodoDraft): Promise<Todo> {
		const now = new Date().toISOString();
		const todo: Todo = {
			id: crypto.randomUUID(),
			title: draft.title,
			note: draft.note,
			created: now,
			updated: now,
			period: draft.period,
			important: draft.important,
			urgent: draft.urgent,
			done: false,
			deleted: false,
		};

		records.value.push(todo);
		await persist(() => storage.put(todo));

		return todo;
	}

	async function update(id: string, patch: Partial<Omit<Todo, 'id'>>): Promise<void> {
		const index = records.value.findIndex((item) => item.id === id);
		if (index === -1) {
			return;
		}

		const updated: Todo = {
			...records.value[index],
			...patch,
			updated: new Date().toISOString(),
		};
		records.value[index] = updated;
		await persist(() => storage.put(updated));
	}

	async function toggleDone(id: string): Promise<void> {
		const todo = records.value.find((item) => item.id === id);
		if (!todo || todo.deleted) {
			return;
		}

		await update(id, { done: !todo.done });
	}

	/**
	 * Soft delete. The record stays as a tombstone: without it a merge could
	 * not tell "deleted here" from "not created yet", and the other device
	 * would hand the task straight back.
	 */
	async function remove(id: string): Promise<void> {
		await update(id, { deleted: true });
	}

	/** Replaces the whole list, e.g. when restoring a backup file. */
	async function replaceAll(todos: Todo[]): Promise<void> {
		// Keep plain copies to write: reading them back out of items.value would
		// yield Vue's reactive proxies, which IndexedDB cannot structured-clone.
		const copies = todos.map((todo) => ({ ...todo }));
		records.value = copies;

		await persist(async () => {
			await storage.clear();
			for (const todo of copies) {
				await storage.put(todo);
			}
		});
	}

	function dismissError(): void {
		lastError.value = null;
	}

	const quadrants = computed<Record<QuadrantKey, Todo[]>>(() => {
		const groups: Record<QuadrantKey, Todo[]> = {
			do: [],
			schedule: [],
			delegate: [],
			eliminate: [],
		};

		for (const todo of items.value) {
			groups[quadrantOf(todo)].push(todo);
		}

		return groups;
	});

	return {
		records,
		items,
		loading,
		persistent,
		lastError,
		quadrants,
		load,
		add,
		update,
		toggleDone,
		remove,
		replaceAll,
		dismissError,
	};
});
