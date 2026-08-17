# Stage 6, Stage 4 — Tasks Page & Unified Add Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the tasks page off `v-data-table` onto the shared `EntityList` primitives (Active/History tabs, task-under-goal grouping), give tasks a `goalId` picker and an `EntityDialog`-based `TaskDialog`, replace `QuickAddFab`'s three per-route dialogs with one tabbed `AddEntityDialog`, and rename `/list` to `/tasks` — while extracting the Done/Reopen confirm logic duplicated across `DreamList.vue`/`GoalList.vue` into a shared composable before a third copy is written for tasks.

**Architecture:** `TaskList.vue` (in a new `TasksPage` folder, mirroring `DreamsPage`/`GoalsPage`) replaces `TasksTable.vue`/`TodoListPage.vue`, built the same way `GoalList.vue` is: `EntityList` for rendering, a new `groupedByGoal` getter on the tasks store (mirroring `groupedByDream` on the goals store) for grouping, and a new `useToggleConfirm` composable (mirroring `useCascadeCancel`'s shape) for the Done/Reopen confirm flow — consumed by `DreamList.vue`/`GoalList.vue` too, retiring their duplicated inline logic. `TaskForm.vue` is replaced by `TaskDialog.vue`, an `EntityDialog` wrapper matching `DreamDialog.vue`/`GoalDialog.vue`, consumed by `TaskList.vue`, the new `AddEntityDialog.vue` (a standalone tabbed dialog replacing `QuickAddFab`'s three conditional dialogs), and `MatrixBoard.vue` (which opens a task-add dialog directly, independent of `QuickAddFab`). Tasks have no descendants, so cascading cancel doesn't apply to them — `TaskDialog`'s "Cancel this record" action closes the task immediately, no `ConfirmDialog` involved.

**Tech Stack:** Vite 8 (Rolldown), Vue 3.5 (generic `<script setup>` components), TypeScript, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4 (`happy-dom` per-file via `// @vitest-environment happy-dom` wherever a component is mounted or `localStorage` is touched), `@vue/test-utils`, SCSS modules.

**Spec:** [docs/superpowers/specs/2026-08-17-stage-4-tasks-page-design.md](../specs/2026-08-17-stage-4-tasks-page-design.md)

## Global Constraints

- SFC section order is **style → template → script**, enforced by ESLint's `vue/block-order`. Omit the `<style>` block entirely on files that need no custom CSS. Always `<script setup lang="ts">`.
- Formatting: tabs (`useTabs: true`, `tabWidth: 2`), single quotes, `printWidth: 100`, trailing commas everywhere (`.prettierrc.json`). Run `npm run format` if unsure.
- Imports inside `src` use the `@/` alias; a relative import is only for a sibling in the same page folder (e.g. `TaskQuadrant.vue` from `MatrixBoard.vue`).
- `src/components/` (shared) and page-local `containers/` (page business logic) follow the existing split: components get props/emits only, no store or service calls; containers own store access. `TaskDialog.vue`/`AddEntityDialog.vue` belong in `src/components/` and must not call `useXStore()`.
- No barrel `index.ts` for `components/`, `containers/`, or `pages/` — every component/container is imported by its own file path.
- Every file is English except `src/i18n/locales/ru.json` and `src/i18n/locales/pl.json`. New i18n keys need all three locale files updated in the same step.
- Default to no comments; add one only where the _why_ isn't obvious from the code.
- Don't add a `deadline` field, recurrence UI, or completion-history UI anywhere in this stage — out of scope per the spec.
- Don't add cascading cancel for tasks — they're leaves, with no descendants to count. `TaskDialog`'s cancel action goes straight to `tasks.close(id, Status.Cancelled)`, no `ConfirmDialog`.
- Don't add `important`/`urgent` indicators to `EntityListItem`/`EntityList` — they stay visible only in the Matrix page and in a task's own detail dialog, per the spec's explicit decision.
- Leave `form.edit` and `task.cancel` in the locale files even once their last caller (`TaskForm.vue`/`TasksTable.vue`) is deleted — dead-key cleanup is out of scope; don't chase it.
- No manual browser verification in this stage — deferred to the end of stage 6, per the user's standing preference. Every task's "done" bar is `npx vitest run <file>` (or the full `npm test`) passing, plus `npm run lint` and `npm run build` clean by the final task.
- Do not merge to `main`, push, or add a git remote — stay on `stage-6-dreams-goals-tasks` and commit locally only.

---

## File Structure

New files:

- `src/composables/useToggleConfirm.ts` (+ `.test.ts`) — Done/Reopen confirm counting and gating, shared by all three page containers.
- `src/components/TaskDialog.vue` (+ `.test.ts`) — `EntityDialog` wrapping name/note/important/urgent/goal-picker, replacing `TaskForm.vue`.
- `src/components/AddEntityDialog.vue` (+ `.test.ts`) — one dialog frame with a Dream/Goal/Task tab strip, replacing `QuickAddFab`'s three conditional dialogs.
- `src/pages/TasksPage/TasksPage.vue` — thin page.
- `src/pages/TasksPage/containers/TaskList.vue` (+ `.test.ts`) — Tasks business logic, including goal grouping.

Modified files: `src/pages/DreamsPage/containers/DreamList.vue` and `src/pages/GoalsPage/containers/GoalList.vue` (onto `useToggleConfirm`), `src/stores/tasks.ts` + `src/stores/tasks.test.ts` (adds `groupedByGoal`), `src/router/index.ts` + `src/router/index.test.ts` (`/list` → `/tasks`), `src/layouts/BottomNav.vue` + `.test.ts`, `src/containers/QuickAddFab.vue` + `.test.ts`, `src/pages/MatrixPage/containers/MatrixBoard.vue` + `.test.ts`, `src/i18n/locales/{en,ru,pl}.json`, `.claude/CLAUDE.md`, `.claude/Architecture.md`.

Deleted files: `src/pages/TodoListPage/TodoListPage.vue`, `src/pages/TodoListPage/containers/TasksTable.vue`, `src/components/TaskForm.vue`, `src/components/TaskForm.test.ts`.

---

### Task 1: `useToggleConfirm` composable

**Files:**

- Create: `src/composables/useToggleConfirm.ts`
- Test: `src/composables/useToggleConfirm.test.ts`

**Interfaces:**

- Consumes: `useSettingsStore()` (existing: `settings[entity].confirmDone/confirmReopen`, `entity` a `SettingsEntity`), `Status` from `@/types`.
- Produces: `interface ToggleableStore<T extends EntityBase> { records: T[]; close(id: string, status: Status.Done | Status.Cancelled): Promise<void>; reopen(id: string): Promise<void> }` and `useToggleConfirm<T extends EntityBase>(store: ToggleableStore<T>, settingsEntity: SettingsEntity, tab: Ref<'active' | 'history'>): { toggleConfirmOpen: Ref<boolean>; toggleConfirmTitle: ComputedRef<string>; toggleConfirmBody: ComputedRef<string>; toggleConfirmActions: ComputedRef<Array<{ key: string; label: string; color?: string }>>; onToggle(id: string): void; onToggleChoice(key: string): Promise<void> }`. Any real entity store (`useDreamsStore()`, `useGoalsStore()`, `useTasksStore()`) already satisfies `ToggleableStore` structurally. Consumed by `DreamList.vue`/`GoalList.vue` (Task 2) and `TaskList.vue` (Task 5).

- [ ] **Step 1: Write the failing test file**

`src/composables/useToggleConfirm.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type EntityBase } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import { useToggleConfirm, type ToggleableStore } from './useToggleConfirm';

function makeRecord(overrides: Partial<EntityBase> = {}): EntityBase {
	return {
		id: 'a',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeStore(records: EntityBase[]): ToggleableStore<EntityBase> {
	return {
		records,
		async close(id, status) {
			const record = records.find((candidate) => candidate.id === id);
			if (record) {
				record.status = status;
			}
		},
		async reopen(id) {
			const record = records.find((candidate) => candidate.id === id);
			if (record) {
				record.status = Status.Opened;
			}
		},
	};
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

describe('useToggleConfirm immediate apply', () => {
	it('marks done immediately when confirmDone is off', () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: false });
		const { onToggle } = useToggleConfirm(store, 'tasks', ref('active'));

		onToggle('a');

		expect(records[0].status).toBe(Status.Done);
	});

	it('reopens immediately when confirmReopen is off, from the History tab', () => {
		const records = [makeRecord({ status: Status.Done })];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmReopen: false });
		const { onToggle } = useToggleConfirm(store, 'tasks', ref('history'));

		onToggle('a');

		expect(records[0].status).toBe(Status.Opened);
	});
});

describe('useToggleConfirm confirmation gate', () => {
	it('opens the confirm dialog instead of applying when confirmDone is on', () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });
		const { onToggle, toggleConfirmOpen, toggleConfirmTitle, toggleConfirmBody } = useToggleConfirm(
			store,
			'tasks',
			ref('active'),
		);

		onToggle('a');

		expect(records[0].status).toBe(Status.Opened);
		expect(toggleConfirmOpen.value).toBe(true);
		expect(toggleConfirmTitle.value).toBe('Mark as done?');
		expect(toggleConfirmBody.value).toBe('Mark "Visit Japan" as done?');
	});

	it('applies the pending toggle when the confirm choice is "yes"', async () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });
		const { onToggle, onToggleChoice } = useToggleConfirm(store, 'tasks', ref('active'));

		onToggle('a');
		await onToggleChoice('yes');

		expect(records[0].status).toBe(Status.Done);
	});

	it('leaves the record untouched when the confirm choice is "no"', async () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });
		const { onToggle, onToggleChoice } = useToggleConfirm(store, 'tasks', ref('active'));

		onToggle('a');
		await onToggleChoice('no');

		expect(records[0].status).toBe(Status.Opened);
	});
});

describe('useToggleConfirm History-tab derivation', () => {
	it('reopens a cancelled record checked in the History tab, not marks it done', () => {
		const records = [makeRecord({ status: Status.Cancelled })];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmReopen: false });
		const { onToggle } = useToggleConfirm(store, 'tasks', ref('history'));

		onToggle('a');

		expect(records[0].status).toBe(Status.Opened);
	});
});

describe('useToggleConfirm unknown id', () => {
	it('does nothing when the id is not found', () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: false });
		const { onToggle, toggleConfirmOpen } = useToggleConfirm(store, 'tasks', ref('active'));

		onToggle('missing');

		expect(records[0].status).toBe(Status.Opened);
		expect(toggleConfirmOpen.value).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/composables/useToggleConfirm.test.ts`
