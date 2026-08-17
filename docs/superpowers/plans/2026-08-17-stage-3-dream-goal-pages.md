# Stage 6, Stage 3 — Dream & Goal Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Dream and Goal their own pages — Active/History tabs, a click-to-view-and-edit dialog, cascading cancel — built on new shared presentational primitives (`EntityListItem`, `EntityListGroup`, `EntityList`, `EntityDialog`, `ConfirmDialog`), wired into routing, the bottom nav, and the quick-add FAB.

**Architecture:** Shared presentational components live in `src/components/` (props/emits only, no store access) and are composed by two page-local containers, `DreamsPage/containers/DreamList.vue` and `GoalsPage/containers/GoalList.vue`, which own store access and business logic — mirroring the existing `TodoListPage` → `containers/TasksTable.vue` split. Cascade-cancel child-counting and execution lives in a new composable, `src/composables/useCascadeCancel.ts`, so `dreams`/`goals`/`tasks` stores stay mutually independent (the same reasoning `DefaultLayout.vue` already relies on). The goals store gains a `groupedByDream` getter that groups by `dreamId` only; resolving a group's displayed name is the container's job, for the same independence reason.

**Tech Stack:** Vite 8 (Rolldown), Vue 3.5 (generic `<script setup>` components), TypeScript, Pinia 4, vue-router 5, Vuetify 4.1, vue-i18n 11, Vitest 4 (`happy-dom` per-file via `// @vitest-environment happy-dom` wherever a component is mounted or `localStorage` is touched), `@vue/test-utils`, SCSS modules.

**Spec:** [docs/superpowers/specs/2026-08-17-stage-3-dream-goal-pages-design.md](../specs/2026-08-17-stage-3-dream-goal-pages-design.md)

## Global Constraints