Expected: FAIL — `Failed to resolve import "./useToggleConfirm"`.

- [ ] **Step 3: Implement the composable**

`src/composables/useToggleConfirm.ts`:

```ts
import { computed, ref, type ComputedRef, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type EntityBase } from '@/types';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';

export interface ToggleableStore<T extends EntityBase> {
	records: T[];
	close: (id: string, status: Status.Done | Status.Cancelled) => Promise<void>;
	reopen: (id: string) => Promise<void>;
}

export interface UseToggleConfirm {
	toggleConfirmOpen: Ref<boolean>;
	toggleConfirmTitle: ComputedRef<string>;
	toggleConfirmBody: ComputedRef<string>;
	toggleConfirmActions: ComputedRef<Array<{ key: string; label: string; color?: string }>>;
	onToggle: (id: string) => void;
	onToggleChoice: (key: string) => Promise<void>;
}

/**
 * The Done/Reopen confirm flow shared by every page's list container --
 * `DreamList.vue`, `GoalList.vue`, `TaskList.vue`. `markingDone` is derived
 * from which tab is active, not from the raw boolean `EntityList` emits: a
 * Cancelled record's checkbox reads unchecked, same as a Done one's, so
 * checking it while on the History tab must mean "reopen", never "mark
 * done" -- the bug commit 941ccc5 fixed for Dream/Goal.
 */
export function useToggleConfirm<T extends EntityBase>(
	store: ToggleableStore<T>,
	settingsEntity: SettingsEntity,
	tab: Ref<'active' | 'history'>,
): UseToggleConfirm {
	const settings = useSettingsStore();
	const { t } = useI18n();

	const pendingToggle = ref<{ record: T; done: boolean } | null>(null);
	const toggleConfirmOpen = ref(false);

	const toggleConfirmTitle = computed(() =>
		pendingToggle.value?.done ? t('entity.confirmDoneTitle') : t('entity.confirmReopenTitle'),
	);
	const toggleConfirmBody = computed(() => {
		const pending = pendingToggle.value;
		if (!pending) {
			return '';
		}

		return pending.done
			? t('entity.confirmDoneBody', { name: pending.record.name })
			: t('entity.confirmReopenBody', { name: pending.record.name });
	});
	const toggleConfirmActions = computed(() => [
		{ key: 'no', label: t('form.cancel') },
		{ key: 'yes', label: t('entity.confirm'), color: 'primary' },
	]);

	async function applyToggle(record: T, done: boolean): Promise<void> {
		if (done) {
			await store.close(record.id, Status.Done);
		} else {
			await store.reopen(record.id);
		}
	}

	function onToggle(id: string): void {
		const record = store.records.find((candidate) => candidate.id === id);
		if (!record) {
			return;
		}

		const markingDone = tab.value === 'active';
		const needsConfirm = markingDone
			? settings[settingsEntity].confirmDone
			: settings[settingsEntity].confirmReopen;

		if (!needsConfirm) {
			void applyToggle(record, markingDone);
			return;
		}

		pendingToggle.value = { record, done: markingDone };
		toggleConfirmOpen.value = true;
	}

	async function onToggleChoice(key: string): Promise<void> {
		const pending = pendingToggle.value;
		pendingToggle.value = null;
		if (key !== 'yes' || !pending) {
			return;
		}

		await applyToggle(pending.record, pending.done);
	}

	return {
		toggleConfirmOpen,
		toggleConfirmTitle,
		toggleConfirmBody,
		toggleConfirmActions,
		onToggle,
		onToggleChoice,
	};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/composables/useToggleConfirm.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/composables/useToggleConfirm.ts src/composables/useToggleConfirm.test.ts
git commit -m "feat: add useToggleConfirm composable for the Done/Reopen confirm flow"
```

---

### Task 2: Refactor `DreamList`/`GoalList` onto `useToggleConfirm`

**Files:**

- Modify: `src/pages/DreamsPage/containers/DreamList.vue`
- Modify: `src/pages/GoalsPage/containers/GoalList.vue`

**Interfaces:**

- Consumes: `useToggleConfirm` (Task 1).
- Produces: no change to either container's external behavior or template — `DreamList.test.ts`/`GoalList.test.ts` must pass unmodified. This task is a pure internal refactor, proving the composable is behaviorally identical to the code it replaces before `TaskList.vue` (Task 5) builds on it.

- [ ] **Step 1: Refactor `DreamList.vue`**

In `src/pages/DreamsPage/containers/DreamList.vue`, add the import (right after the `useCascadeCancel` import):

```ts
import { useCascadeCancel } from '@/composables/useCascadeCancel';
```

with:

```ts
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
```

Then replace the whole duplicated block:

```ts
const pendingToggle = ref<{ dream: Dream; done: boolean } | null>(null);
const toggleConfirmOpen = ref(false);

const toggleConfirmTitle = computed(() =>
	pendingToggle.value?.done ? t('entity.confirmDoneTitle') : t('entity.confirmReopenTitle'),
);
const toggleConfirmBody = computed(() => {
	const pending = pendingToggle.value;
	if (!pending) {
		return '';
	}

	return pending.done
		? t('entity.confirmDoneBody', { name: pending.dream.name })
		: t('entity.confirmReopenBody', { name: pending.dream.name });
});
const toggleConfirmActions = computed(() => [
	{ key: 'no', label: t('form.cancel') },
	{ key: 'yes', label: t('entity.confirm'), color: 'primary' },
]);

async function applyToggle(dream: Dream, done: boolean): Promise<void> {
	if (done) {
		await dreams.close(dream.id, Status.Done);
	} else {
		await dreams.reopen(dream.id);
	}
}

function onToggle(id: string): void {
	const dream = dreams.records.find((record) => record.id === id);
	if (!dream) {
		return;
	}

	const markingDone = tab.value === 'active';
	const needsConfirm = markingDone ? settings.dreams.confirmDone : settings.dreams.confirmReopen;
	if (!needsConfirm) {
		void applyToggle(dream, markingDone);
		return;
	}

	pendingToggle.value = { dream, done: markingDone };
	toggleConfirmOpen.value = true;
}

async function onToggleChoice(key: string): Promise<void> {
	const pending = pendingToggle.value;
	pendingToggle.value = null;
	if (key !== 'yes' || !pending) {
		return;
	}

	await applyToggle(pending.dream, pending.done);
}
```

with:

```ts
const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(dreams, 'dreams', tab);
```

The template is untouched — it already binds `toggleConfirmOpen`/`toggleConfirmTitle`/`toggleConfirmBody`/`toggleConfirmActions`/`onToggle`/`onToggleChoice` by the same names.

- [ ] **Step 2: Refactor `GoalList.vue`**

In `src/pages/GoalsPage/containers/GoalList.vue`, add the same import addition (after the `useCascadeCancel` import), then replace the equivalent duplicated block:

```ts
const pendingToggle = ref<{ goal: Goal; done: boolean } | null>(null);
const toggleConfirmOpen = ref(false);

const toggleConfirmTitle = computed(() =>
	pendingToggle.value?.done ? t('entity.confirmDoneTitle') : t('entity.confirmReopenTitle'),
);
const toggleConfirmBody = computed(() => {
	const pending = pendingToggle.value;
	if (!pending) {
		return '';
	}

	return pending.done
		? t('entity.confirmDoneBody', { name: pending.goal.name })
		: t('entity.confirmReopenBody', { name: pending.goal.name });
});
const toggleConfirmActions = computed(() => [
	{ key: 'no', label: t('form.cancel') },
	{ key: 'yes', label: t('entity.confirm'), color: 'primary' },
]);

async function applyToggle(goal: Goal, done: boolean): Promise<void> {
	if (done) {
		await goals.close(goal.id, Status.Done);
	} else {
		await goals.reopen(goal.id);
	}
}

function onToggle(id: string): void {
	const goal = goals.records.find((record) => record.id === id);
	if (!goal) {
		return;
	}

	const markingDone = tab.value === 'active';
	const needsConfirm = markingDone ? settings.goals.confirmDone : settings.goals.confirmReopen;
	if (!needsConfirm) {
		void applyToggle(goal, markingDone);
		return;
	}

	pendingToggle.value = { goal, done: markingDone };
	toggleConfirmOpen.value = true;
}

async function onToggleChoice(key: string): Promise<void> {
	const pending = pendingToggle.value;
	pendingToggle.value = null;
	if (key !== 'yes' || !pending) {
		return;
	}

	await applyToggle(pending.goal, pending.done);
}
```

with:

```ts
const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(goals, 'goals', tab);
```

- [ ] **Step 3: Run both containers' existing test suites to confirm no regression**

Run: `npx vitest run src/pages/DreamsPage/containers/DreamList.test.ts src/pages/GoalsPage/containers/GoalList.test.ts`
Expected: PASS, same test counts as before this task (10 for `DreamList`, 10 for `GoalList`) — no test file was touched.

- [ ] **Step 4: Run the full suite to check nothing else broke**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/DreamsPage/containers/DreamList.vue src/pages/GoalsPage/containers/GoalList.vue
git commit -m "refactor: extract Done/Reopen confirm logic from DreamList/GoalList into useToggleConfirm"
```

---

### Task 3: `groupedByGoal` getter on the tasks store

**Files:**

- Modify: `src/stores/tasks.ts`
- Modify: `src/stores/tasks.test.ts`

**Interfaces:**

- Consumes: nothing new — same `defineEntityStore`/`storeToRefs` composition `quadrants` already uses.
- Produces: `useTasksStore()` keeps its existing surface (`records`, `active`, `closed`, `loading`, `quadrants`, `load`, `add`, `update`, `close`, `reopen`, `replaceAll`) and gains `groupedByGoal: { active: GroupedTasks; closed: GroupedTasks }`, where `interface GoalGroup { goalId: string; items: Task[] }` and `interface GroupedTasks { groups: GoalGroup[]; ungrouped: Task[] }`. Both types are exported from `src/stores/tasks.ts`. `TaskList.vue` (Task 5) consumes `groupedByGoal` and resolves `goalId` to a display name itself.

- [ ] **Step 1: Write the failing test additions**

Append to `src/stores/tasks.test.ts` (after the closing `});` of the last `describe` block, `useTasksStore load pruning`):

```ts

describe('useTasksStore groupedByGoal', () => {
	it('puts a goalless task in the ungrouped tail', async () => {
		const store = useTasksStore();
		await store.load(async () => new EntityMemoryRepository([makeTask({ id: 'a' })]));

		expect(store.groupedByGoal.active.groups).toEqual([]);
		expect(store.groupedByGoal.active.ungrouped.map((t) => t.id)).toEqual(['a']);
	});

	it('groups multiple tasks under the same goal together', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1' }),
					makeTask({ id: 'b', goalId: 'goal-1' }),
					makeTask({ id: 'c', goalId: 'goal-2' }),
				]),
		);

		const groups = store.groupedByGoal.active.groups;
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.goalId === 'goal-1')?.items.map((t) => t.id)).toEqual(['a', 'b']);
		expect(groups.find((g) => g.goalId === 'goal-2')?.items.map((t) => t.id)).toEqual(['c']);
	});

	it('groups a task by goalId regardless of the goal record itself -- the getter never reads Goal data', async () => {
		const store = useTasksStore();
		await store.load(
			async () => new EntityMemoryRepository([makeTask({ id: 'a', goalId: 'closed-goal' })]),
		);

		expect(store.groupedByGoal.active.groups).toEqual([
			{ goalId: 'closed-goal', items: [store.records[0]] },
		]);
	});

	it('groups active and closed tasks separately, for the Active and History tabs', async () => {
		const store = useTasksStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1', status: Status.Opened }),
					makeTask({ id: 'b', goalId: 'goal-1', status: Status.Done }),
				]),
		);

		expect(store.groupedByGoal.active.groups[0].items.map((t) => t.id)).toEqual(['a']);
		expect(store.groupedByGoal.closed.groups[0].items.map((t) => t.id)).toEqual(['b']);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/stores/tasks.test.ts`
Expected: FAIL — `store.groupedByGoal` is `undefined`.

- [ ] **Step 3: Implement the getter**

Replace the full contents of `src/stores/tasks.ts`:

```ts
import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { Status, parseTask, type Schedule, type Task } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { pruneCompletions } from '@/utils';
import { defineEntityStore } from './createEntityStore';

export interface TaskDraft {
	name: string;
	note?: string;
	goalId?: string;
	important: boolean;
	urgent: boolean;
	schedule?: Schedule;
}

export type QuadrantKey = 'do' | 'schedule' | 'delegate' | 'eliminate';

export const QUADRANT_KEYS: readonly QuadrantKey[] = ['do', 'schedule', 'delegate', 'eliminate'];

export function quadrantOf(task: Task): QuadrantKey {
	if (task.important) {
		return task.urgent ? 'do' : 'schedule';
	}

	return task.urgent ? 'delegate' : 'eliminate';
}

export function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean } {
	return {
		important: key === 'do' || key === 'schedule',
		urgent: key === 'do' || key === 'delegate',
	};
}

export interface GoalGroup {
	goalId: string;
	items: Task[];
}

export interface GroupedTasks {
	groups: GoalGroup[];
	ungrouped: Task[];
}

const useBaseTasksStore = defineEntityStore<Task, TaskDraft>({
	id: 'tasks',
	createRepository: () => EntityDbRepository.create('tasks', parseTask),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		goalId: draft.goalId,
		important: draft.important,
		urgent: draft.urgent,
		schedule: draft.schedule,
	}),
	// pruneCompletions always returns a fresh object, by contract — it must never
	// alias its input. The store, though, uses reference identity to tell "nothing
	// to prune" from "rewrite this record", so hand the original back when the
	// marks came through untouched.
	prune: (task, windowDays, now) => {
		const pruned = pruneCompletions(task, windowDays, now);

		return pruned.completions?.length === task.completions?.length ? task : pruned;
	},
});

function groupByGoal(records: Task[]): GroupedTasks {
	const byGoal = new Map<string, Task[]>();
	const ungrouped: Task[] = [];

	for (const task of records) {
		if (task.goalId === undefined) {
			ungrouped.push(task);
			continue;
		}

		const items = byGoal.get(task.goalId) ?? [];
		items.push(task);
		byGoal.set(task.goalId, items);
	}

	return {
		groups: [...byGoal.entries()].map(([goalId, items]) => ({ goalId, items })),
		ungrouped,
	};
}

/**
 * The matrix is a view of the same data, not a separate entity: this getter
 * splits the open tasks by important × urgent. Closed tasks stay out — the
 * matrix is for deciding what to do next.
 *
 * `Object.assign`-ing the base store with `{ quadrants }` type-checks
 * `quadrants` as a raw `ComputedRef` instead of its unwrapped value. A plain
 * `{ ...store, quadrants }` spread — even inside a new `defineStore` setup —
 * fares no better at runtime: a spread just copies each property's current
 * value out once, so nothing behind it stays connected to the source store.
 * Scalars (`loading`) freeze at that value, and so do `records`, `active`
 * and `closed`, despite being arrays — `load()` reassigns `records` outright
 * rather than mutating it in place, and `active`/`closed` are computeds that
 * return a fresh array on every recalculation, so the copied snapshot is
 * already stale. `storeToRefs` is Pinia's documented answer for composing
 * one store from another: it hands back real `Ref`s that stay wired to the
 * source, so every state and getter here keeps updating after the source
 * store changes. Actions are passed through directly — Pinia already binds
 * them to their own store.
 *
 * `groupedByGoal` keys groups by `goalId` only, the same way `groupedByDream`
 * on the goals store keys by `dreamId` only — it never resolves the Goal's
 * name, since that would mean the tasks store importing the goals store,
 * breaking the mutual independence dreams/goals/tasks keep. A caller with
 * access to both stores — a container — resolves `goalId` to a name itself.
 */