- SFC section order is **style → template → script**, enforced by ESLint's `vue/block-order`. Omit the `<style>` block entirely on files that need no custom CSS (several existing pages already do this — don't add an empty block just to have one). Always `<script setup lang="ts">`.
- Formatting: tabs (`useTabs: true`, `tabWidth: 2`), single quotes, `printWidth: 100`, trailing commas everywhere (`.prettierrc.json`). Run `npm run format` if unsure.
- Imports inside `src` use the `@/` alias; a relative import is only for a sibling in the same page folder.
- `src/components/` (shared) and `src/containers/`/page-local `containers/` (shared/page business logic) follow the existing split: components get props/emits only, no store or service calls; containers own store access. `DreamDialog.vue`/`GoalDialog.vue`/`EntityDialog.vue`/`EntityList.vue`/`EntityListItem.vue`/`EntityListGroup.vue`/`ConfirmDialog.vue` all belong in `src/components/` and must not call `useXStore()`.
- No barrel `index.ts` for `components/`, `containers/`, or `pages/` — this codebase's actual practice (checked against the repo) only barrels `stores/` and `types/`; every component/container is imported by its own file path.
- Every file is English except `src/i18n/locales/ru.json` and `src/i18n/locales/pl.json`. New i18n keys need all three locale files updated in the same step.
- Default to no comments; add one only where the _why_ isn't obvious from the code.
- Don't add a `deadline` field, recurrence UI, or completion-history UI anywhere in this stage — out of scope per the spec. Don't touch `TasksTable.vue`/`MatrixBoard.vue`/`TaskQuadrant.vue` beyond what cascade-count read-only queries already require (none — those files aren't touched at all in this plan). Don't add a `goalId` picker to `TaskForm.vue`. Don't rename `/list` to `/tasks` or relabel the nav's List/Matrix buttons.
- No manual browser verification in this stage — deferred to the end of stage 6, per the user's standing preference. Every task's "done" bar is `npx vitest run <file>` (or the full `npm test`) passing, plus `npm run lint` and `npm run build` clean by the final task.
- Do not merge to `main`, push, or add a git remote — stay on `stage-6-dreams-goals-tasks` and commit locally only.

---

## File Structure

New files:

- `src/composables/useCascadeCancel.ts` (+ `.test.ts`) — cascade-cancel counting and execution, shared by both pages.
- `src/stores/goals.test.ts` — first dedicated test file for the goals store (covers the new `groupedByDream` getter).
- `src/components/ConfirmDialog.vue` (+ `.test.ts`) — generic confirm/cancel prompt, parameterized by an action list.
- `src/components/EntityListItem.vue` (+ `.test.ts`) — checkbox, name, optional note.
- `src/components/EntityListGroup.vue` (+ `.test.ts`) — `fieldset`/`legend` wrapper.
- `src/components/EntityList.vue` (+ `.test.ts`) — generic groups-then-tail-then-empty-state list, generic over `T extends EntityBase`.
- `src/components/EntityDialog.vue` (+ `.test.ts`) — the read-only/editing dialog frame.
- `src/components/DreamDialog.vue` (+ `.test.ts`) — `EntityDialog` wrapping name/note.
- `src/components/GoalDialog.vue` (+ `.test.ts`) — `EntityDialog` wrapping name/note/dream-picker.
- `src/pages/DreamsPage/DreamsPage.vue` — thin page.
- `src/pages/DreamsPage/containers/DreamList.vue` (+ `.test.ts`) — Dreams business logic.
- `src/pages/GoalsPage/GoalsPage.vue` — thin page.
- `src/pages/GoalsPage/containers/GoalList.vue` (+ `.test.ts`) — Goals business logic, including grouping.
- `src/router/index.test.ts` — first router test file (covers the two new start-page options).
- `src/layouts/BottomNav.test.ts` — first test file for the nav bar.
- `src/containers/QuickAddFab.test.ts` — first test file for the FAB.

Modified files: `src/stores/goals.ts` (adds `groupedByDream`, rewraps the store the way `stores/tasks.ts` already wraps its base store for `quadrants`), `src/router/index.ts` (`/dreams`, `/goals` routes), `src/layouts/BottomNav.vue` (five nav targets), `src/containers/QuickAddFab.vue` (route-aware), `src/i18n/locales/{en,ru,pl}.json` (new keys, introduced incrementally per task).

---

### Task 1: `useCascadeCancel` composable

**Files:**

- Create: `src/composables/useCascadeCancel.ts`
- Test: `src/composables/useCascadeCancel.test.ts`

**Interfaces:**

- Consumes: `useGoalsStore()` and `useTasksStore()` as they exist today — both already expose `.active: Goal[]/Task[]` and `.close(id: string, status: Status.Done | Status.Cancelled): Promise<void>`.
- Produces: `useCascadeCancel(): { countGoalTasks(goalId: string): number; countDreamDescendants(dreamId: string): { goals: number; tasks: number }; cancelGoalTasks(goalId: string): Promise<void>; cancelDreamGoals(dreamId: string): Promise<void> }`. `cancelDreamGoals` internally calls `cancelGoalTasks` for each active goal it cancels. Both `DreamList.vue` (Task 10) and `GoalList.vue` (Task 11) consume this directly.

- [ ] **Step 1: Write the failing test file**

`src/composables/useCascadeCancel.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useCascadeCancel } from './useCascadeCancel';

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
	setActivePinia(createPinia());
});

describe('useCascadeCancel counting', () => {
	it('counts zero when a goal has no active tasks', async () => {
		const tasks = useTasksStore();
		await tasks.load(async () => new EntityMemoryRepository<Task>());
		const cascade = useCascadeCancel();

		expect(cascade.countGoalTasks('goal-1')).toBe(0);
	});

	it("counts only active tasks under a goal, not closed ones or another goal's", async () => {
		const tasks = useTasksStore();
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1' }),
					makeTask({ id: 'b', goalId: 'goal-1' }),
					makeTask({ id: 'c', goalId: 'goal-1', status: Status.Done }),
					makeTask({ id: 'd', goalId: 'other-goal' }),
				]),
		);
		const cascade = useCascadeCancel();

		expect(cascade.countGoalTasks('goal-1')).toBe(2);
	});

	it('counts active goals under a dream and their active tasks transitively', async () => {
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await goals.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'g1', dreamId: 'dream-1' }),
					makeGoal({ id: 'g2', dreamId: 'dream-1' }),
					makeGoal({ id: 'g3', dreamId: 'dream-1', status: Status.Done }),
					makeGoal({ id: 'g4', dreamId: 'other-dream' }),
				]),
		);
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 't1', goalId: 'g1' }),
					makeTask({ id: 't2', goalId: 'g2' }),
					makeTask({ id: 't3', goalId: 'g2', status: Status.Cancelled }),
					makeTask({ id: 't4', goalId: 'g3' }), // under a closed goal -- must not count
				]),
		);
		const cascade = useCascadeCancel();

		expect(cascade.countDreamDescendants('dream-1')).toEqual({ goals: 2, tasks: 2 });
	});
});

describe('useCascadeCancel execution', () => {
	it('cancelGoalTasks cancels every active task under the goal and leaves the rest alone', async () => {
		const tasks = useTasksStore();
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 'a', goalId: 'goal-1' }),
					makeTask({ id: 'b', goalId: 'goal-1', status: Status.Done }),
					makeTask({ id: 'c', goalId: 'other-goal' }),
				]),
		);
		const cascade = useCascadeCancel();

		await cascade.cancelGoalTasks('goal-1');

		expect(tasks.records.find((t) => t.id === 'a')?.status).toBe(Status.Cancelled);
		expect(tasks.records.find((t) => t.id === 'b')?.status).toBe(Status.Done);
		expect(tasks.records.find((t) => t.id === 'c')?.status).toBe(Status.Opened);
	});

	it('cancelDreamGoals cancels every active goal under the dream and their active tasks', async () => {
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await goals.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'g1', dreamId: 'dream-1' }),
					makeGoal({ id: 'g2', dreamId: 'dream-1', status: Status.Cancelled }),
					makeGoal({ id: 'g3', dreamId: 'other-dream' }),
				]),
		);
		await tasks.load(
			async () =>
				new EntityMemoryRepository([
					makeTask({ id: 't1', goalId: 'g1' }),
					makeTask({ id: 't2', goalId: 'g2' }), // under an already-cancelled goal
				]),
		);
		const cascade = useCascadeCancel();

		await cascade.cancelDreamGoals('dream-1');

		expect(goals.records.find((g) => g.id === 'g1')?.status).toBe(Status.Cancelled);
		expect(goals.records.find((g) => g.id === 'g2')?.status).toBe(Status.Cancelled); // untouched, already cancelled
		expect(goals.records.find((g) => g.id === 'g3')?.status).toBe(Status.Opened);
		expect(tasks.records.find((t) => t.id === 't1')?.status).toBe(Status.Cancelled);
		expect(tasks.records.find((t) => t.id === 't2')?.status).toBe(Status.Opened); // g2's branch was never processed
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/composables/useCascadeCancel.test.ts`
Expected: FAIL — `Failed to resolve import "./useCascadeCancel"`.

- [ ] **Step 3: Implement the composable**

`src/composables/useCascadeCancel.ts`:

```ts
import { Status } from '@/types';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';

export interface CascadeCounts {
	goals: number;
	tasks: number;
}

/**
 * Counts and cancels a Dream/Goal's active descendants for the cascading-cancel
 * flow. Lives here, not inside the entity stores, so dreams/goals/tasks stay
 * mutually independent -- the same reasoning `DefaultLayout.vue` already
 * relies on by importing all three stores together without any of them
 * knowing about each other.
 */
export function useCascadeCancel() {
	const goals = useGoalsStore();
	const tasks = useTasksStore();

	function countGoalTasks(goalId: string): number {
		return tasks.active.filter((task) => task.goalId === goalId).length;
	}

	function countDreamDescendants(dreamId: string): CascadeCounts {
		const activeGoals = goals.active.filter((goal) => goal.dreamId === dreamId);
		const taskCount = activeGoals.reduce((sum, goal) => sum + countGoalTasks(goal.id), 0);

		return { goals: activeGoals.length, tasks: taskCount };
	}

	async function cancelGoalTasks(goalId: string): Promise<void> {
		const ids = tasks.active.filter((task) => task.goalId === goalId).map((task) => task.id);

		for (const id of ids) {
			await tasks.close(id, Status.Cancelled);
		}
	}

	async function cancelDreamGoals(dreamId: string): Promise<void> {
		const ids = goals.active.filter((goal) => goal.dreamId === dreamId).map((goal) => goal.id);

		for (const id of ids) {
			await cancelGoalTasks(id);
			await goals.close(id, Status.Cancelled);
		}
	}

	return { countGoalTasks, countDreamDescendants, cancelGoalTasks, cancelDreamGoals };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/composables/useCascadeCancel.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/composables/useCascadeCancel.ts src/composables/useCascadeCancel.test.ts
git commit -m "feat: add useCascadeCancel composable for cascading-cancel counting and execution"
```

---

### Task 2: `groupedByDream` getter on the goals store

**Files:**

- Modify: `src/stores/goals.ts`
- Create: `src/stores/goals.test.ts`

**Interfaces:**

- Consumes: `defineEntityStore` from `./createEntityStore` (unchanged), `storeToRefs` from `pinia` (already used the same way in `stores/tasks.ts`).
- Produces: `useGoalsStore()` keeps its existing surface (`records`, `active`, `closed`, `loading`, `load`, `add`, `update`, `close`, `reopen`, `replaceAll`) and gains `groupedByDream: { active: GroupedGoals; closed: GroupedGoals }` where `interface DreamGroup { dreamId: string; items: Goal[] }` and `interface GroupedGoals { groups: DreamGroup[]; ungrouped: Goal[] }`. Both types are exported from `src/stores/goals.ts`. `GoalList.vue` (Task 11) consumes `groupedByDream` and resolves `dreamId` to a display name itself.

- [ ] **Step 1: Write the failing test file**

`src/stores/goals.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Status, type Goal } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useGoalsStore } from './goals';

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

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('useGoalsStore groupedByDream', () => {
	it('puts a dreamless goal in the ungrouped tail', async () => {
		const store = useGoalsStore();
		await store.load(async () => new EntityMemoryRepository([makeGoal({ id: 'a' })]));

		expect(store.groupedByDream.active.groups).toEqual([]);
		expect(store.groupedByDream.active.ungrouped.map((g) => g.id)).toEqual(['a']);
	});

	it('groups multiple goals under the same dream together', async () => {
		const store = useGoalsStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'a', dreamId: 'dream-1' }),
					makeGoal({ id: 'b', dreamId: 'dream-1' }),
					makeGoal({ id: 'c', dreamId: 'dream-2' }),
				]),
		);

		const groups = store.groupedByDream.active.groups;
		expect(groups).toHaveLength(2);
		expect(groups.find((g) => g.dreamId === 'dream-1')?.items.map((g) => g.id)).toEqual(['a', 'b']);
		expect(groups.find((g) => g.dreamId === 'dream-2')?.items.map((g) => g.id)).toEqual(['c']);
	});

	it('groups a goal by dreamId regardless of the dream record itself -- the getter never reads Dream data', async () => {
		const store = useGoalsStore();
		await store.load(
			async () => new EntityMemoryRepository([makeGoal({ id: 'a', dreamId: 'closed-dream' })]),
		);

		expect(store.groupedByDream.active.groups).toEqual([
			{ dreamId: 'closed-dream', items: [store.records[0]] },
		]);
	});

	it('groups active and closed goals separately, for the Active and History tabs', async () => {
		const store = useGoalsStore();
		await store.load(
			async () =>
				new EntityMemoryRepository([
					makeGoal({ id: 'a', dreamId: 'dream-1', status: Status.Opened }),
					makeGoal({ id: 'b', dreamId: 'dream-1', status: Status.Done }),
				]),
		);

		expect(store.groupedByDream.active.groups[0].items.map((g) => g.id)).toEqual(['a']);
		expect(store.groupedByDream.closed.groups[0].items.map((g) => g.id)).toEqual(['b']);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/stores/goals.test.ts`
Expected: FAIL — `store.groupedByDream` is `undefined`.

- [ ] **Step 3: Implement the getter**

Replace the full contents of `src/stores/goals.ts`:

```ts
import { computed } from 'vue';
import { defineStore, storeToRefs } from 'pinia';
import { Status, parseGoal, type Deadline, type Goal } from '@/types';
import { EntityDbRepository } from '@/repositories/EntityDbRepository';
import { defineEntityStore } from './createEntityStore';

export interface GoalDraft {
	name: string;
	note?: string;
	dreamId?: string;
	deadline?: Deadline;
}

export interface DreamGroup {
	dreamId: string;
	items: Goal[];
}

export interface GroupedGoals {
	groups: DreamGroup[];
	ungrouped: Goal[];
}

const useBaseGoalsStore = defineEntityStore<Goal, GoalDraft>({
	id: 'goals',
	createRepository: () => EntityDbRepository.create('goals', parseGoal),
	build: (draft, id, now) => ({
		id,
		name: draft.name,
		note: draft.note,
		created: now,
		updated: now,
		status: Status.Opened,
		dreamId: draft.dreamId,
		deadline: draft.deadline,
	}),
});

function groupByDream(records: Goal[]): GroupedGoals {
	const byDream = new Map<string, Goal[]>();
	const ungrouped: Goal[] = [];

	for (const goal of records) {
		if (goal.dreamId === undefined) {
			ungrouped.push(goal);
			continue;
		}

		const items = byDream.get(goal.dreamId) ?? [];
		items.push(goal);
		byDream.set(goal.dreamId, items);
	}

	return {
		groups: [...byDream.entries()].map(([dreamId, items]) => ({ dreamId, items })),
		ungrouped,
	};
}

/**
 * Wraps the base goals store to add `groupedByDream`, the same
 * `storeToRefs`-based composition `stores/tasks.ts` uses for `quadrants` (see
 * that file's comment for why a plain spread would silently freeze `active`
 * and `closed`).
 *
 * `groupedByDream` keys groups by `dreamId` only -- it does not resolve the
 * Dream's name. Doing that here would mean the goals store importing the
 * dreams store, which would break the mutual independence dreams/goals/tasks
 * keep today (the same reasoning that keeps cascade-cancel's child counting
 * out of the stores entirely, in `composables/useCascadeCancel.ts`). A
 * caller with access to both stores -- a container -- resolves `dreamId` to
 * a name itself.
 */
export const useGoalsStore = defineStore('goalsGrouped', () => {
	const store = useBaseGoalsStore();
	const { records, active, closed, loading } = storeToRefs(store);

	const groupedByDream = computed<{ active: GroupedGoals; closed: GroupedGoals }>(() => ({
		active: groupByDream(active.value),
		closed: groupByDream(closed.value),
	}));

	return {
		records,
		active,
		closed,
		loading,
		groupedByDream,
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

Run: `npx vitest run src/stores/goals.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite to check nothing else broke**

Run: `npm test`
Expected: PASS. (`BackupActions.vue`, `DefaultLayout.vue`, `SyncFlow.vue` all call `useGoalsStore()` only for `.records`/`.replaceAll`/`.load`, all still present.)

- [ ] **Step 6: Commit**

```bash
git add src/stores/goals.ts src/stores/goals.test.ts
git commit -m "feat: add groupedByDream getter to the goals store"
```

---

### Task 3: `ConfirmDialog` shared component

**Files:**

- Create: `src/components/ConfirmDialog.vue`
- Test: `src/components/ConfirmDialog.test.ts`

**Interfaces:**

- Produces: props `{ title: string; body: string; actions: Array<{ key: string; label: string; color?: string }> }`, `v-model` boolean (open), emits `choose: [key: string]`. Clicking an action button closes the dialog and emits `choose` with that action's `key`. Consumed by `DreamList.vue` (Task 10) and `GoalList.vue` (Task 11) for confirmDone/confirmReopen prompts and the cascade-cancel choice.

- [ ] **Step 1: Write the failing test file**

`src/components/ConfirmDialog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import ConfirmDialog from './ConfirmDialog.vue';

function mountDialog(
	actions = [
		{ key: 'no', label: 'Keep it' },
		{ key: 'yes', label: 'Cancel it', color: 'error' },
	],
) {
	return mount(ConfirmDialog, {
		props: {
			modelValue: true,
			title: 'Cancel this branch?',
			body: 'Active tasks under this goal: 2.',
			actions,
		},
		global: { plugins: [vuetify, i18n] },
	});
}

describe('ConfirmDialog', () => {
	it('renders the title and body text', () => {
		const wrapper = mountDialog();

		expect(wrapper.text()).toContain('Cancel this branch?');
		expect(wrapper.text()).toContain('Active tasks under this goal: 2.');
	});

	it('renders one button per action, in order', () => {
		const wrapper = mountDialog();
		const buttons = wrapper.findAllComponents({ name: 'VBtn' });

		expect(buttons.map((b) => b.text())).toEqual(['Keep it', 'Cancel it']);
	});

	it('emits choose with the clicked action key and closes', async () => {
		const wrapper = mountDialog();

		await clickButtonByText(wrapper, 'Cancel it');

		expect(wrapper.emitted('choose')).toEqual([['yes']]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ConfirmDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./ConfirmDialog.vue"`.

- [ ] **Step 3: Implement the component**

`src/components/ConfirmDialog.vue`:

```vue
<template>
	<v-dialog v-model="open" max-width="440">
		<v-card variant="elevated">
			<v-card-title>{{ title }}</v-card-title>
			<v-card-text>{{ body }}</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn
					v-for="action in actions"
					:key="action.key"
					:color="action.color"
					variant="text"
					@click="choose(action.key)"
				>
					{{ action.label }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
export interface ConfirmAction {
	key: string;
	label: string;
	color?: string;
}

defineProps<{
	title: string;
	body: string;
	actions: ConfirmAction[];
}>();

const emit = defineEmits<{ choose: [key: string] }>();

const open = defineModel<boolean>({ required: true });

function choose(key: string): void {
	open.value = false;
	emit('choose', key);
}
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ConfirmDialog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ConfirmDialog.vue src/components/ConfirmDialog.test.ts
git commit -m "feat: add generic ConfirmDialog component"
```

---

### Task 4: `EntityListItem` shared component

**Files:**

- Create: `src/components/EntityListItem.vue`
- Test: `src/components/EntityListItem.test.ts`

**Interfaces:**

- Produces: props `{ name: string; note?: string; done: boolean }`, emits `{ 'update:done': [value: boolean]; click: [] }`. Renders a checkbox (reuses the existing `task.done` i18n key as its aria-label, matching `TaskQuadrant.vue`'s precedent), the name, and the note on a second line when present. Clicking the checkbox stops propagation and emits `update:done`; clicking anywhere else on the row emits `click`. Consumed by `EntityList.vue` (Task 6).

- [ ] **Step 1: Write the failing test file**

`src/components/EntityListItem.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import EntityListItem from './EntityListItem.vue';

function mountItem(props: { name: string; note?: string; done: boolean }) {
	return mount(EntityListItem, { props, global: { plugins: [vuetify, i18n] } });
}

describe('EntityListItem', () => {
	it('renders the name and, when present, the note', () => {
		const wrapper = mountItem({ name: 'Visit Japan', note: 'Cherry blossom season', done: false });

		expect(wrapper.text()).toContain('Visit Japan');
		expect(wrapper.text()).toContain('Cherry blossom season');
	});

	it('omits the note element entirely when there is none', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		expect(wrapper.findComponent({ name: 'VListItemSubtitle' }).exists()).toBe(false);
	});

	it('reflects the done prop on the checkbox', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: true });

		expect((wrapper.find('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true);
	});

	it('emits update:done, not click, when the checkbox is toggled', async () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('update:done')).toEqual([[true]]);
		expect(wrapper.emitted('click')).toBeUndefined();
	});

	it('emits click when the item body is clicked', async () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		await wrapper.get('.v-list-item').trigger('click');

		expect(wrapper.emitted('click')).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/EntityListItem.test.ts`
Expected: FAIL — `Failed to resolve import "./EntityListItem.vue"`.

- [ ] **Step 3: Implement the component**

`src/components/EntityListItem.vue`:

```vue
<template>
	<v-list-item @click="emit('click')">
		<template #prepend>
			<v-checkbox-btn
				:model-value="done"
				:aria-label="t('task.done')"
				@click.stop
				@update:model-value="emit('update:done', $event ?? false)"
			/>
		</template>

		<v-list-item-title>{{ name }}</v-list-item-title>
		<v-list-item-subtitle v-if="note">{{ note }}</v-list-item-subtitle>
	</v-list-item>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
	name: string;
	note?: string;
	done: boolean;
}>();

const emit = defineEmits<{
	'update:done': [value: boolean];
	click: [];
}>();

const { t } = useI18n();
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/EntityListItem.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EntityListItem.vue src/components/EntityListItem.test.ts
git commit -m "feat: add EntityListItem component"
```

---

### Task 5: `EntityListGroup` shared component

**Files:**

- Create: `src/components/EntityListGroup.vue`
- Test: `src/components/EntityListGroup.test.ts`

**Interfaces:**

- Produces: props `{ label: string }`, default slot for the group's items. Renders a `fieldset`/`legend` wrapper. Consumed by `EntityList.vue` (Task 6).

- [ ] **Step 1: Write the failing test file**

`src/components/EntityListGroup.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import EntityListGroup from './EntityListGroup.vue';

describe('EntityListGroup', () => {
	it('renders the label in a legend and the slot content inside a fieldset', () => {
		const wrapper = mount(EntityListGroup, {
			props: { label: 'Visit Japan' },
			slots: { default: '<p>Learn Japanese</p>' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('fieldset').exists()).toBe(true);
		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/EntityListGroup.test.ts`
Expected: FAIL — `Failed to resolve import "./EntityListGroup.vue"`.

- [ ] **Step 3: Implement the component**

`src/components/EntityListGroup.vue`:

```vue
<style lang="scss" module>
.group {
	border: none;
	padding: 0;
	margin: 0 0 1rem;
}

.legend {
	font-size: 0.875rem;
	color: rgb(var(--v-theme-on-surface-variant));
	padding-inline: 0.25rem;
}
</style>

<template>
	<fieldset :class="$style.group">
		<legend :class="$style.legend">{{ label }}</legend>
		<slot />
	</fieldset>
</template>

<script setup lang="ts">
defineProps<{ label: string }>();
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/EntityListGroup.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/components/EntityListGroup.vue src/components/EntityListGroup.test.ts
git commit -m "feat: add EntityListGroup component"
```

---

### Task 6: `EntityList` shared component

**Files:**

- Create: `src/components/EntityList.vue`
- Test: `src/components/EntityList.test.ts`

**Interfaces:**

- Consumes: `EntityListGroup` (Task 5), `EntityListItem` (Task 4), `EntityBase`/`Status` from `@/types`.
- Produces: a generic component, `<script setup lang="ts" generic="T extends EntityBase">`, props `{ groups: Array<{ key: string; label: string; items: T[] }>; ungrouped: T[]; emptyText: string; showNote: boolean }`, emits `{ toggle: [id: string, done: boolean]; open: [item: T] }`. Renders each group via `EntityListGroup`, then the ungrouped tail with no wrapper, then `emptyText` when both are empty. `showNote` gates whether each item's `note` is passed through (the stage-2 `rows` setting's first reader). Consumed by `DreamList.vue` (Task 10) and `GoalList.vue` (Task 11).

- [ ] **Step 1: Write the failing test file**

`src/components/EntityList.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Status, type Dream } from '@/types';
import EntityList from './EntityList.vue';

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'a',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

describe('EntityList empty state', () => {
	it('shows the empty text when there is nothing to render', () => {
		const wrapper = mount(EntityList, {
			props: { groups: [], ungrouped: [], emptyText: 'Nothing here yet.', showNote: false },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Nothing here yet.');
	});
});

describe('EntityList grouped rendering', () => {
	it('renders each group with its label and items, then the ungrouped tail', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [
					{
						key: 'dream-1',
						label: 'Visit Japan',
						items: [makeDream({ id: 'g1', name: 'Learn Japanese' })],
					},
				],
				ungrouped: [makeDream({ id: 'g2', name: 'Read more' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
		expect(wrapper.text()).toContain('Read more');
	});

	it('renders ungrouped items with no group wrapper when there are no groups', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', name: 'Visit Japan' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Visit Japan');
	});
});

describe('EntityList note visibility', () => {
	it('hides the note when showNote is false', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', note: 'Cherry blossoms' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).not.toContain('Cherry blossoms');
	});

	it('shows the note when showNote is true', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', note: 'Cherry blossoms' })],
				emptyText: 'Nothing here yet.',
				showNote: true,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Cherry blossoms');
	});
});

describe('EntityList events', () => {
	it('emits toggle with the item id and the new done value', async () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('toggle')).toEqual([['a', true]]);
	});

	it('emits open with the clicked item', async () => {
		const dream = makeDream({ id: 'a' });
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [dream],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('.v-list-item').trigger('click');

		expect(wrapper.emitted('open')).toEqual([[dream]]);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/EntityList.test.ts`
Expected: FAIL — `Failed to resolve import "./EntityList.vue"`.

- [ ] **Step 3: Implement the component**

`src/components/EntityList.vue`:

```vue
<template>
	<p v-if="groups.length === 0 && ungrouped.length === 0" class="text-medium-emphasis pa-4">
		{{ emptyText }}
	</p>

	<template v-else>
		<entity-list-group v-for="group in groups" :key="group.key" :label="group.label">
			<entity-list-item
				v-for="item in group.items"
				:key="item.id"
				:name="item.name"
				:note="showNote ? item.note : undefined"
				:done="item.status === Status.Done"
				@update:done="emit('toggle', item.id, $event)"
				@click="emit('open', item)"
			/>
		</entity-list-group>

		<entity-list-item
			v-for="item in ungrouped"
			:key="item.id"
			:name="item.name"
			:note="showNote ? item.note : undefined"
			:done="item.status === Status.Done"
			@update:done="emit('toggle', item.id, $event)"
			@click="emit('open', item)"
		/>
	</template>
</template>

<script setup lang="ts" generic="T extends EntityBase">
import EntityListGroup from './EntityListGroup.vue';
import EntityListItem from './EntityListItem.vue';
import { Status, type EntityBase } from '@/types';

defineProps<{
	groups: Array<{ key: string; label: string; items: T[] }>;
	ungrouped: T[];
	emptyText: string;
	showNote: boolean;
}>();

const emit = defineEmits<{
	toggle: [id: string, done: boolean];
	open: [item: T];
}>();
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/EntityList.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/EntityList.vue src/components/EntityList.test.ts
git commit -m "feat: add generic EntityList component"
```

---

### Task 7: `EntityDialog` shared component

**Files:**

- Create: `src/components/EntityDialog.vue`
- Test: `src/components/EntityDialog.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Produces: props `{ title: string; mode?: 'add' | 'edit' }` (default `'edit'`), `v-model` boolean (open), scoped default slot `#default="{ editing: boolean }"`, emits `{ save: []; cancel: [] }`. In `mode: 'add'` it opens directly editable, with no pencil and no cancel-record button. In `mode: 'edit'` it opens read-only with a pencil that switches to editing (exposing `editing: true` to the slot) and shows a "Cancel this record" button that emits `cancel`. The checkmark (visible while editing) emits `save`; the caller decides whether to persist and close. Reopening (`v-model` false → true) resets `editing` to `mode === 'add'`. Consumed by `DreamDialog.vue` (Task 8) and `GoalDialog.vue` (Task 9).

- [ ] **Step 1: Write the failing test file**

`src/components/EntityDialog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { h } from 'vue';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import EntityDialog from './EntityDialog.vue';

describe('EntityDialog add mode', () => {
	it('opens directly editable, with no pencil and no cancel-record button', () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'New dream', mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('button[aria-label="Edit"]').exists()).toBe(false);
		expect(wrapper.find('button[aria-label="Save"]').exists()).toBe(true);
		expect(wrapper.text()).not.toContain('Cancel this record');
	});
});

describe('EntityDialog edit mode', () => {
	it('opens read-only, with a pencil and a cancel-record button', () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('button[aria-label="Edit"]').exists()).toBe(true);
		expect(wrapper.find('button[aria-label="Save"]').exists()).toBe(false);
		expect(wrapper.text()).toContain('Cancel this record');
	});

	it('switches to editing when the pencil is clicked, exposing editing:true to the slot', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			slots: {
				default: (props: { editing: boolean }) => h('span', props.editing ? 'editing' : 'viewing'),
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('viewing');

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		expect(wrapper.text()).toContain('editing');
		expect(wrapper.find('button[aria-label="Save"]').exists()).toBe(true);
	});

	it('emits save when the checkmark is clicked', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toHaveLength(1);
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});

	it('resets to read-only the next time it opens', async () => {
		const wrapper = mount(EntityDialog, {
			props: { modelValue: true, title: 'Visit Japan', mode: 'edit' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.setProps({ modelValue: false });
		await wrapper.setProps({ modelValue: true });

		expect(wrapper.find('button[aria-label="Edit"]').exists()).toBe(true);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/EntityDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./EntityDialog.vue"`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace the end of the file:

```json
	"quadrant": {
		"do": "Do",
		"schedule": "Schedule",
		"delegate": "Delegate",
		"eliminate": "Eliminate",
		"empty": "Empty"
	}
}
```

with:

```json
	"quadrant": {
		"do": "Do",
		"schedule": "Schedule",
		"delegate": "Delegate",
		"eliminate": "Eliminate",
		"empty": "Empty"
	},
	"entity": {
		"edit": "Edit",
		"cancelRecord": "Cancel this record"
	}
}
```

In `src/i18n/locales/ru.json`, replace the same tail:

```json
	"quadrant": {
		"do": "Сделать",
		"schedule": "Запланировать",
		"delegate": "Делегировать",
		"eliminate": "Удалить",
		"empty": "Пусто"
	}
}
```

with:

```json
	"quadrant": {
		"do": "Сделать",
		"schedule": "Запланировать",
		"delegate": "Делегировать",
		"eliminate": "Удалить",
		"empty": "Пусто"
	},
	"entity": {
		"edit": "Изменить",
		"cancelRecord": "Отменить запись"
	}
}
```

In `src/i18n/locales/pl.json`, replace the same tail:

```json
	"quadrant": {
		"do": "Zrób",
		"schedule": "Zaplanuj",
		"delegate": "Deleguj",
		"eliminate": "Usuń",
		"empty": "Pusto"
	}
}
```

with:

```json
	"quadrant": {
		"do": "Zrób",
		"schedule": "Zaplanuj",
		"delegate": "Deleguj",
		"eliminate": "Usuń",
		"empty": "Pusto"
	},
	"entity": {
		"edit": "Edytuj",
		"cancelRecord": "Anuluj wpis"
	}
}
```

- [ ] **Step 4: Implement the component**

`src/components/EntityDialog.vue`:

```vue
<template>
	<v-dialog v-model="open" max-width="480">
		<v-card variant="elevated">
			<v-card-title class="d-flex align-center">
				<span>{{ title }}</span>
				<v-spacer />
				<v-btn
					v-if="!editing"
					:icon="mdiPencilOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('entity.edit')"
					@click="editing = true"
				/>
				<v-btn
					v-else
					:icon="mdiCheck"
					variant="text"
					density="comfortable"
					:aria-label="t('form.save')"
					@click="emit('save')"
				/>
			</v-card-title>

			<v-card-text>
				<slot :editing="editing" />
			</v-card-text>

			<v-card-actions v-if="mode === 'edit'">
				<v-btn
					color="error"
					variant="text"
					:prepend-icon="mdiDeleteOutline"
					@click="emit('cancel')"
				>
					{{ t('entity.cancelRecord') }}
				</v-btn>
				<v-spacer />
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js';

const props = withDefaults(
	defineProps<{
		title: string;
		mode?: 'add' | 'edit';
	}>(),
	{ mode: 'edit' },
);

const emit = defineEmits<{ save: []; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const editing = ref(props.mode === 'add');

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	editing.value = props.mode === 'add';
});
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/EntityDialog.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/EntityDialog.vue src/components/EntityDialog.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add EntityDialog read-only/editing frame"
```

---

### Task 8: `DreamDialog` component

**Files:**

- Create: `src/components/DreamDialog.vue`
- Test: `src/components/DreamDialog.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `EntityDialog` (Task 7), `DreamDraft` from `@/stores/dreams` (existing: `{ name: string; note?: string }`).
- Produces: props `{ initial?: Partial<DreamDraft>; mode?: 'add' | 'edit' }` (default `initial: {}`, `mode: 'edit'`), `v-model` boolean, emits `{ save: [draft: DreamDraft]; cancel: [] }`. Validates `name` is non-empty before emitting `save` (mirrors `TaskForm.vue`'s `nameError` pattern) and closes itself (`open.value = false`) on a successful save. Re-emits `cancel` unchanged. Consumed by `DreamList.vue` (Task 10) and `QuickAddFab.vue` (Task 14).

- [ ] **Step 1: Write the failing test file**

`src/components/DreamDialog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import DreamDialog from './DreamDialog.vue';

describe('DreamDialog add mode', () => {
	it('opens directly editable and emits a trimmed draft on save', async () => {
		const wrapper = mount(DreamDialog, {
			props: { modelValue: true, mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('  Visit Japan  ');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([[{ name: 'Visit Japan', note: undefined }]]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('blocks save and shows an error when the name is empty', async () => {
		const wrapper = mount(DreamDialog, {
			props: { modelValue: true, mode: 'add' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toBeUndefined();
		expect(wrapper.text()).toContain('Name is required');
	});
});

describe('DreamDialog edit mode', () => {
	it('opens read-only, showing the existing name and note as plain text', () => {
		const wrapper = mount(DreamDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Visit Japan', note: 'Cherry blossom season' },
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Visit Japan');
		expect(wrapper.text()).toContain('Cherry blossom season');
		expect(wrapper.find('input').exists()).toBe(false);
	});

	it('prefills the fields once editing starts', async () => {
		const wrapper = mount(DreamDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Visit Japan', note: 'Cherry blossom season' },
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Visit Japan');
	});

	it('emits cancel when the cancel-record button is clicked', async () => {
		const wrapper = mount(DreamDialog, {
			props: { modelValue: true, mode: 'edit', initial: { name: 'Visit Japan' } },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/DreamDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./DreamDialog.vue"`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
	"entity": {
		"edit": "Edit",
		"cancelRecord": "Cancel this record"
	}
}
```

with:

```json
	"entity": {
		"edit": "Edit",
		"cancelRecord": "Cancel this record",
		"name": "Name",
		"note": "Note"
	},
	"dream": {
		"title": "Dream"
	}
}
```

In `src/i18n/locales/ru.json`, replace:

```json
	"entity": {
		"edit": "Изменить",
		"cancelRecord": "Отменить запись"
	}
}
```

with:

```json
	"entity": {
		"edit": "Изменить",
		"cancelRecord": "Отменить запись",
		"name": "Название",
		"note": "Описание"
	},
	"dream": {
		"title": "Мечта"
	}
}
```

In `src/i18n/locales/pl.json`, replace:

```json
	"entity": {
		"edit": "Edytuj",
		"cancelRecord": "Anuluj wpis"
	}
}
```

with:

```json
	"entity": {
		"edit": "Edytuj",
		"cancelRecord": "Anuluj wpis",
		"name": "Nazwa",
		"note": "Opis"
	},
	"dream": {
		"title": "Marzenie"
	}
}
```

- [ ] **Step 4: Implement the component**

`src/components/DreamDialog.vue`:

```vue
<template>
	<entity-dialog
		v-model="open"
		:title="t('dream.title')"
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
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import type { DreamDraft } from '@/stores/dreams';

const props = withDefaults(
	defineProps<{
		initial?: Partial<DreamDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: DreamDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	name.value = props.initial.name ?? '';
	note.value = props.initial.note ?? '';
	showErrors.value = false;
});

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('save', { name: name.value.trim(), note: trimmedNote === '' ? undefined : trimmedNote });
	open.value = false;
}
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/DreamDialog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/DreamDialog.vue src/components/DreamDialog.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add DreamDialog component"
```

---

### Task 9: `GoalDialog` component

**Files:**

- Create: `src/components/GoalDialog.vue`
- Test: `src/components/GoalDialog.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `EntityDialog` (Task 7), `GoalDraft` from `@/stores/goals` (existing: `{ name: string; note?: string; dreamId?: string; deadline?: Deadline }` — this stage only ever sends `name`/`note`/`dreamId`).
- Produces: props `{ initial?: Partial<GoalDraft>; mode?: 'add' | 'edit'; dreamOptions: Array<{ value: string; title: string }> }` (default `initial: {}`, `mode: 'edit'`), `v-model` boolean, emits `{ save: [draft: GoalDraft]; cancel: [] }`. Same name validation as `DreamDialog`. `dreamOptions` is supplied entirely by the caller — this component never touches a store, so "active dreams plus the current selection if closed" (per spec) is the caller's job. Consumed by `GoalList.vue` (Task 11) and `QuickAddFab.vue` (Task 14).

- [ ] **Step 1: Write the failing test file**

`src/components/GoalDialog.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import GoalDialog from './GoalDialog.vue';

const dreamOptions = [{ value: 'dream-1', title: 'Visit Japan' }];

describe('GoalDialog add mode', () => {
	it('emits a draft including the picked dream', async () => {
		const wrapper = mount(GoalDialog, {
			props: { modelValue: true, mode: 'add', dreamOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Learn Japanese');
		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		await select.vm.$emit('update:modelValue', 'dream-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: 'dream-1' }],
		]);
	});

	it('emits dreamId undefined when "no dream" stays selected', async () => {
		const wrapper = mount(GoalDialog, {
			props: { modelValue: true, mode: 'add', dreamOptions },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined }],
		]);
	});
});

describe('GoalDialog dream picker', () => {
	it('offers "no dream" plus every option passed in', () => {
		const wrapper = mount(GoalDialog, {
			props: { modelValue: true, mode: 'add', dreamOptions },
			global: { plugins: [vuetify, i18n] },
		});

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('items')).toEqual([
			{ value: '', title: 'No dream' },
			{ value: 'dream-1', title: 'Visit Japan' },
		]);
	});
});

describe('GoalDialog edit mode', () => {
	it('shows the linked dream name in the read-only view', () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', dreamId: 'dream-1' },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Visit Japan');
	});

	it('preserves a closed dream that is present only because it is the current selection', async () => {
		const closedOptions = [{ value: 'closed-dream', title: 'Old dream' }];
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', dreamId: 'closed-dream' },
				dreamOptions: closedOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-dream');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/GoalDialog.test.ts`
Expected: FAIL — `Failed to resolve import "./GoalDialog.vue"`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
	"dream": {
		"title": "Dream"
	}
}
```

with:

```json
	"dream": {
		"title": "Dream"
	},
	"goal": {
		"title": "Goal",
		"dreamLabel": "Dream",
		"noDream": "No dream"
	}
}
```

In `src/i18n/locales/ru.json`, replace:

```json
	"dream": {
		"title": "Мечта"
	}
}
```

with:

```json
	"dream": {
		"title": "Мечта"
	},
	"goal": {
		"title": "Цель",
		"dreamLabel": "Мечта",
		"noDream": "Без мечты"
	}
}
```

In `src/i18n/locales/pl.json`, replace:

```json
	"dream": {
		"title": "Marzenie"
	}
}
```

with:

```json
	"dream": {
		"title": "Marzenie"
	},
	"goal": {
		"title": "Cel",
		"dreamLabel": "Marzenie",
		"noDream": "Bez marzenia"
	}
}
```

- [ ] **Step 4: Implement the component**

`src/components/GoalDialog.vue`:

```vue
<template>
	<entity-dialog
		v-model="open"
		:title="t('goal.title')"
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
				<v-select
					v-model="dreamId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('goal.dreamLabel')"
				/>
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
				<p v-if="dreamName" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('goal.dreamLabel') }}: {{ dreamName }}
				</p>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import type { GoalDraft } from '@/stores/goals';

const props = withDefaults(
	defineProps<{
		initial?: Partial<GoalDraft>;
		mode?: 'add' | 'edit';
		dreamOptions: Array<{ value: string; title: string }>;
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: GoalDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const dreamId = ref('');
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

const selectItems = computed(() => [
	{ value: '', title: t('goal.noDream') },
	...props.dreamOptions,
]);

const dreamName = computed(
	() => selectItems.value.find((item) => item.value === dreamId.value)?.title,
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	name.value = props.initial.name ?? '';
	note.value = props.initial.note ?? '';
	dreamId.value = props.initial.dreamId ?? '';
	showErrors.value = false;
});

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('save', {
		name: name.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		dreamId: dreamId.value === '' ? undefined : dreamId.value,
	});
	open.value = false;
}
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/GoalDialog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/GoalDialog.vue src/components/GoalDialog.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add GoalDialog component"
```

---

### Task 10: `DreamsPage` and `DreamList` container

**Files:**

- Create: `src/pages/DreamsPage/DreamsPage.vue`
- Create: `src/pages/DreamsPage/containers/DreamList.vue`
- Test: `src/pages/DreamsPage/containers/DreamList.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `useCascadeCancel()` (Task 1) → `{ countDreamDescendants, cancelDreamGoals }`; `EntityList` (Task 6); `DreamDialog` (Task 8); `ConfirmDialog` (Task 3); `useDreamsStore()` (existing: `records`, `active`, `closed`, `update`, `close`, `reopen`); `useSettingsStore()` (existing: `.dreams: { rows, confirmDone, confirmReopen }`, `.updatePageSettings`).
- Produces: `DreamsPage.vue` renders `<dream-list />` with no other logic. `DreamList.vue` has no props/emits — it's a page-local container mounted directly by the route.

- [ ] **Step 1: Write the failing test file**

`src/pages/DreamsPage/containers/DreamList.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Dream, type Goal } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
import DreamList from './DreamList.vue';

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

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

async function mountWithDreams(dreams: Dream[], goals: Goal[] = []) {
	const dreamsStore = useDreamsStore();
	const goalsStore = useGoalsStore();
	const tasksStore = useTasksStore();
	await dreamsStore.load(async () => new EntityMemoryRepository(dreams));
	await goalsStore.load(async () => new EntityMemoryRepository(goals));
	await tasksStore.load(async () => new EntityMemoryRepository([]));

	const wrapper = mount(DreamList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, dreamsStore, goalsStore };
}

describe('DreamList empty state', () => {
	it('shows the empty message when there are no dreams', async () => {
		const { wrapper } = await mountWithDreams([]);

		expect(wrapper.text()).toContain('No dreams yet.');
	});
});

describe('DreamList editing', () => {
	it('opens a dream read-only on click and saves an edit', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);

		await wrapper.get('.v-list-item').trigger('click');
		expect(wrapper.text()).toContain('Visit Japan');

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan and Korea');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(dreamsStore.records[0].name).toBe('Visit Japan and Korea');
	});
});

describe('DreamList done / reopen', () => {
	it('marks a dream done immediately when confirmDone is off', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);
		useSettingsStore().updatePageSettings('dreams', { confirmDone: false });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(dreamsStore.records[0].status).toBe(Status.Done);
	});

	it('asks for confirmation before marking done when confirmDone is on', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);
		useSettingsStore().updatePageSettings('dreams', { confirmDone: true });

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(dreamsStore.records[0].status).toBe(Status.Opened);
		expect(wrapper.text()).toContain('Mark "Visit Japan" as done?');

		await clickButtonByText(wrapper, 'Confirm');

		expect(dreamsStore.records[0].status).toBe(Status.Done);
	});

	it('reopens a closed dream from the History tab, gated by confirmReopen', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream({ status: Status.Done })]);
		useSettingsStore().updatePageSettings('dreams', { confirmReopen: false });

		await clickButtonByText(wrapper, 'History');
		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(dreamsStore.records[0].status).toBe(Status.Opened);
	});
});

describe('DreamList cancel', () => {
	it('cancels immediately when the dream has no active goals', async () => {
		const { wrapper, dreamsStore } = await mountWithDreams([makeDream()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(dreamsStore.records[0].status).toBe(Status.Cancelled);
		expect(wrapper.text()).not.toContain('Cancel the whole branch');
	});

	it('shows the cascade choice when the dream has active goals, and "only this" leaves them alone', async () => {
		const { wrapper, dreamsStore, goalsStore } = await mountWithDreams(
			[makeDream()],
			[makeGoal({ dreamId: 'dream-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.text()).toContain('Cancel the whole branch');

		await clickButtonByText(wrapper, 'Cancel only this');

		expect(dreamsStore.records[0].status).toBe(Status.Cancelled);
		expect(goalsStore.records[0].status).toBe(Status.Opened);
	});

	it('cancels the whole branch, including active goals, when chosen', async () => {
		const { wrapper, dreamsStore, goalsStore } = await mountWithDreams(
			[makeDream()],
			[makeGoal({ dreamId: 'dream-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');
		await clickButtonByText(wrapper, 'Cancel the whole branch');

		expect(dreamsStore.records[0].status).toBe(Status.Cancelled);
		expect(goalsStore.records[0].status).toBe(Status.Cancelled);
	});
});

describe('DreamList tabs', () => {
	it('shows only open dreams on Active and only closed ones on History', async () => {
		const { wrapper } = await mountWithDreams([
			makeDream({ id: 'open', name: 'Open dream' }),
			makeDream({ id: 'done', name: 'Done dream', status: Status.Done }),
		]);

		expect(wrapper.text()).toContain('Open dream');
		expect(wrapper.text()).not.toContain('Done dream');

		await clickButtonByText(wrapper, 'History');

		expect(wrapper.text()).not.toContain('Open dream');
		expect(wrapper.text()).toContain('Done dream');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/DreamsPage/containers/DreamList.test.ts`
Expected: FAIL — `Failed to resolve import "./DreamList.vue"`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
	"entity": {
		"edit": "Edit",
		"cancelRecord": "Cancel this record",
		"name": "Name",
		"note": "Note"
	},
	"dream": {
		"title": "Dream"
	},
```

with:

```json
	"entity": {
		"edit": "Edit",
		"cancelRecord": "Cancel this record",
		"name": "Name",
		"note": "Note",
		"active": "Active",
		"history": "History",
		"confirmDoneTitle": "Mark as done?",
		"confirmDoneBody": "Mark \"{name}\" as done?",
		"confirmReopenTitle": "Reopen?",
		"confirmReopenBody": "Reopen \"{name}\"?",
		"confirm": "Confirm",
		"cascadeTitle": "Cancel this branch?",
		"cascadeDreamBody": "Active goals under this dream: {goals}. Active tasks under them: {tasks}.",
		"cascadeOnly": "Cancel only this",
		"cascadeBranch": "Cancel the whole branch"
	},
	"dream": {
		"title": "Dream",
		"empty": "No dreams yet."
	},
```

In `src/i18n/locales/ru.json`, replace:

```json
	"entity": {
		"edit": "Изменить",
		"cancelRecord": "Отменить запись",
		"name": "Название",
		"note": "Описание"
	},
	"dream": {
		"title": "Мечта"
	},
```

with:

```json
	"entity": {
		"edit": "Изменить",
		"cancelRecord": "Отменить запись",
		"name": "Название",
		"note": "Описание",
		"active": "Активные",
		"history": "История",
		"confirmDoneTitle": "Отметить как выполненное?",
		"confirmDoneBody": "Отметить «{name}» как выполненное?",
		"confirmReopenTitle": "Вернуть в активные?",
		"confirmReopenBody": "«{name}» — вернуть в активные?",
		"confirm": "Подтвердить",
		"cascadeTitle": "Отменить всю ветку?",
		"cascadeDreamBody": "Активных целей в этой мечте: {goals}. Активных задач в них: {tasks}.",
		"cascadeOnly": "Отменить только это",
		"cascadeBranch": "Отменить всю ветку"
	},
	"dream": {
		"title": "Мечта",
		"empty": "Пока нет мечт."
	},
```

In `src/i18n/locales/pl.json`, replace:

```json
	"entity": {
		"edit": "Edytuj",
		"cancelRecord": "Anuluj wpis",
		"name": "Nazwa",
		"note": "Opis"
	},
	"dream": {
		"title": "Marzenie"
	},
```

with:

```json
	"entity": {
		"edit": "Edytuj",
		"cancelRecord": "Anuluj wpis",
		"name": "Nazwa",
		"note": "Opis",
		"active": "Aktywne",
		"history": "Historia",
		"confirmDoneTitle": "Oznaczyć jako zrobione?",
		"confirmDoneBody": "Oznaczyć „{name}” jako zrobione?",
		"confirmReopenTitle": "Wznowić?",
		"confirmReopenBody": "Wznowić „{name}”?",
		"confirm": "Potwierdź",
		"cascadeTitle": "Anulować całą gałąź?",
		"cascadeDreamBody": "Aktywnych celów w tym marzeniu: {goals}. Aktywnych zadań w nich: {tasks}.",
		"cascadeOnly": "Anuluj tylko to",
		"cascadeBranch": "Anuluj całą gałąź"
	},
	"dream": {
		"title": "Marzenie",
		"empty": "Brak marzeń."
	},
```

- [ ] **Step 4: Implement `DreamsPage.vue`**

`src/pages/DreamsPage/DreamsPage.vue`:

```vue
<template>
	<dream-list />
</template>

<script setup lang="ts">
import DreamList from './containers/DreamList.vue';
</script>
```

- [ ] **Step 5: Implement `DreamList.vue`**

`src/pages/DreamsPage/containers/DreamList.vue`:

```vue
<template>
	<v-container>
		<v-btn-toggle v-model="tab" mandatory color="primary" class="mb-4">
			<v-btn value="active">{{ t('entity.active') }}</v-btn>
			<v-btn value="history">{{ t('entity.history') }}</v-btn>
		</v-btn-toggle>

		<entity-list
			:groups="[]"
			:ungrouped="visible"
			:empty-text="t('dream.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<dream-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
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

		<confirm-dialog
			v-model="cascadeOpen"
			:title="t('entity.cascadeTitle')"
			:body="cascadeBody"
			:actions="cascadeActions"
			@choose="onCascadeChoice"
		/>
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type Dream } from '@/types';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import EntityList from '@/components/EntityList.vue';
import DreamDialog from '@/components/DreamDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const dreams = useDreamsStore();
const settings = useSettingsStore();
const cascade = useCascadeCancel();

const tab = ref<'active' | 'history'>('active');
const visible = computed(() => (tab.value === 'active' ? dreams.active : dreams.closed));
const showNote = computed(() => settings.dreams.rows === 2);

const dialogOpen = ref(false);
const editing = ref<Dream | null>(null);
const initialDraft = computed<Partial<DreamDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note } = editing.value;
	return { name, note };
});