export const useTasksStore = defineStore('tasksMatrix', () => {
	const store = useBaseTasksStore();
	const { records, active, closed, loading } = storeToRefs(store);

	const quadrants = computed<Record<QuadrantKey, Task[]>>(() => {
		const groups: Record<QuadrantKey, Task[]> = {
			do: [],
			schedule: [],
			delegate: [],
			eliminate: [],
		};

		for (const task of active.value) {
			groups[quadrantOf(task)].push(task);
		}

		return groups;
	});

	const groupedByGoal = computed<{ active: GroupedTasks; closed: GroupedTasks }>(() => ({
		active: groupByGoal(active.value),
		closed: groupByGoal(closed.value),
	}));

	return {
		records,
		active,
		closed,
		loading,
		quadrants,
		groupedByGoal,
		load: store.load,
		add: store.add,
		update: store.update,
		close: store.close,
		reopen: store.reopen,
		replaceAll: store.replaceAll,
	};
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/stores/tasks.test.ts`
Expected: PASS (17 tests: 13 existing + 4 new).

- [ ] **Step 5: Run the full suite to check nothing else broke**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/tasks.ts src/stores/tasks.test.ts
git commit -m "feat: add groupedByGoal getter to the tasks store"
```

---

### Task 4: `TaskDialog` component

**Files:**

- Create: `src/components/TaskDialog.vue`
- Test: `src/components/TaskDialog.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `EntityDialog` (existing), `TaskDraft` from `@/stores/tasks` (existing: `{ name: string; note?: string; goalId?: string; important: boolean; urgent: boolean; schedule?: Schedule }`).
- Produces: props `{ initial?: Partial<TaskDraft>; mode?: 'add' | 'edit'; goalOptions: Array<{ value: string; title: string }> }` (default `initial: {}`, `mode: 'edit'`), `v-model` boolean, emits `{ save: [draft: TaskDraft]; cancel: [] }`. Validates `name` non-empty before emitting `save`, closes itself on a successful save, re-emits `cancel` unchanged. `schedule` is never read or written by this component in this stage. Consumed by `TaskList.vue` (Task 5), `AddEntityDialog.vue` (Task 8, field markup only — not this component directly), and `MatrixBoard.vue` (Task 10).

- [ ] **Step 1: Write the failing test file**

`src/components/TaskDialog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import TaskDialog from './TaskDialog.vue';

const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];

describe('TaskDialog add mode', () => {
	it('emits a draft including flags and the picked goal', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});

	it('emits goalId undefined when "no goal" stays selected', async () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Buy milk', note: undefined, important: false, urgent: false, goalId: undefined }],
		]);
	});
});

describe('TaskDialog goal picker', () => {
	it('offers "no goal" plus every option passed in', () => {
		const wrapper = mount(TaskDialog, {
			props: { modelValue: true, mode: 'add', goalOptions },
			global: { plugins: [vuetify, i18n] },
		});

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('items')).toEqual([
			{ value: '', title: 'No goal' },
			{ value: 'goal-1', title: 'Learn Japanese' },
		]);
	});

	it('preserves a closed goal that is present only because it is the current selection', async () => {
		const closedOptions = [{ value: 'closed-goal', title: 'Old goal' }];
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: false, urgent: false, goalId: 'closed-goal' },
				goalOptions: closedOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-goal');
	});
});

describe('TaskDialog edit mode', () => {
	it('shows the linked goal name and important/urgent chips in the read-only view', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: true, urgent: false, goalId: 'goal-1' },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Important');
		expect(wrapper.text()).not.toContain('Urgent');
	});

	it('omits the important/urgent chips entirely when both flags are false', () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: false, urgent: false },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.findComponent({ name: 'VChip' }).exists()).toBe(false);
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(TaskDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Buy milk', important: false, urgent: false },
				goalOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/TaskDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./TaskDialog.vue"`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
	"task": {
		"name": "Name",
		"note": "Note",
		"created": "Created",
		"important": "Important",
		"urgent": "Urgent",
		"done": "Done",
		"actions": "Actions",
		"cancel": "Cancel this task"
	},
```

with:

```json
	"task": {
		"name": "Name",
		"note": "Note",
		"created": "Created",
		"important": "Important",
		"urgent": "Urgent",
		"done": "Done",
		"actions": "Actions",
		"cancel": "Cancel this task",
		"title": "Task",
		"goalLabel": "Goal",
		"noGoal": "No goal"
	},
```

In `src/i18n/locales/ru.json`, replace:

```json
	"task": {
		"name": "Название",
		"note": "Описание",
		"created": "Создано",
		"important": "Важное",
		"urgent": "Срочное",
		"done": "Сделано",
		"actions": "Действия",
		"cancel": "Отменить задачу"
	},
```

with:

```json
	"task": {
		"name": "Название",
		"note": "Описание",
		"created": "Создано",
		"important": "Важное",
		"urgent": "Срочное",
		"done": "Сделано",
		"actions": "Действия",
		"cancel": "Отменить задачу",
		"title": "Задача",
		"goalLabel": "Цель",
		"noGoal": "Без цели"
	},
```

In `src/i18n/locales/pl.json`, replace:

```json
	"task": {
		"name": "Nazwa",
		"note": "Opis",
		"created": "Utworzono",
		"important": "Ważne",
		"urgent": "Pilne",
		"done": "Zrobione",
		"actions": "Czynności",
		"cancel": "Anuluj zadanie"
	},
```

with:

```json
	"task": {
		"name": "Nazwa",
		"note": "Opis",
		"created": "Utworzono",
		"important": "Ważne",
		"urgent": "Pilne",
		"done": "Zrobione",
		"actions": "Czynności",
		"cancel": "Anuluj zadanie",
		"title": "Zadanie",
		"goalLabel": "Cel",
		"noGoal": "Bez celu"
	},
```

- [ ] **Step 4: Implement the component**

`src/components/TaskDialog.vue`:

```vue
<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}

.chips {
	display: flex;
	gap: 0.5rem;
	margin-top: 0.5rem;
}
</style>

<template>
	<entity-dialog
		v-model="open"
		:title="t('task.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<template v-if="editing">
				<v-text-field
					v-model="name"
					:label="t('entity.name')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="onSave"
				/>
				<v-textarea v-model="note" :label="t('entity.note')" rows="3" />
				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('task.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('task.urgent')" color="primary" hide-details />
				</div>
				<v-select
					v-model="goalId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('task.goalLabel')"
				/>
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
				<p v-if="goalName" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('task.goalLabel') }}: {{ goalName }}
				</p>
				<div v-if="important || urgent" :class="$style.chips">
					<v-chip v-if="important" size="small" color="primary">{{ t('task.important') }}</v-chip>
					<v-chip v-if="urgent" size="small" color="primary">{{ t('task.urgent') }}</v-chip>
				</div>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import type { TaskDraft } from '@/stores/tasks';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TaskDraft>;
		mode?: 'add' | 'edit';
		goalOptions: Array<{ value: string; title: string }>;
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: TaskDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const important = ref(false);
const urgent = ref(false);
const goalId = ref('');
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

const selectItems = computed(() => [
	{ value: '', title: t('task.noGoal') },
	...props.goalOptions,
]);

const goalName = computed(
	() => selectItems.value.find((item) => item.value === goalId.value)?.title,
);

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.initial.name ?? '';
		note.value = props.initial.note ?? '';
		important.value = props.initial.important ?? false;
		urgent.value = props.initial.urgent ?? false;
		goalId.value = props.initial.goalId ?? '';
		showErrors.value = false;
	},
	{ immediate: true },
);

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('save', {
		name: name.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: important.value,
		urgent: urgent.value,
		goalId: goalId.value === '' ? undefined : goalId.value,
	});
	open.value = false;
}
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/TaskDialog.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskDialog.vue src/components/TaskDialog.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add TaskDialog component with a goalId picker"
```

---

### Task 5: `TasksPage` and `TaskList` container

**Files:**

- Create: `src/pages/TasksPage/TasksPage.vue`
- Create: `src/pages/TasksPage/containers/TaskList.vue`
- Test: `src/pages/TasksPage/containers/TaskList.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

These are new, currently-unreferenced files — the router still points at `TodoListPage`/`TasksTable` until Task 6, so the app keeps building and running throughout this task without anything wired to the new page yet.

**Interfaces:**

- Consumes: `useToggleConfirm()` (Task 1) → `{ toggleConfirmOpen, toggleConfirmTitle, toggleConfirmBody, toggleConfirmActions, onToggle, onToggleChoice }`; `EntityList` (existing); `TaskDialog` (Task 4); `ConfirmDialog` (existing); `useTasksStore()` (Task 3, including `groupedByGoal`); `useGoalsStore()` (existing: `records`, `active`); `useSettingsStore()` (existing: `.tasks: { rows, confirmDone, confirmReopen }`).
- Produces: `TasksPage.vue` renders `<task-list />`. `TaskList.vue` has no props/emits.

- [ ] **Step 1: Write the failing test file**