function openEdit(dream: Dream): void {
	editing.value = dream;
	dialogOpen.value = true;
}

async function handleSave(draft: DreamDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await dreams.update(editing.value.id, draft);
	editing.value = null;
}

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

function onToggle(id: string, done: boolean): void {
	const dream = dreams.records.find((record) => record.id === id);
	if (!dream) {
		return;
	}

	const needsConfirm = done ? settings.dreams.confirmDone : settings.dreams.confirmReopen;
	if (!needsConfirm) {
		void applyToggle(dream, done);
		return;
	}

	pendingToggle.value = { dream, done };
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

const pendingCancel = ref<Dream | null>(null);
const cascadeCounts = ref({ goals: 0, tasks: 0 });
const cascadeOpen = ref(false);

const cascadeBody = computed(() =>
	t('entity.cascadeDreamBody', {
		goals: cascadeCounts.value.goals,
		tasks: cascadeCounts.value.tasks,
	}),
);
const cascadeActions = computed(() => [
	{ key: 'only', label: t('entity.cascadeOnly') },
	{ key: 'branch', label: t('entity.cascadeBranch'), color: 'error' },
]);

function onCancel(): void {
	const dream = editing.value;
	if (!dream) {
		return;
	}

	const counts = cascade.countDreamDescendants(dream.id);
	if (counts.goals === 0 && counts.tasks === 0) {
		void dreams.close(dream.id, Status.Cancelled);
		dialogOpen.value = false;
		editing.value = null;
		return;
	}

	pendingCancel.value = dream;
	cascadeCounts.value = counts;
	cascadeOpen.value = true;
}

async function onCascadeChoice(key: string): Promise<void> {
	const dream = pendingCancel.value;
	pendingCancel.value = null;
	dialogOpen.value = false;
	editing.value = null;
	if (!dream) {
		return;
	}

	if (key === 'branch') {
		await cascade.cancelDreamGoals(dream.id);
	}

	await dreams.close(dream.id, Status.Cancelled);
}
</script>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/pages/DreamsPage/containers/DreamList.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add src/pages/DreamsPage src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add DreamsPage with Active/History tabs and cascading cancel"
```

---

### Task 11: `GoalsPage` and `GoalList` container

**Files:**

- Create: `src/pages/GoalsPage/GoalsPage.vue`
- Create: `src/pages/GoalsPage/containers/GoalList.vue`
- Test: `src/pages/GoalsPage/containers/GoalList.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `useCascadeCancel()` (Task 1) → `{ countGoalTasks, cancelGoalTasks }`; `EntityList` (Task 6); `GoalDialog` (Task 9); `ConfirmDialog` (Task 3); `useGoalsStore()` (Task 2, including `groupedByDream`); `useDreamsStore()` (existing: `records`, `active`); `useSettingsStore()` (existing: `.goals: { rows, confirmDone, confirmReopen }`).
- Produces: `GoalsPage.vue` renders `<goal-list />`. `GoalList.vue` has no props/emits.

- [ ] **Step 1: Write the failing test file**

`src/pages/GoalsPage/containers/GoalList.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status, type Dream, type Goal, type Task } from '@/types';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import GoalList from './GoalList.vue';

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

async function mountWithData(dreams: Dream[], goals: Goal[], tasks: Task[] = []) {
	const dreamsStore = useDreamsStore();
	const goalsStore = useGoalsStore();
	const tasksStore = useTasksStore();
	await dreamsStore.load(async () => new EntityMemoryRepository(dreams));
	await goalsStore.load(async () => new EntityMemoryRepository(goals));
	await tasksStore.load(async () => new EntityMemoryRepository(tasks));

	const wrapper = mount(GoalList, { global: { plugins: [vuetify, i18n] } });
	return { wrapper, dreamsStore, goalsStore, tasksStore };
}

describe('GoalList empty state', () => {
	it('shows the empty message when there are no goals', async () => {
		const { wrapper } = await mountWithData([], []);

		expect(wrapper.text()).toContain('No goals yet.');
	});
});

describe('GoalList grouping', () => {
	it('groups a goal under its dream, using the dream name as the group label', async () => {
		const { wrapper } = await mountWithData([makeDream()], [makeGoal({ dreamId: 'dream-1' })]);

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
		expect(wrapper.text()).toContain('Learn Japanese');
	});

	it('still groups and shows the dream name when the dream itself is closed', async () => {
		const { wrapper } = await mountWithData(
			[makeDream({ status: Status.Done })],
			[makeGoal({ dreamId: 'dream-1' })],
		);

		expect(wrapper.find('legend').text()).toBe('Visit Japan');
	});

	it('puts a dreamless goal in the ungrouped tail, with no group wrapper', async () => {
		const { wrapper } = await mountWithData([], [makeGoal({ id: 'g1', name: 'Read more' })]);

		expect(wrapper.find('fieldset').exists()).toBe(false);
		expect(wrapper.text()).toContain('Read more');
	});
});

describe('GoalList dream picker options', () => {
	it('offers only active dreams as new choices', async () => {
		const { wrapper } = await mountWithData(
			[
				makeDream({ id: 'active-dream', name: 'Active dream' }),
				makeDream({ id: 'closed-dream', name: 'Closed dream', status: Status.Done }),
			],
			[makeGoal({ dreamId: 'active-dream' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toEqual(['No dream', 'Active dream']);
	});

	it('keeps the currently-linked closed dream as an option when editing that goal', async () => {
		const { wrapper } = await mountWithData(
			[makeDream({ id: 'closed-dream', name: 'Closed dream', status: Status.Cancelled })],
			[makeGoal({ dreamId: 'closed-dream' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(select.props('modelValue')).toBe('closed-dream');
		const items = select.props('items') as Array<{ title: string }>;
		expect(items.map((item) => item.title)).toContain('Closed dream');
	});
});

describe('GoalList cancel', () => {
	it('cancels immediately when the goal has no active tasks', async () => {
		const { wrapper, goalsStore } = await mountWithData([], [makeGoal()]);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(goalsStore.records[0].status).toBe(Status.Cancelled);
	});

	it('shows the cascade choice and cancels tasks when the whole branch is chosen', async () => {
		const { wrapper, goalsStore, tasksStore } = await mountWithData(
			[],
			[makeGoal()],
			[makeTask({ goalId: 'goal-1' })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await clickButtonByText(wrapper, 'Cancel this record');

		expect(wrapper.text()).toContain('Cancel the whole branch');

		await clickButtonByText(wrapper, 'Cancel the whole branch');

		expect(goalsStore.records[0].status).toBe(Status.Cancelled);
		expect(tasksStore.records[0].status).toBe(Status.Cancelled);
	});
});

describe('GoalList tabs', () => {
	it('switches between Active and History', async () => {
		const { wrapper } = await mountWithData(
			[],
			[
				makeGoal({ id: 'open', name: 'Open goal' }),
				makeGoal({ id: 'done', name: 'Done goal', status: Status.Done }),
			],
		);

		expect(wrapper.text()).toContain('Open goal');
		expect(wrapper.text()).not.toContain('Done goal');

		await clickButtonByText(wrapper, 'History');

		expect(wrapper.text()).not.toContain('Open goal');
		expect(wrapper.text()).toContain('Done goal');
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pages/GoalsPage/containers/GoalList.test.ts`
Expected: FAIL — `Failed to resolve import "./GoalList.vue"`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
		"cascadeOnly": "Cancel only this",
		"cascadeBranch": "Cancel the whole branch"
	},
	"dream": {
		"title": "Dream",
		"empty": "No dreams yet."
	},
	"goal": {
		"title": "Goal",
		"dreamLabel": "Dream",
		"noDream": "No dream"
	}
}
```

with:

```json
		"cascadeOnly": "Cancel only this",
		"cascadeBranch": "Cancel the whole branch",
		"cascadeGoalBody": "Active tasks under this goal: {count}."
	},
	"dream": {
		"title": "Dream",
		"empty": "No dreams yet."
	},
	"goal": {
		"title": "Goal",
		"dreamLabel": "Dream",
		"noDream": "No dream",
		"empty": "No goals yet."
	}
}
```

In `src/i18n/locales/ru.json`, replace:

```json
		"cascadeOnly": "Отменить только это",
		"cascadeBranch": "Отменить всю ветку"
	},
	"dream": {
		"title": "Мечта",
		"empty": "Пока нет мечт."
	},
	"goal": {
		"title": "Цель",
		"dreamLabel": "Мечта",
		"noDream": "Без мечты"
	}
}
```

with:

```json
		"cascadeOnly": "Отменить только это",
		"cascadeBranch": "Отменить всю ветку",
		"cascadeGoalBody": "Активных задач в этой цели: {count}."
	},
	"dream": {
		"title": "Мечта",
		"empty": "Пока нет мечт."
	},
	"goal": {
		"title": "Цель",
		"dreamLabel": "Мечта",
		"noDream": "Без мечты",
		"empty": "Пока нет целей."
	}
}
```

In `src/i18n/locales/pl.json`, replace:

```json
		"cascadeOnly": "Anuluj tylko to",
		"cascadeBranch": "Anuluj całą gałąź"
	},
	"dream": {
		"title": "Marzenie",
		"empty": "Brak marzeń."
	},
	"goal": {
		"title": "Cel",
		"dreamLabel": "Marzenie",
		"noDream": "Bez marzenia"
	}
}
```

with:

```json
		"cascadeOnly": "Anuluj tylko to",
		"cascadeBranch": "Anuluj całą gałąź",
		"cascadeGoalBody": "Aktywnych zadań w tym celu: {count}."
	},
	"dream": {
		"title": "Marzenie",
		"empty": "Brak marzeń."
	},
	"goal": {
		"title": "Cel",
		"dreamLabel": "Marzenie",
		"noDream": "Bez marzenia",
		"empty": "Brak celów."
	}
}
```

- [ ] **Step 4: Implement `GoalsPage.vue`**

`src/pages/GoalsPage/GoalsPage.vue`:

```vue
<template>
	<goal-list />
</template>

<script setup lang="ts">
import GoalList from './containers/GoalList.vue';
</script>
```

- [ ] **Step 5: Implement `GoalList.vue`**

`src/pages/GoalsPage/containers/GoalList.vue`:

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
			:empty-text="t('goal.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<goal-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			:dream-options="dreamOptions"
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

		<confirm-dialog
			v-model="cascadeOpen"
			:title="t('entity.cascadeTitle')"
			:body="cascadeBody"
			:actions="cascadeActions"
			@choose="onCascadeChoice"
		/>
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type Goal } from '@/types';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';
import { useDreamsStore } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import EntityList from '@/components/EntityList.vue';
import GoalDialog from '@/components/GoalDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const goals = useGoalsStore();
const dreams = useDreamsStore();
const settings = useSettingsStore();
const cascade = useCascadeCancel();

const tab = ref<'active' | 'history'>('active');
const showNote = computed(() => settings.goals.rows === 2);

function labelFor(dreamId: string): string {
	return dreams.records.find((dream) => dream.id === dreamId)?.name ?? '';
}

const activeGrouped = computed(() => goals.groupedByDream.active);
const closedGrouped = computed(() => goals.groupedByDream.closed);

const groups = computed(() => {
	const source = tab.value === 'active' ? activeGrouped.value : closedGrouped.value;
	return source.groups.map((group) => ({
		key: group.dreamId,
		label: labelFor(group.dreamId),
		items: group.items,
	}));
});
const ungrouped = computed(
	() => (tab.value === 'active' ? activeGrouped.value : closedGrouped.value).ungrouped,
);

const dialogOpen = ref(false);
const editing = ref<Goal | null>(null);
const initialDraft = computed<Partial<GoalDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, dreamId } = editing.value;
	return { name, note, dreamId };
});

const dreamOptions = computed(() => {
	const options = dreams.active.map((dream) => ({ value: dream.id, title: dream.name }));
	const currentDreamId = editing.value?.dreamId;

	if (currentDreamId !== undefined && !options.some((option) => option.value === currentDreamId)) {
		const closedDream = dreams.records.find((dream) => dream.id === currentDreamId);
		if (closedDream) {
			options.push({ value: closedDream.id, title: closedDream.name });
		}
	}

	return options;
});

function openEdit(goal: Goal): void {
	editing.value = goal;
	dialogOpen.value = true;
}

async function handleSave(draft: GoalDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await goals.update(editing.value.id, draft);
	editing.value = null;
}

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

function onToggle(id: string, done: boolean): void {
	const goal = goals.records.find((record) => record.id === id);
	if (!goal) {
		return;
	}

	const needsConfirm = done ? settings.goals.confirmDone : settings.goals.confirmReopen;
	if (!needsConfirm) {
		void applyToggle(goal, done);
		return;
	}

	pendingToggle.value = { goal, done };
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

const pendingCancel = ref<Goal | null>(null);
const cascadeCount = ref(0);
const cascadeOpen = ref(false);

const cascadeBody = computed(() => t('entity.cascadeGoalBody', { count: cascadeCount.value }));
const cascadeActions = computed(() => [
	{ key: 'only', label: t('entity.cascadeOnly') },
	{ key: 'branch', label: t('entity.cascadeBranch'), color: 'error' },
]);

function onCancel(): void {
	const goal = editing.value;
	if (!goal) {
		return;
	}

	const count = cascade.countGoalTasks(goal.id);
	if (count === 0) {
		void goals.close(goal.id, Status.Cancelled);
		dialogOpen.value = false;
		editing.value = null;
		return;
	}

	pendingCancel.value = goal;
	cascadeCount.value = count;
	cascadeOpen.value = true;
}

async function onCascadeChoice(key: string): Promise<void> {
	const goal = pendingCancel.value;
	pendingCancel.value = null;
	dialogOpen.value = false;
	editing.value = null;
	if (!goal) {
		return;
	}

	if (key === 'branch') {
		await cascade.cancelGoalTasks(goal.id);
	}

	await goals.close(goal.id, Status.Cancelled);
}
</script>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/pages/GoalsPage/containers/GoalList.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 7: Commit**

```bash
git add src/pages/GoalsPage src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add GoalsPage with dream grouping and cascading cancel"
```

---

### Task 12: Routing — `/dreams` and `/goals`

**Files:**

- Modify: `src/router/index.ts`
- Test: `src/router/index.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `DreamsPage.vue` (Task 10), `GoalsPage.vue` (Task 11), `getStartPageOptions`/`readStoredStartPage` (existing, unchanged signatures).
- Produces: two new named routes, `dreams` (`/dreams`) and `goals` (`/goals`), both carrying `meta.startPage`. `getStartPageOptions()` now returns four entries in route-definition order: `list`, `matrix`, `dreams`, `goals` — `list` stays first so the fallback start page for a fresh install is unchanged. `BottomNav.vue` (Task 13) and `QuickAddFab.vue` (Task 14) both depend on these two route names existing.