`src/pages/TasksPage/containers/TaskList.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
import TaskList from './TaskList.vue';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		name: 'Do Duolingo',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

async function mountWithData(goals: Goal[], tasks: Task[]) {
	const goalsStore = useGoalsStore();
	const tasksStore = useTasksStore();
	await goalsStore.load(async () => new EntityMemoryRepository(goals));
	await tasksStore.load(async () => new EntityMemoryRepository(tasks));

	const wrapper = mount(TaskList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, goalsStore, tasksStore };
}

describe('TaskList empty state', () => {
	it('shows the empty message when there are no tasks', async () => {
		const { wrapper } = await mountWithData([], []);

		expect(wrapper.text()).toContain('No tasks yet');
	});
});

describe('TaskList grouping', () => {
	it('groups a task under its goal, using the goal name as the group label', async () => {
		const { wrapper } = await mountWithData([makeGoal()], [makeTask({ goalId: 'goal-1' })]);

		expect(wrapper.find('legend').text()).toBe('Learn Japanese');
		expect(wrapper.text()).toContain('Do Duolingo');
	});

	it('still groups and shows the goal name when the goal itself is closed', async () => {
		const { wrapper } = await mountWithData(
			[makeGoal({ status: Status.Done })],
			[makeTask({ goalId: 'goal-1' })],
		);

		expect(wrapper.find('legend').text()).toBe('Learn Japanese');
	});

	it('puts a goalless task in the ungrouped tail, with no group wrapper', async () => {
		const { wrapper } = await mountWithData([], [makeTask({ id: 't1', name: 'Read more' })]);

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Read more');
	});
});

describe('TaskList goal picker options', () => {
	it('offers only active goals as new choices', async () => {
		const { wrapper } = await mountWithData(
			[
				makeGoal({ id: 'active-goal', name: 'Active goal' }),
				makeGoal({ id: 'closed-goal', name: 'Closed goal', status: Status.Done }),
			],
			[makeTask({ goalId: 'active-goal' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toEqual(['No goal', 'Active goal']);
	});

	it('keeps the currently-linked closed goal as an option when editing that task', async () => {
		const { wrapper } = await mountWithData(
			[makeGoal({ id: 'closed-goal', name: 'Closed goal', status: Status.Cancelled })],
			[makeTask({ goalId: 'closed-goal' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-goal');
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toContain('Closed goal');
	});
});

describe('TaskList cancel', () => {
	it('cancels immediately with no confirm dialog, since tasks have no descendants', async () => {
		const { wrapper, tasksStore } = await mountWithData([], [makeTask()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(tasksStore.records[0].status).toBe(Status.Cancelled);
	});
});

describe('TaskList done / reopen', () => {
	it('marks a task done immediately when confirmDone is off', async () => {
		const { wrapper, tasksStore } = await mountWithData([], [makeTask()]);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: false });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(tasksStore.records[0].status).toBe(Status.Done);
	});

	it('asks for confirmation before marking done when confirmDone is on', async () => {
		const { wrapper, tasksStore } = await mountWithData([], [makeTask()]);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(tasksStore.records[0].status).toBe(Status.Opened);

		await clickButtonByText(wrapper, 'Confirm');

		expect(tasksStore.records[0].status).toBe(Status.Done);
	});
});

describe('TaskList tabs', () => {
	it('switches between Active and History', async () => {
		const { wrapper } = await mountWithData(
			[],
			[
				makeTask({ id: 'open', name: 'Open task' }),
				makeTask({ id: 'done', name: 'Done task', status: Status.Done }),
			],
		);

		expect(wrapper.text()).toContain('Open task');
		expect(wrapper.text()).not.toContain('Done task');

		await clickButtonByText(wrapper, 'History');

		expect(wrapper.text()).not.toContain('Open task');
		expect(wrapper.text()).toContain('Done task');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/TasksPage/containers/TaskList.test.ts`
Expected: FAIL — `Failed to resolve import "./TaskList.vue"`.

- [ ] **Step 3: Add the `task.empty` i18n key**

In `src/i18n/locales/en.json`, replace (the `task` block, as it now reads after Task 4):

```json
		"title": "Task",
		"goalLabel": "Goal",
		"noGoal": "No goal"
	},
```

with:

```json
		"title": "Task",
		"goalLabel": "Goal",
		"noGoal": "No goal",
		"empty": "No tasks yet. Add the first one."
	},
```

In `src/i18n/locales/ru.json`, replace:

```json
		"title": "Задача",
		"goalLabel": "Цель",
		"noGoal": "Без цели"
	},
```

with:

```json
		"title": "Задача",
		"goalLabel": "Цель",
		"noGoal": "Без цели",
		"empty": "Задач пока нет. Заведи первую."
	},
```

In `src/i18n/locales/pl.json`, replace:

```json
		"title": "Zadanie",
		"goalLabel": "Cel",
		"noGoal": "Bez celu"
	},
```

with:

```json
		"title": "Zadanie",
		"goalLabel": "Cel",
		"noGoal": "Bez celu",
		"empty": "Brak zadań. Dodaj pierwsze."
	},
```

- [ ] **Step 4: Implement `TasksPage.vue`**

`src/pages/TasksPage/TasksPage.vue`:

```vue
<template>
	<task-list />
</template>

<script setup lang="ts">
import TaskList from './containers/TaskList.vue';
</script>
```

- [ ] **Step 5: Implement `TaskList.vue`**

`src/pages/TasksPage/containers/TaskList.vue`:

```vue
<template>
	<v-container>
		<v-btn-toggle v-model="tab" mandatory color="primary" class="mb-4">
			<v-btn value="active">{{ t('entity.active') }}</v-btn>
			<v-btn value="history">{{ t('entity.history') }}</v-btn>
		</v-btn-toggle>

		<entity-list
			:groups="groups"
			:ungrouped="ungrouped"
			:empty-text="t('task.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<task-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			:goal-options="goalOptions"
			@save="handleSave"
			@cancel="onCancel"
		/>

		<confirm-dialog
			v-model="toggleConfirmOpen"
			:title="toggleConfirmTitle"
			:body="toggleConfirmBody"
			:actions="toggleConfirmActions"
			@choose="onToggleChoice"
		/>
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type Task } from '@/types';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';
import { useGoalsStore } from '@/stores/goals';
import { useSettingsStore } from '@/stores/settings';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import EntityList from '@/components/EntityList.vue';
import TaskDialog from '@/components/TaskDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const tasks = useTasksStore();
const goals = useGoalsStore();
const settings = useSettingsStore();

const tab = ref<'active' | 'history'>('active');
const showNote = computed(() => settings.tasks.rows === 2);

function labelFor(goalId: string): string {
	return goals.records.find((goal) => goal.id === goalId)?.name ?? '';
}

const activeGrouped = computed(() => tasks.groupedByGoal.active);
const closedGrouped = computed(() => tasks.groupedByGoal.closed);

const groups = computed(() => {
	const source = tab.value === 'active' ? activeGrouped.value : closedGrouped.value;
	return source.groups.map((group) => ({
		key: group.goalId,
		label: labelFor(group.goalId),
		items: group.items,
	}));
});
const ungrouped = computed(
	() => (tab.value === 'active' ? activeGrouped.value : closedGrouped.value).ungrouped,
);

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(tasks, 'tasks', tab);

const dialogOpen = ref(false);
const editing = ref<Task | null>(null);
const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent, goalId } = editing.value;
	return { name, note, important, urgent, goalId };
});

const goalOptions = computed(() => {
	const options = goals.active.map((goal) => ({ value: goal.id, title: goal.name }));
	const currentGoalId = editing.value?.goalId;

	if (currentGoalId !== undefined && !options.some((option) => option.value === currentGoalId)) {
		const closedGoal = goals.records.find((goal) => goal.id === currentGoalId);
		if (closedGoal) {
			options.push({ value: closedGoal.id, title: closedGoal.name });
		}
	}

	return options;
});

function openEdit(task: Task): void {
	editing.value = task;
	dialogOpen.value = true;
}

async function handleSave(draft: TaskDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await tasks.update(editing.value.id, draft);
	editing.value = null;
}

function onCancel(): void {
	const task = editing.value;
	if (!task) {
		return;
	}

	void tasks.close(task.id, Status.Cancelled);
	dialogOpen.value = false;
	editing.value = null;
}
</script>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/pages/TasksPage/containers/TaskList.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 7: Run the full suite and the build to confirm the orphaned new files don't break anything**

Run: `npm test && npm run build`
Expected: PASS. `TasksPage.vue`/`TaskList.vue` compile and type-check even though nothing imports them yet.

- [ ] **Step 8: Commit**

```bash
git add src/pages/TasksPage src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add TasksPage with goal grouping, not yet wired to routing"
```

---

### Task 6: Routing — rename `/list` to `/tasks`, retire `TodoListPage`

**Files:**

- Modify: `src/router/index.ts`
- Modify: `src/router/index.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`
- Delete: `src/pages/TodoListPage/TodoListPage.vue`
- Delete: `src/pages/TodoListPage/containers/TasksTable.vue`

**Interfaces:**

- Consumes: `TasksPage.vue` (Task 5), `getStartPageOptions`/`readStoredStartPage` (existing, unchanged signatures).
- Produces: the route named `list` becomes `tasks` at `/tasks`, rendering `TasksPage` instead of the retired `TodoListPage`. `getStartPageOptions()` now returns `['tasks', 'matrix', 'dreams', 'goals']` — `tasks` stays first, in the same position `list` held, so the fallback start page for a fresh install is unchanged. `BottomNav.vue` (Task 7) and `QuickAddFab.vue` (Task 9) both depend on the `tasks` route name existing.

- [ ] **Step 1: Update the failing test**

Replace the full contents of `src/router/index.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { getStartPageOptions } from './index';

beforeEach(() => {
	window.localStorage.clear();
});