- [ ] **Step 1: Write the failing test file**

`src/router/index.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { getStartPageOptions } from './index';

beforeEach(() => {
	window.localStorage.clear();
});

describe('getStartPageOptions', () => {
	it('includes the dreams and goals routes alongside list and matrix, list first', () => {
		const values = getStartPageOptions().map((option) => option.value);

		expect(values).toEqual(['list', 'matrix', 'dreams', 'goals']);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/router/index.test.ts`
Expected: FAIL — actual is `['list', 'matrix']`.

- [ ] **Step 3: Add the new i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
	"nav": {
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
		"list": "List",
		"matrix": "Matrix",
		"settings": "Settings"
	},
```

and replace:

```json
		"startPage": "Start page",
		"startPageList": "List",
		"startPageMatrix": "Matrix",
```

with:

```json
		"startPage": "Start page",
		"startPageDreams": "Dreams",
		"startPageGoals": "Goals",
		"startPageList": "List",
		"startPageMatrix": "Matrix",
```

In `src/i18n/locales/ru.json`, replace:

```json
	"nav": {
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
		"list": "Список",
		"matrix": "Матрица",
		"settings": "Настройки"
	},
```

and replace:

```json
		"startPage": "Стартовая страница",
		"startPageList": "Список",
		"startPageMatrix": "Матрица",
```

with:

```json
		"startPage": "Стартовая страница",
		"startPageDreams": "Мечты",
		"startPageGoals": "Цели",
		"startPageList": "Список",
		"startPageMatrix": "Матрица",
```

In `src/i18n/locales/pl.json`, replace:

```json
	"nav": {
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
		"list": "Lista",
		"matrix": "Macierz",
		"settings": "Ustawienia"
	},
```

and replace:

```json
		"startPage": "Strona początkowa",
		"startPageList": "Lista",
		"startPageMatrix": "Macierz",
```

with:

```json
		"startPage": "Strona początkowa",
		"startPageDreams": "Marzenia",
		"startPageGoals": "Cele",
		"startPageList": "Lista",
		"startPageMatrix": "Macierz",
```

- [ ] **Step 4: Add the routes**

In `src/router/index.ts`, replace the import line:

```ts
import { mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
```

with:

```ts
import { mdiFlagOutline, mdiTelescope, mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
```

Then replace:

```ts
	{
		path: '/matrix',
		name: 'matrix',
		component: () => import('@/pages/MatrixPage/MatrixPage.vue'),
		meta: { startPage: { icon: mdiViewGridOutline, labelKey: 'settings.startPageMatrix' } },
	},
	{ path: '/sync', name: 'sync', component: () => import('@/pages/SyncPage/SyncPage.vue') },
```

with:

```ts
	{
		path: '/matrix',
		name: 'matrix',
		component: () => import('@/pages/MatrixPage/MatrixPage.vue'),
		meta: { startPage: { icon: mdiViewGridOutline, labelKey: 'settings.startPageMatrix' } },
	},
	{
		path: '/dreams',
		name: 'dreams',
		component: () => import('@/pages/DreamsPage/DreamsPage.vue'),
		meta: { startPage: { icon: mdiTelescope, labelKey: 'settings.startPageDreams' } },
	},
	{
		path: '/goals',
		name: 'goals',
		component: () => import('@/pages/GoalsPage/GoalsPage.vue'),
		meta: { startPage: { icon: mdiFlagOutline, labelKey: 'settings.startPageGoals' } },
	},
	{ path: '/sync', name: 'sync', component: () => import('@/pages/SyncPage/SyncPage.vue') },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/router/index.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Run the full suite and check `SettingsPage.test.ts` still passes**

Run: `npm test`
Expected: PASS — `SettingsPage.test.ts` only asserts against the first two `VSelect` items' behavior, not the full option count, so it is unaffected.

- [ ] **Step 7: Commit**

```bash
git add src/router/index.ts src/router/index.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add /dreams and /goals routes"
```

---

### Task 13: `BottomNav` — five-item layout

**Files:**

- Modify: `src/layouts/BottomNav.vue`
- Test: `src/layouts/BottomNav.test.ts`

**Interfaces:**

- Consumes: route names `dreams`, `goals`, `list`, `matrix` (all exist as of Task 12); `QuickAddFab` (existing component, unchanged in this task).
- Produces: no change to `BottomNav`'s own props/emits (it takes none). Renders five `v-btn` nav targets in the order Dreams, Goals, [+], List, Matrix.

- [ ] **Step 1: Write the failing test file**

`src/layouts/BottomNav.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import BottomNav from './BottomNav.vue';

async function mountAt(path: string) {
	setActivePinia(createPinia());
	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/list', name: 'list', component: { template: '<div />' } },
			{ path: '/matrix', name: 'matrix', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(BottomNav, { global: { plugins: [vuetify, i18n, testRouter] } });
}

describe('BottomNav', () => {
	it('renders all five nav targets plus the add button', async () => {
		const wrapper = await mountAt('/dreams');

		expect(wrapper.text()).toContain('Dreams');
		expect(wrapper.text()).toContain('Goals');
		expect(wrapper.text()).toContain('List');
		expect(wrapper.text()).toContain('Matrix');
		expect(wrapper.findComponent({ name: 'QuickAddFab' }).exists()).toBe(true);
	});

	it('highlights the current route among all five targets', async () => {
		const wrapper = await mountAt('/goals');

		const buttons = wrapper.findAllComponents({ name: 'VBtn' });
		const goalsButton = buttons.find((btn) => btn.text() === 'Goals');
		const dreamsButton = buttons.find((btn) => btn.text() === 'Dreams');

		expect(goalsButton?.props('color')).toBe('primary');
		expect(dreamsButton?.props('color')).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/layouts/BottomNav.test.ts`
Expected: FAIL — `wrapper.text()` doesn't contain "Dreams"/"Goals" yet.

- [ ] **Step 3: Implement the change**

Replace the full contents of `src/layouts/BottomNav.vue`:

```vue
<style lang="scss" module>
.bar {
	position: fixed;
	inset-inline: 0;
	bottom: 0;
	z-index: 1005;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.25rem;
	height: 4rem;
	padding-inline: 0.5rem;
	padding-bottom: env(safe-area-inset-bottom);
	background-color: rgb(var(--v-theme-surface));
	border-top: 1px solid rgb(var(--v-theme-outline));
}

.fabWrap {
	position: relative;
	top: -1.25rem;
}
</style>

<template>
	<nav :class="$style.bar">
		<v-btn
			:to="{ name: 'dreams' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiTelescope"
			:color="route.name === 'dreams' ? 'primary' : undefined"
		>
			{{ t('nav.dreams') }}
		</v-btn>

		<v-btn
			:to="{ name: 'goals' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiFlagOutline"
			:color="route.name === 'goals' ? 'primary' : undefined"
		>
			{{ t('nav.goals') }}
		</v-btn>

		<div :class="$style.fabWrap">
			<quick-add-fab />
		</div>

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

		<v-btn
			:to="{ name: 'matrix' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewGridOutline"
			:color="route.name === 'matrix' ? 'primary' : undefined"
		>
			{{ t('nav.matrix') }}
		</v-btn>
	</nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiFlagOutline, mdiTelescope, mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import QuickAddFab from '@/containers/QuickAddFab.vue';

const { t } = useI18n();
const route = useRoute();
</script>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/layouts/BottomNav.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BottomNav.vue src/layouts/BottomNav.test.ts
git commit -m "feat: expand BottomNav to five targets (Dreams, Goals, List, Matrix)"
```

---

### Task 14: `QuickAddFab` — route-aware

**Files:**

- Modify: `src/containers/QuickAddFab.vue`
- Test: `src/containers/QuickAddFab.test.ts`

**Interfaces:**

- Consumes: `DreamDialog` (Task 8), `GoalDialog` (Task 9), `useDreamsStore()`/`useGoalsStore()` (existing `.active`, `.add`), `useRoute()`.
- Produces: no change to `QuickAddFab`'s own external surface (no props/emits, mounted directly by `BottomNav`). On `/dreams` it opens a `DreamDialog` in `mode="add"`; on `/goals`, a `GoalDialog` in `mode="add"` with `dreamOptions` computed from `dreamsStore.active`; everywhere else it keeps opening `TaskForm`, unchanged.

- [ ] **Step 1: Write the failing test file**

`src/containers/QuickAddFab.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
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

async function mountAt(path: string, seed: { dreams?: Dream[] } = {}) {
	setActivePinia(createPinia());
	await useDreamsStore().load(async () => new EntityMemoryRepository<Dream>(seed.dreams ?? []));
	await useGoalsStore().load(async () => new EntityMemoryRepository<Goal>());
	await useTasksStore().load(async () => new EntityMemoryRepository<Task>());

	const testRouter = createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/dreams', name: 'dreams', component: { template: '<div />' } },
			{ path: '/goals', name: 'goals', component: { template: '<div />' } },
			{ path: '/list', name: 'list', component: { template: '<div />' } },
		],
	});
	await testRouter.push(path);
	await testRouter.isReady();

	return mount(QuickAddFab, { global: { plugins: [vuetify, i18n, testRouter] } });
}

beforeEach(() => {
	window.localStorage.clear();
});

describe('QuickAddFab route awareness', () => {
	it('opens a Dream-create dialog on /dreams', async () => {
		const wrapper = await mountAt('/dreams');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.text()).toContain('Dream');
		expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(false);
	});

	it('opens a Goal-create dialog on /goals', async () => {
		const wrapper = await mountAt('/goals');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.text()).toContain('Goal');
	});

	it('opens TaskForm everywhere else', async () => {
		const wrapper = await mountAt('/list');

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		expect(wrapper.text()).toContain('Add task');
	});
});

describe('QuickAddFab creating a dream', () => {
	it('adds a dream through the dreams store', async () => {
		const wrapper = await mountAt('/dreams');
		const dreams = useDreamsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');
		await wrapper.get('input').setValue('Visit Japan');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(dreams.records).toHaveLength(1);
		expect(dreams.records[0].name).toBe('Visit Japan');
	});
});

describe('QuickAddFab creating a goal', () => {
	it('adds a goal through the goals store, offering only active dreams', async () => {
		const wrapper = await mountAt('/goals', { dreams: [makeDream({ name: 'Visit Japan' })] });
		const goals = useGoalsStore();

		await wrapper.get('button[aria-label="Add task"]').trigger('click');

		const [select] = wrapper.findAllComponents({ name: 'VSelect' });
		expect((select.props('items') as Array<{ title: string }>).map((item) => item.title)).toEqual([
			'No dream',
			'Visit Japan',
		]);

		await wrapper.get('input').setValue('Learn Japanese');
		await select.vm.$emit('update:modelValue', 'dream-1');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(goals.records).toHaveLength(1);
		expect(goals.records[0]).toMatchObject({ name: 'Learn Japanese', dreamId: 'dream-1' });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/containers/QuickAddFab.test.ts`
Expected: FAIL — every scenario opens `TaskForm` regardless of route.

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

	<dream-dialog
		v-if="route.name === 'dreams'"
		v-model="dialogOpen"
		mode="add"
		@save="handleDreamSave"
	/>
	<goal-dialog
		v-else-if="route.name === 'goals'"
		v-model="dialogOpen"
		mode="add"
		:dream-options="dreamOptions"
		@save="handleGoalSave"
	/>
	<task-form v-else v-model="dialogOpen" @submit="handleTaskSubmit" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiPlus } from '@mdi/js';
import TaskForm from '@/components/TaskForm.vue';
import DreamDialog from '@/components/DreamDialog.vue';
import GoalDialog from '@/components/GoalDialog.vue';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';

const { t } = useI18n();
const route = useRoute();
const tasksStore = useTasksStore();
const dreamsStore = useDreamsStore();
const goalsStore = useGoalsStore();

const dialogOpen = ref(false);

const dreamOptions = computed(() =>
	dreamsStore.active.map((dream) => ({ value: dream.id, title: dream.name })),
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
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/containers/QuickAddFab.vue src/containers/QuickAddFab.test.ts
git commit -m "feat: make QuickAddFab route-aware for Dreams and Goals"
```

---

### Task 15: Final verification

**Files:** none (verification only; fixes go into whichever file the failure points at).

**Interfaces:** none.

- [ ] **Step 1: Run the full unit/component test suite**

Run: `npm test`
Expected: PASS, all files including every one added in Tasks 1–14.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors. If `vue/block-order` or an unused-import rule flags anything, fix it directly (e.g. `npm run lint:fix` for mechanical issues) rather than suppressing the rule.

- [ ] **Step 3: Run the type-checked production build**

Run: `npm run build`
Expected: `vue-tsc --noEmit` passes (this is what actually exercises the generic `EntityList.vue` component and every new dynamic `import()` in `router/index.ts`) and the Vite build completes.

- [ ] **Step 4: Run the Playwright e2e suite**

Run: `npm run test:e2e`
Expected: PASS unchanged — this stage adds no e2e coverage (the spec defers all manual/browser verification for stage 6 to its end), but the existing suite must not regress against the new routes/nav layout.

- [ ] **Step 5: Format check**

Run: `npm run format`
Expected: exits clean (Prettier writes only if something drifted from tabs/single-quotes/100-width; if it rewrites any file, `git diff` it, then re-run Steps 1–4).

- [ ] **Step 6: Update CLAUDE.md's Process section**

In `.claude/CLAUDE.md`, replace the sentence:

```
Dedicated dream and goal pages, deadline and recurrence UI, and completion history are not built yet; today the list and matrix pages just read and write the new `Task` store where they used to read and write `Todo`.
```

with:

```
Dedicated dream and goal pages are done too (see `docs/superpowers/specs/2026-08-17-stage-3-dream-goal-pages-design.md`): `/dreams` and `/goals` with Active/History tabs, a shared view-and-edit dialog, and cascading cancel. The unified add dialog, the `/list` → `/tasks` rename, a `goalId` picker on tasks, deadline UI, recurrence UI, and completion history are still not built.
```

- [ ] **Step 7: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs: mark stage 6 stage 3 (dream & goal pages) done in CLAUDE.md"
```

Do not merge to `main`, push, or add a remote — stay on `stage-6-dreams-goals-tasks` per standing instructions, and hand control back for the next stage (or the deferred full-stage manual QA pass) once this is committed.