describe('getStartPageOptions', () => {
	it('includes the tasks, matrix, dreams and goals routes, tasks first', () => {
		const values = getStartPageOptions().map((option) => option.value);

		expect(values).toEqual(['tasks', 'matrix', 'dreams', 'goals']);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/router/index.test.ts`
Expected: FAIL — actual is `['list', 'matrix', 'dreams', 'goals']`.

- [ ] **Step 3: Add the new i18n keys and remove the retired ones**

In `src/i18n/locales/en.json`, replace:

```json
	"nav": {
		"dreams": "Dreams",
		"goals": "Goals",
		"list": "List",
		"matrix": "Matrix",
		"settings": "Settings"
	},
```

with:

```json
	"nav": {
		"dreams": "Dreams",
		"goals": "Goals",
		"tasks": "Tasks",
		"matrix": "Matrix",
		"settings": "Settings"
	},
```

and replace:

```json
		"startPage": "Start page",
		"startPageDreams": "Dreams",
		"startPageGoals": "Goals",
		"startPageList": "List",
		"startPageMatrix": "Matrix",
```

with:

```json
		"startPage": "Start page",
		"startPageDreams": "Dreams",
		"startPageGoals": "Goals",
		"startPageTasks": "Tasks",
		"startPageMatrix": "Matrix",
```

and remove the now-unused `list` block entirely:

```json
	"list": {
		"empty": "No tasks yet. Add the first one."
	},
```

(delete this whole block — `task.empty`, added in Task 5, already covers the same text for `TaskList.vue`, and `TasksTable.vue`, the only caller of `list.empty`, is deleted in this task.)

In `src/i18n/locales/ru.json`, replace:

```json
	"nav": {
		"dreams": "Мечты",
		"goals": "Цели",
		"list": "Список",
		"matrix": "Матрица",
		"settings": "Настройки"
	},
```

with:

```json
	"nav": {
		"dreams": "Мечты",
		"goals": "Цели",
		"tasks": "Задачи",
		"matrix": "Матрица",
		"settings": "Настройки"
	},
```

and replace:

```json
		"startPage": "Стартовая страница",
		"startPageDreams": "Мечты",
		"startPageGoals": "Цели",
		"startPageList": "Список",
		"startPageMatrix": "Матрица",
```

with:

```json
		"startPage": "Стартовая страница",
		"startPageDreams": "Мечты",
		"startPageGoals": "Цели",
		"startPageTasks": "Задачи",
		"startPageMatrix": "Матрица",
```

and remove:

```json
	"list": {
		"empty": "Задач пока нет. Заведи первую."
	},
```

In `src/i18n/locales/pl.json`, replace:

```json
	"nav": {
		"dreams": "Marzenia",
		"goals": "Cele",
		"list": "Lista",
		"matrix": "Macierz",
		"settings": "Ustawienia"
	},
```

with:

```json
	"nav": {
		"dreams": "Marzenia",
		"goals": "Cele",
		"tasks": "Zadania",
		"matrix": "Macierz",
		"settings": "Ustawienia"
	},
```

and replace:

```json
		"startPage": "Strona początkowa",
		"startPageDreams": "Marzenia",
		"startPageGoals": "Cele",
		"startPageList": "Lista",
		"startPageMatrix": "Macierz",
```

with:

```json
		"startPage": "Strona początkowa",
		"startPageDreams": "Marzenia",
		"startPageGoals": "Cele",
		"startPageTasks": "Zadania",
		"startPageMatrix": "Macierz",
```

and remove:

```json
	"list": {
		"empty": "Brak zadań. Dodaj pierwsze."
	},
```

- [ ] **Step 4: Wire the route to `TasksPage` and delete the retired page**

In `src/router/index.ts`, replace the import:

```ts
import TodoListPage from '@/pages/TodoListPage/TodoListPage.vue';
```

with:

```ts
import TasksPage from '@/pages/TasksPage/TasksPage.vue';
```

Replace:

```ts
	{
		path: '/list',
		name: 'list',
		component: TodoListPage,
		meta: { startPage: { icon: mdiViewListOutline, labelKey: 'settings.startPageList' } },
	},
```

with:

```ts
	{
		path: '/tasks',
		name: 'tasks',
		component: TasksPage,
		meta: { startPage: { icon: mdiViewListOutline, labelKey: 'settings.startPageTasks' } },
	},
```

Replace the fallback in `readStoredStartPage`:

```ts
	const fallback = options[0]?.value ?? 'list';
```

with:

```ts
	const fallback = options[0]?.value ?? 'tasks';
```

Delete the retired page:

```bash
git rm src/pages/TodoListPage/TodoListPage.vue src/pages/TodoListPage/containers/TasksTable.vue
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/router/index.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: FAIL at this point — `BottomNav.test.ts` and `QuickAddFab.test.ts` still reference the `list` route name; they're fixed in Tasks 7 and 9. Confirm the *only* failures are in those two files (everything else, including `SettingsPage.test.ts`, must still pass — it only asserts against the first two `VSelect` items' behavior, not the full option count).

- [ ] **Step 7: Commit**

```bash
git add src/router/index.ts src/router/index.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: rename /list to /tasks, retire TodoListPage"
```

---

### Task 7: `BottomNav` — Tasks label and route

**Files:**

- Modify: `src/layouts/BottomNav.vue`
- Modify: `src/layouts/BottomNav.test.ts`

**Interfaces:**

- Consumes: route name `tasks` (exists as of Task 6).
- Produces: no change to `BottomNav`'s own props/emits. The nav target that used to point at `list` now points at `tasks`, with the same position and icon.

- [ ] **Step 1: Update the failing test**

In `src/layouts/BottomNav.test.ts`, replace:

```ts
			{ path: '/list', name: 'list', component: { template: '<div />' } },
```

with:

```ts
			{ path: '/tasks', name: 'tasks', component: { template: '<div />' } },
```

and replace:

```ts
			expect(wrapper.text()).toContain('List');
```

with:

```ts
			expect(wrapper.text()).toContain('Tasks');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/layouts/BottomNav.test.ts`
Expected: FAIL — `wrapper.text()` doesn't contain "Tasks" yet.

- [ ] **Step 3: Implement the change**

In `src/layouts/BottomNav.vue`, replace:

```vue
		<v-btn
			:to="{ name: 'list' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewListOutline"
			:color="route.name === 'list' ? 'primary' : undefined"
		>
			{{ t('nav.list') }}
		</v-btn>
```

with:

```vue
		<v-btn
			:to="{ name: 'tasks' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewListOutline"
			:color="route.name === 'tasks' ? 'primary' : undefined"
		>
			{{ t('nav.tasks') }}
		</v-btn>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/layouts/BottomNav.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BottomNav.vue src/layouts/BottomNav.test.ts
git commit -m "feat: point BottomNav's List target at the renamed /tasks route"
```

---

### Task 8: `AddEntityDialog` component

**Files:**

- Create: `src/components/AddEntityDialog.vue`
- Test: `src/components/AddEntityDialog.test.ts`

**Interfaces:**

- Consumes: `DreamDraft` from `@/stores/dreams`, `GoalDraft` from `@/stores/goals`, `TaskDraft` from `@/stores/tasks` (all existing types, unchanged).
- Produces: props `{ defaultTab: 'dream' | 'goal' | 'task'; dreamOptions: Array<{ value: string; title: string }>; goalOptions: Array<{ value: string; title: string }> }`, `v-model` boolean, emits `{ 'save-dream': [draft: DreamDraft]; 'save-goal': [draft: GoalDraft]; 'save-task': [draft: TaskDraft] }`. One `v-tabs` strip (Dream/Goal/Task) selects which field set is shown; each tab keeps its own local refs, so switching tabs doesn't discard another tab's in-progress input. Reopening the dialog (`v-model` false → true) resets to `defaultTab` and clears every field. Consumed by `QuickAddFab.vue` (Task 9).

- [ ] **Step 1: Write the failing test file**

`src/components/AddEntityDialog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import AddEntityDialog from './AddEntityDialog.vue';

const dreamOptions = [{ value: 'dream-1', title: 'Visit Japan' }];
const goalOptions = [{ value: 'goal-1', title: 'Learn Japanese' }];

function mountDialog(defaultTab: 'dream' | 'goal' | 'task' = 'task') {
	return mount(AddEntityDialog, {
		props: { modelValue: true, defaultTab, dreamOptions, goalOptions },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('AddEntityDialog default tab', () => {
	it('starts on the tab passed in as defaultTab', () => {
		const wrapper = mountDialog('goal');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('goal');
	});
});

describe('AddEntityDialog saving a dream', () => {
	it('emits save-dream with a trimmed draft and closes', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('  Visit Japan  ');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save-dream')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the dream name is empty', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save-dream')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('AddEntityDialog saving a goal', () => {
	it('emits save-goal with the picked dream', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: 'dream-1' }],
		]);
	});
});

describe('AddEntityDialog saving a task', () => {
	it('emits save-task with flags and the picked goal', async () => {
		const wrapper = mountDialog('task');

		await wrapper.get('input').setValue('Do Duolingo');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save-task')).toEqual([
			[{ name: 'Do Duolingo', note: undefined, important: true, urgent: false, goalId: 'goal-1' }],
		]);
	});
});

describe('AddEntityDialog tab switching', () => {
	it('preserves a tab\'s typed name after switching away and back', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');

		await clickButtonByText(wrapper, 'Task');
		await clickButtonByText(wrapper, 'Dream');

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Visit Japan');
	});

	it('validates only the active tab\'s name', async () => {
		const wrapper = mountDialog('dream');

		await wrapper.get('input').setValue('Visit Japan');
		await clickButtonByText(wrapper, 'Task');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.text()).toContain('Name is required');
		expect(wrapper.emitted('save-task')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/AddEntityDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./AddEntityDialog.vue"`.

- [ ] **Step 3: Implement the component**

`src/components/AddEntityDialog.vue`:

```vue
<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}
</style>

<template>
	<v-dialog v-model="open" max-width="480">
		<v-card variant="elevated">
			<v-tabs v-model="activeTab" color="primary">
				<v-tab value="dream">{{ t('dream.title') }}</v-tab>
				<v-tab value="goal">{{ t('goal.title') }}</v-tab>
				<v-tab value="task">{{ t('task.title') }}</v-tab>
			</v-tabs>

			<v-card-text>
				<template v-if="activeTab === 'dream'">
					<v-text-field
						v-model="dreamName"
						:label="t('entity.name')"
						:error-messages="dreamNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<v-textarea v-model="dreamNote" :label="t('entity.note')" rows="3" />
				</template>

				<template v-else-if="activeTab === 'goal'">
					<v-text-field
						v-model="goalName"
						:label="t('entity.name')"
						:error-messages="goalNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<v-textarea v-model="goalNote" :label="t('entity.note')" rows="3" />
					<v-select
						v-model="goalDreamId"
						:items="goalDreamSelectItems"
						item-title="title"
						item-value="value"
						:label="t('goal.dreamLabel')"
					/>
				</template>

				<template v-else>
					<v-text-field
						v-model="taskName"
						:label="t('entity.name')"
						:error-messages="taskNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<v-textarea v-model="taskNote" :label="t('entity.note')" rows="3" />
					<div :class="$style.flags">
						<v-switch v-model="taskImportant" :label="t('task.important')" color="primary" hide-details />
						<v-switch v-model="taskUrgent" :label="t('task.urgent')" color="primary" hide-details />
					</div>
					<v-select
						v-model="taskGoalId"
						:items="taskGoalSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.goalLabel')"
					/>
				</template>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn color="primary" variant="flat" @click="onSave">{{ t('form.save') }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DreamDraft } from '@/stores/dreams';
import type { GoalDraft } from '@/stores/goals';
import type { TaskDraft } from '@/stores/tasks';

const props = defineProps<{
	defaultTab: 'dream' | 'goal' | 'task';
	dreamOptions: Array<{ value: string; title: string }>;
	goalOptions: Array<{ value: string; title: string }>;
}>();

const emit = defineEmits<{
	'save-dream': [draft: DreamDraft];
	'save-goal': [draft: GoalDraft];
	'save-task': [draft: TaskDraft];
}>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const activeTab = ref<'dream' | 'goal' | 'task'>(props.defaultTab);
const showErrors = ref(false);

const dreamName = ref('');
const dreamNote = ref('');

const goalName = ref('');
const goalNote = ref('');
const goalDreamId = ref('');

const taskName = ref('');
const taskNote = ref('');
const taskImportant = ref(false);
const taskUrgent = ref(false);
const taskGoalId = ref('');

const goalDreamSelectItems = computed(() => [
	{ value: '', title: t('goal.noDream') },
	...props.dreamOptions,
]);
const taskGoalSelectItems = computed(() => [
	{ value: '', title: t('task.noGoal') },
	...props.goalOptions,
]);

const dreamNameError = computed(() =>
	showErrors.value && dreamName.value.trim() === '' ? t('form.nameRequired') : '',
);
const goalNameError = computed(() =>
	showErrors.value && goalName.value.trim() === '' ? t('form.nameRequired') : '',
);
const taskNameError = computed(() =>
	showErrors.value && taskName.value.trim() === '' ? t('form.nameRequired') : '',
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	activeTab.value = props.defaultTab;
	showErrors.value = false;
	dreamName.value = '';
	dreamNote.value = '';
	goalName.value = '';
	goalNote.value = '';
	goalDreamId.value = '';
	taskName.value = '';
	taskNote.value = '';
	taskImportant.value = false;
	taskUrgent.value = false;
	taskGoalId.value = '';
});

function onSave(): void {
	if (activeTab.value === 'dream') {
		if (dreamName.value.trim() === '') {
			showErrors.value = true;
			return;
		}

		const trimmedNote = dreamNote.value.trim();
		emit('save-dream', {
			name: dreamName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
		});
		open.value = false;
		return;
	}

	if (activeTab.value === 'goal') {
		if (goalName.value.trim() === '') {
			showErrors.value = true;
			return;
		}

		const trimmedNote = goalNote.value.trim();
		emit('save-goal', {
			name: goalName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
			dreamId: goalDreamId.value === '' ? undefined : goalDreamId.value,
		});
		open.value = false;
		return;
	}

	if (taskName.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = taskNote.value.trim();
	emit('save-task', {
		name: taskName.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: taskImportant.value,
		urgent: taskUrgent.value,
		goalId: taskGoalId.value === '' ? undefined : taskGoalId.value,
	});
	open.value = false;
}
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/AddEntityDialog.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AddEntityDialog.vue src/components/AddEntityDialog.test.ts
git commit -m "feat: add AddEntityDialog, a single tabbed Dream/Goal/Task add dialog"
```

---

### Task 9: `QuickAddFab` — unified tabbed add dialog

**Files:**

- Modify: `src/containers/QuickAddFab.vue`
- Modify: `src/containers/QuickAddFab.test.ts`

**Interfaces:**

- Consumes: `AddEntityDialog` (Task 8), `useDreamsStore()`/`useGoalsStore()`/`useTasksStore()` (existing `.active`, `.add`), `useRoute()`.
- Produces: no change to `QuickAddFab`'s own external surface. `defaultTab` is computed from the current route (`dreams` → `'dream'`, `goals` → `'goal'`, everything else → `'task'`) exactly the way the old per-route dialog choice was.

- [ ] **Step 1: Replace the failing test**

Replace the full contents of `src/containers/QuickAddFab.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Dream, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import QuickAddFab from './QuickAddFab.vue';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'dream-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		id: 'goal-1',
		name: 'Learn Japanese',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

async function mountAt(path: string, seed: { dreams?: Dream[]; goals?: Goal[] } = {}) {
	setActivePinia(createPinia());
	await useDreamsStore().load(async () => new EntityMemoryRepository<Dream>(seed.dreams ?? []));
	await useGoalsStore().load(async () => new EntityMemoryRepository<Goal>(seed.goals ?? []));
	await useTasksStore().load(async () => new EntityMemoryRepository<Task>());

	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/tasks', name: 'tasks', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(QuickAddFab, { global: { plugins: [vuetify, i18n, testRouter] } });
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('QuickAddFab default tab', () => {
	it('defaults to Dream on /dreams', async () => {
		const wrapper = await mountAt('/dreams');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('dream');
	});

	it('defaults to Goal on /goals', async () => {
		const wrapper = await mountAt('/goals');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('goal');
	});

	it('defaults to Task everywhere else', async () => {
		const wrapper = await mountAt('/tasks');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.findComponent({ name: 'VTabs' }).props('modelValue')).toBe('task');
	});
});

describe('QuickAddFab creating a dream', () => {
	it('adds a dream through the dreams store', async () => {
		const wrapper = await mountAt('/dreams');
		const dreams = useDreamsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan');
		await clickButtonByText(wrapper, 'Save');

		expect(dreams.records).toHaveLength(1);
		expect(dreams.records[0].name).toBe('Visit Japan');
	});
});

describe('QuickAddFab creating a goal', () => {
	it('adds a goal through the goals store, offering only active dreams', async () => {
		const wrapper = await mountAt('/goals', { dreams: [makeDream({ name: 'Visit Japan' })] });
		const goals = useGoalsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await clickButtonByText(wrapper, 'Save');

		expect(goals.records).toHaveLength(1);
		expect(goals.records[0]).toMatchObject({ name: 'Learn Japanese', dreamId: 'dream-1' });
	});
});

describe('QuickAddFab creating a task', () => {
	it('adds a task through the tasks store, offering only active goals', async () => {
		const wrapper = await mountAt('/tasks', { goals: [makeGoal({ name: 'Learn Japanese' })] });
		const tasks = useTasksStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Do Duolingo');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'goal-1');
		await clickButtonByText(wrapper, 'Save');

		expect(tasks.records).toHaveLength(1);
		expect(tasks.records[0]).toMatchObject({ name: 'Do Duolingo', goalId: 'goal-1' });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/containers/QuickAddFab.test.ts`
Expected: FAIL — `QuickAddFab` still renders the three conditional dialogs, no `VTabs` present.

- [ ] **Step 3: Implement the change**

Replace the full contents of `src/containers/QuickAddFab.vue`:

```vue
<style lang="scss" module>
.fab {
	box-shadow: 0 0.25rem 0.75rem rgb(var(--v-theme-on-surface) / 25%);
}
</style>

<template>
	<v-btn
		:class="$style.fab"
		:icon="mdiPlus"
		color="primary"
		variant="flat"
		size="large"
		:aria-label="t('form.add')"
		@click="dialogOpen = true"
	/>

	<add-entity-dialog
		v-model="dialogOpen"
		:default-tab="defaultTab"
		:dream-options="dreamOptions"
		:goal-options="goalOptions"
		@save-dream="handleDreamSave"
		@save-goal="handleGoalSave"
		@save-task="handleTaskSubmit"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiPlus } from '@mdi/js';
import AddEntityDialog from '@/components/AddEntityDialog.vue';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';

const { t } = useI18n();
const route = useRoute();
const tasksStore = useTasksStore();
const dreamsStore = useDreamsStore();
const goalsStore = useGoalsStore();

const dialogOpen = ref(false);

const defaultTab = computed<'dream' | 'goal' | 'task'>(() => {
	if (route.name === 'dreams') {
		return 'dream';
	}

	if (route.name === 'goals') {
		return 'goal';
	}

	return 'task';
});

const dreamOptions = computed(() =>
	dreamsStore.active.map((dream) => ({ value: dream.id, title: dream.name })),
);
const goalOptions = computed(() =>
	goalsStore.active.map((goal) => ({ value: goal.id, title: goal.name })),
);

async function handleTaskSubmit(draft: TaskDraft): Promise<void> {
	await tasksStore.add(draft);
}

async function handleDreamSave(draft: DreamDraft): Promise<void> {
	await dreamsStore.add(draft);
}

async function handleGoalSave(draft: GoalDraft): Promise<void> {
	await goalsStore.add(draft);
}
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/containers/QuickAddFab.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/containers/QuickAddFab.vue src/containers/QuickAddFab.test.ts
git commit -m "feat: make QuickAddFab open the unified AddEntityDialog"
```

---

### Task 10: `MatrixBoard` — migrate to `TaskDialog`, retire `TaskForm`

**Files:**

- Modify: `src/pages/MatrixPage/containers/MatrixBoard.vue`
- Modify: `src/pages/MatrixPage/containers/MatrixBoard.test.ts`
- Delete: `src/components/TaskForm.vue`
- Delete: `src/components/TaskForm.test.ts`

`MatrixBoard.vue` is `TaskForm`'s last remaining consumer (`TaskList.vue` uses `TaskDialog` since Task 5, `QuickAddFab.vue` uses `AddEntityDialog` since Task 9) — once it migrates, `TaskForm.vue` has no callers left.

**Interfaces:**

- Consumes: `TaskDialog` (Task 4), `useGoalsStore()` (existing `.active`), `quadrantFlags`/`useTasksStore` (existing, unchanged).
- Produces: no change to `MatrixBoard`'s own external surface. The quadrant "+" button still opens a task-add dialog pre-flagged via `quadrantFlags(quadrant)`; saving still calls `store.add(draft)`.

- [ ] **Step 1: Update the failing test**

In `src/pages/MatrixPage/containers/MatrixBoard.test.ts`, replace the import:

```ts
import { clickButtonByText } from '@/vitestHelpers';
```

with nothing (remove the line — it becomes unused once the one call site below changes to a direct selector).

Replace:

```ts
		await wrapper.get('input').setValue('Call the bank');
		await clickButtonByText(wrapper, 'Save');
```

with:

```ts
		await wrapper.get('input').setValue('Call the bank');
		await wrapper.get('button[aria-label="Save"]').trigger('click');
```

(`TaskDialog`'s Save action is `EntityDialog`'s icon-only checkmark button — it has an `aria-label` but no visible text, so `clickButtonByText` can no longer find it; every other `TaskDialog`/`GoalDialog`/`DreamDialog` test in this codebase already targets it by `aria-label` for the same reason.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/MatrixPage/containers/MatrixBoard.test.ts`
Expected: FAIL on the "opens the form pre-flagged" test — `wrapper.get('button[aria-label="Save"]')` throws, since `TaskForm.vue`'s Save button (`<v-btn color="primary" variant="flat" @click="submit">{{ t('form.save') }}</v-btn>`) carries no `aria-label` at all, only visible text.

- [ ] **Step 3: Implement the component change**

In `src/pages/MatrixPage/containers/MatrixBoard.vue`, replace:

```vue
			<task-form v-model="dialogOpen" :initial="initialDraft" @submit="store.add($event)" />
```

with:

```vue
			<task-dialog
				v-model="dialogOpen"
				mode="add"
				:initial="initialDraft"
				:goal-options="goalOptions"
				@save="store.add($event)"
			/>
```

Replace the import:

```ts
import TaskForm from '@/components/TaskForm.vue';
```

with:

```ts
import TaskDialog from '@/components/TaskDialog.vue';
import { useGoalsStore } from '@/stores/goals';
```

Add the `goals` store and a `goalOptions` computed. Replace:

```ts
const store = useTasksStore();

const dialogOpen = ref(false);
const initialDraft = ref<Partial<TaskDraft>>({});

const quadrantMeta: Record<QuadrantKey, { icon: string; accent?: boolean }> = {
```

with:

```ts
const store = useTasksStore();
const goals = useGoalsStore();

const dialogOpen = ref(false);
const initialDraft = ref<Partial<TaskDraft>>({});

const goalOptions = computed(() =>
	goals.active.map((goal) => ({ value: goal.id, title: goal.name })),
);

const quadrantMeta: Record<QuadrantKey, { icon: string; accent?: boolean }> = {
```

`computed` is already imported alongside `ref` at the top of the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pages/MatrixPage/containers/MatrixBoard.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Delete the retired `TaskForm`**

```bash
git rm src/components/TaskForm.vue src/components/TaskForm.test.ts
```

- [ ] **Step 6: Confirm nothing else still references `TaskForm`**

Run: `git grep -n "TaskForm"`
Expected: no output (empty — the deleted files were the last references).

- [ ] **Step 7: Run the full suite, lint, and build**

Run: `npm test && npm run lint && npm run build`
Expected: all three PASS.

- [ ] **Step 8: Commit**

```bash
git add src/pages/MatrixPage/containers/MatrixBoard.vue src/pages/MatrixPage/containers/MatrixBoard.test.ts
git commit -m "feat: migrate MatrixBoard to TaskDialog, retire TaskForm"
```

---

### Task 11: Final verification

**Files:** none (verification only; fixes go into whichever file the failure points at). Also touches `.claude/CLAUDE.md` and `.claude/Architecture.md` for the doc update in Step 6.

**Interfaces:** none.

- [ ] **Step 1: Run the full unit/component test suite**

Run: `npm test`
Expected: PASS, all files including every one added or modified in Tasks 1–10.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. If `vue/block-order` or an unused-import rule flags anything, fix it directly (e.g. `npm run lint:fix` for mechanical issues) rather than suppressing the rule.

- [ ] **Step 3: Run the type-checked production build**

Run: `npm run build`
Expected: `vue-tsc --noEmit` passes and the Vite build completes.

- [ ] **Step 4: Run the Playwright e2e suite**

Run: `npm run test:e2e`
Expected: PASS unchanged — this stage adds no e2e coverage (the spec defers all manual/browser verification for stage 6 to its end), but the existing suite must not regress against the renamed route and the new nav label/add dialog.

- [ ] **Step 5: Format check**

Run: `npm run format`
Expected: exits clean (Prettier writes only if something drifted from tabs/single-quotes/100-width; if it rewrites any file, `git diff` it, then re-run Steps 1–4).

- [ ] **Step 6: Update `.claude/CLAUDE.md` and `.claude/Architecture.md`**

In `.claude/CLAUDE.md`, replace the sentence:

```
Dedicated dream and goal pages are done too (see `docs/superpowers/specs/2026-08-17-stage-3-dream-goal-pages-design.md`): `/dreams` and `/goals` with Active/History tabs, a shared view-and-edit dialog, and cascading cancel. The unified add dialog, the `/list` → `/tasks` rename, a `goalId` picker on tasks, deadline UI, recurrence UI, and completion history are still not built.
```

with:

```
Dedicated dream and goal pages are done too (see `docs/superpowers/specs/2026-08-17-stage-3-dream-goal-pages-design.md`), and so is the tasks page rework (see `docs/superpowers/specs/2026-08-17-stage-4-tasks-page-design.md`): `/tasks` replaces `/list` on the same shared primitives, with Active/History tabs and task-under-goal grouping, a `goalId` picker on tasks, and a single tabbed `AddEntityDialog` (Dream/Goal/Task) replacing the old per-route add flow. Deadline UI, recurrence UI, and completion history are still not built.
```

In `.claude/Architecture.md`, replace:

```
	composables/             — Vue-tied reusable logic, e.g. useCascadeCancel.ts (cascading-cancel
	                            counting/execution, shared by the Dreams and Goals page containers)
```

with:

```
	composables/             — Vue-tied reusable logic, e.g. useCascadeCancel.ts (cascading-cancel
	                            counting/execution, shared by the Dreams and Goals page containers)
	                            and useToggleConfirm.ts (Done/Reopen confirm gating, shared by all
	                            three page containers)
```

- [ ] **Step 7: Commit**

```bash
git add .claude/CLAUDE.md .claude/Architecture.md
git commit -m "docs: mark stage 6 stage 4 (tasks page & unified add dialog) done in CLAUDE.md"
```

Do not merge to `main`, push, or add a remote — stay on `stage-6-dreams-goals-tasks` per standing instructions, and hand control back for the next stage (or the deferred full-stage manual QA pass) once this is committed.
