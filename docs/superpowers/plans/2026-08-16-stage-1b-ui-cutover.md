# Stage 1b: UI Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every page, container, service and test off the `Todo` stack onto the dream/goal/task stores built in stage 1a, then delete the old stack entirely.

**Architecture:** Stage 1a built the new data layer beside the old one and wired it to nothing. This stage reverses that: the UI, the backup format and the sync envelope all move to the new stores, and `types/todo.ts`, `stores/todos.ts`, `repositories/TodoStorage.ts`, `repositories/IndexedDbRepository.ts` and `repositories/InMemoryRepository.ts` are removed. The visible app does not change shape — two pages, a list and a matrix, at the same routes. Dream and goal *pages* arrive in stages 3 and 4; here the two new stores exist, load, back up and sync, but nothing renders them.

**Interim breakage, known and accepted.** Task 2 moves everything that *writes* onto the task store while `BackupActions` and `SyncFlow` still read the old `todos` store. From that moment the old store is loaded but never written, so `e2e/sync.spec.ts` — which adds a task through the UI on one device and expects it on the other after a pairing — cannot pass until task 4 rewires the exchange. It fails between task 2 and task 4 and is expected to.

The first draft of this plan claimed the opposite, and the temporary `void todos.load()` line in `DefaultLayout` was justified by it. That line no longer preserves anything: loading a store nothing writes to yields an empty list either way. It stays only because removing it early would mean editing `DefaultLayout` twice, and task 5 removes it with the store it feeds.

Everything else stays green throughout: unit tests, lint, build and the other eight e2e tests.

**Tech Stack:** Vue 3.5, Pinia 4, Vuetify 4.1, vue-i18n 11, Vitest 4, `fake-indexeddb`, Playwright.

**Spec:** [docs/superpowers/specs/2026-08-16-dreams-goals-tasks-design.md](../specs/2026-08-16-dreams-goals-tasks-design.md)

**Previous stage:** [docs/superpowers/plans/2026-08-16-stage-1a-data-layer.md](2026-08-16-stage-1a-data-layer.md)

## Global Constraints

- Every file in the repository is English — code, comments, docs, commit messages. Only `src/i18n/locales/*.json` may be otherwise.
- Formatting: tabs, `tabWidth: 2`, single quotes, `printWidth: 100`, `trailingComma: all`. Run `npm run format` before committing if unsure.
- SFC block order is **style → template → script**, enforced by `vue/block-order`. Always `<style lang="scss" module>` and `<script setup lang="ts">`.
- Imports inside `src` use the `@/` alias; a file uses a relative import only for a sibling in the same folder.
- Prefer named exports. Every folder re-exports through an `index.ts` barrel.
- `services/` and `repositories/` know nothing about Vue or Pinia.
- Records written to storage must be plain, proxy-free copies. The store factory's `toStorable()` does this; never hand `storage.put` a value taken straight out of `records.value`.
- `updated` moves on every user-facing change — but **never** on garbage collection.
- Three locales exist and all three must stay complete: `en.json`, `ru.json`, `pl.json`. A key added to one is added to all three.
- After every task: `npm test`, `npm run lint` and `npm run build` must pass.
- `npm run test:e2e` must pass **fully** after tasks 4, 5 and 6. Between task 2 and task 4 exactly one test is expected to fail — `e2e/sync.spec.ts`, for the reason given under "Interim breakage" below. Every other e2e test must pass throughout.
- Do not add a git remote, do not push, do not deploy.

## Interfaces from stage 1a

The new stores, all built by `defineEntityStore` in `src/stores/createEntityStore.ts`:

```ts
// src/stores/dreams.ts
useDreamsStore(): { records: Dream[]; active: Dream[]; closed: Dream[]; loading: boolean;
	cleanupDays: number; load(); add(draft: DreamDraft); update(id, patch);
	close(id, status: Status.Done | Status.Cancelled); reopen(id); replaceAll(records) }

// src/stores/goals.ts — same, plus GoalDraft { name; note?; dreamId?; deadline? }
// src/stores/tasks.ts — same, plus quadrants, and
//   TaskDraft { name; note?; goalId?; important; urgent; schedule? }
export const QUADRANT_KEYS: readonly QuadrantKey[];
export function quadrantOf(task: Task): QuadrantKey;
export function quadrantFlags(key: QuadrantKey): { important: boolean; urgent: boolean };

// src/stores/storage.ts
useStorageStore(): { persistent: boolean; lastError: string | null;
	noteAvailable(); noteUnavailable(); noteWriteFailure(); noteLoadSkipped(count); dismissError() }
```

`Status` is a real enum from `@/types`: `Opened = 1`, `Done = 2`, `Cancelled = 3`. There is no `deleted` flag — a closed record is its own tombstone.

---

### Task 1: The new i18n key set

Purely additive: every new key lands in all three locales while the old `todo.*` and `period.*` keys stay in place, so nothing breaks and the next task can switch over one component at a time. The obsolete keys are deleted in task 5.

**Files:**

- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: nothing.
- Produces: the keys below. Later tasks reference them by exact path.

- [ ] **Step 1: Add the new keys to `en.json`**

Insert a `task` block after the existing `todo` block, extend `storage`, and extend `backup`. Leave `todo` and `period` untouched.

```json
	"storage": {
		"unavailable": "Persistent storage is unavailable. Changes will be lost when you close the app.",
		"writeFailed": "Could not save the change.",
		"recordsSkipped": "Some records could not be read and were skipped. They are still in the file you can export."
	},
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
	"form": {
		"add": "Add task",
		"edit": "Edit task",
		"save": "Save",
		"cancel": "Cancel",
		"nameRequired": "Name is required"
	},
```

The `backup.*` copy stays as it is here. Rewording it belongs to task 3, which updates `BackupActions.test.ts` in the same commit — that test asserts the English strings verbatim, so changing the copy on its own turns the suite red.

`storage.recordsSkipped` may already exist if the stage 1a fix round added it. If so, leave it as it is — do not reword it.

- [ ] **Step 2: Mirror the same keys in `ru.json`**

```json
	"storage": {
		"recordsSkipped": "Часть записей не удалось прочитать, они пропущены. В файле экспорта они остаются."
	},
	"task": {
		"name": "Название",
		"note": "Заметка",
		"created": "Создано",
		"important": "Важное",
		"urgent": "Срочное",
		"done": "Выполнено",
		"actions": "Действия",
		"cancel": "Отменить задачу"
	},
	"form": {
		"nameRequired": "Название обязательно"
	}
```

Merge these into the existing blocks rather than replacing them — the snippet above lists only what is new.

The Russian locale calls a task «дело» throughout. The new `task.*` block uses «задача» instead, because that is what the entity is now called in the model, and the `todo.*` block that holds the old wording disappears in task 5. Bring `form.add`, `form.edit` and `list.empty` along with it so the register stays uniform: «Новая задача», «Изменить задачу», «Задач пока нет. Заведи первую.»

- [ ] **Step 3: Mirror the same keys in `pl.json`**

```json
	"storage": {
		"recordsSkipped": "Części rekordów nie udało się odczytać i zostały pominięte. W pliku eksportu nadal są."
	},
	"task": {
		"name": "Nazwa",
		"note": "Notatka",
		"created": "Utworzono",
		"important": "Ważne",
		"urgent": "Pilne",
		"done": "Zrobione",
		"actions": "Akcje",
		"cancel": "Anuluj zadanie"
	},
	"form": {
		"nameRequired": "Nazwa jest wymagana"
	}
```

- [ ] **Step 4: Verify all three locales carry the same key set**

Run: `npm run build`

Expected: PASS. There is no automated key-parity check in this project, so compare the three files by eye: every path added above must exist in all three.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/locales
git commit -m "i18n: add the entity key set alongside the todo keys"
```

---

### Task 2: Move the layout, the list and the matrix onto the task store

The big one, and it is atomic on purpose: `DefaultLayout` decides which stores get loaded, so the pages that read those stores have to move with it. Behaviour stays as close to today's as the new model allows — the two differences are named in step 1 and both follow the spec.

**Files:**

- Modify: `src/layouts/DefaultLayout.vue`
- Rename + modify: `src/pages/TodoListPage/containers/TodoTable.vue` → `src/pages/TodoListPage/containers/TasksTable.vue`
- Modify: `src/pages/TodoListPage/TodoListPage.vue`
- Rename + modify: `src/components/TodoForm.vue` → `src/components/TaskForm.vue`
- Modify: `src/containers/QuickAddFab.vue`
- Modify: `src/pages/MatrixPage/containers/MatrixBoard.vue`
- Rename + modify: `src/pages/MatrixPage/TodoQuadrant.vue` → `src/pages/MatrixPage/TaskQuadrant.vue`
- Rename + modify: `src/components/TodoForm.test.ts` → `src/components/TaskForm.test.ts`
- Rename + modify: `src/pages/MatrixPage/TodoQuadrant.test.ts` → `src/pages/MatrixPage/TaskQuadrant.test.ts`
- Modify: `src/pages/MatrixPage/containers/MatrixBoard.test.ts`
- Modify: `e2e/todo-crud.spec.ts`, `e2e/sync.spec.ts`

There is no `TodoTable.test.ts` — the table has never had a component test, and this task does not add one; the list page is covered end to end.

Keep the folder names `TodoListPage/` and the routes `/list`, `/matrix` — renaming routes is stage 5, and doing it here would churn the e2e suite twice.

**Interfaces:**

- Consumes: `useTasksStore`, `useDreamsStore`, `useGoalsStore`, `useStorageStore`, `TaskDraft`, `Status`, `quadrantFlags`, `QUADRANT_KEYS` (stage 1a).
- Produces: `TaskForm.vue` emitting `submit: [draft: TaskDraft]`; `TasksTable.vue` and `TaskQuadrant.vue` as the list/matrix containers. Task 3 and 4 rely on all three entity stores being loaded by `DefaultLayout`.

- [ ] **Step 1: Note the two deliberate behaviour changes**

No code in this step — these are the decisions the rest of the task implements, written down so the reviewer can check them rather than rediscover them.

1. **The period field disappears from the UI.** `Task` has no `period`; it is derived from `schedule`, and the schedule editor is stage 7. The form's period select and the table's Period column both go. Nothing replaces them yet.
2. **The matrix shows only open tasks.** `quadrants` is built from `active`, so checking a task off makes it leave its quadrant instead of staying struck through. The spec asks for exactly this ("in the matrix only `Opened`"). The list page keeps showing done tasks struck through, so the strikethrough behaviour is not lost, only moved.

The checkbox and the delete button map onto the lifecycle like this, everywhere they appear:

| Old | New |
| --- | --- |
| `store.toggleDone(id)`, checked | `store.close(id, Status.Done)` |
| `store.toggleDone(id)`, unchecked | `store.reopen(id)` |
| `store.remove(id)` | `store.close(id, Status.Cancelled)` |
| `todo.done` | `task.status === Status.Done` |
| `!todo.deleted` | `task.status !== Status.Cancelled` |

- [ ] **Step 2: Update the e2e suite to the new labels**

Two spec files fill a field labelled `Title`; the label is now `Name`. Replace every `getByLabel('Title')` with `getByLabel('Name')` in **both** `e2e/todo-crud.spec.ts` and `e2e/sync.spec.ts` (the latter has one, on the line that types `Buy milk`). Leave every other selector alone — `Add task`, `Save`, `This device starts`, the task titles and the `Do` quadrant lookup are all unchanged.

Then check `todo-crud.spec.ts` for anything that asserts on the Period column; if a test reads it, delete that assertion.

- [ ] **Step 3: Run the e2e suite to watch it fail**

Run: `npm run test:e2e`

Expected: FAIL. The tests that fill `Name` cannot find the field, because the form still renders `Title`. This is the guard for the rest of the task.

- [ ] **Step 4: Rewrite the form as `TaskForm.vue`**

`git mv src/components/TodoForm.vue src/components/TaskForm.vue`, then change the script and the template. The whole script block:

```ts
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TaskDraft } from '@/stores/tasks';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TaskDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'add' },
);

const emit = defineEmits<{ submit: [draft: TaskDraft] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const important = ref(false);
const urgent = ref(false);
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
	important.value = props.initial.important ?? false;
	urgent.value = props.initial.urgent ?? false;
	showErrors.value = false;
});

function submit(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('submit', {
		name: name.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: important.value,
		urgent: urgent.value,
	});

	open.value = false;
}
```

In the template, rename the field bindings and drop the period select entirely:

```html
				<v-text-field
					v-model="name"
					:label="t('task.name')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="submit"
				/>

				<v-textarea v-model="note" :label="t('task.note')" rows="3" />

				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('task.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('task.urgent')" color="primary" hide-details />
				</div>
```

- [ ] **Step 5: Rewrite the table as `TasksTable.vue`**

`git mv src/pages/TodoListPage/containers/TodoTable.vue src/pages/TodoListPage/containers/TasksTable.vue`. Script:

```ts
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataTableHeader } from 'vuetify';
import { mdiCheck, mdiDeleteOutline } from '@mdi/js';
import TaskForm from '@/components/TaskForm.vue';
import { Status, type Task } from '@/types';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';

const { t, locale } = useI18n();
const store = useTasksStore();

const dialogOpen = ref(false);
const editing = ref<Task | null>(null);

/**
 * Cancelled tasks are what the old `deleted` flag used to hide; done tasks
 * stay visible and struck through, exactly as before. The History tab that
 * gives cancelled records a home of their own arrives in stage 5.
 */
const visible = computed(() => store.records.filter((task) => task.status !== Status.Cancelled));

const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent } = editing.value;

	return { name, note, important, urgent };
});

function onRowClick(_event: Event, context: { item: Task }): void {
	editing.value = context.item;
	dialogOpen.value = true;
}

async function handleSubmit(draft: TaskDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await store.update(editing.value.id, draft);
	editing.value = null;
}

async function onDoneChanged(task: Task): Promise<void> {
	if (task.status === Status.Done) {
		await store.reopen(task.id);
		return;
	}

	await store.close(task.id, Status.Done);
}

const headers = computed<DataTableHeader[]>(() => [
	{ title: t('task.done'), key: 'done', sortable: false, width: 56 },
	{ title: t('task.name'), key: 'name' },
	{ title: t('task.important'), key: 'important' },
	{ title: t('task.urgent'), key: 'urgent' },
	{ title: t('task.created'), key: 'created' },
	{ title: t('task.actions'), key: 'actions', sortable: false, align: 'end' },
]);

function formatDate(value: string): string {
	return new Date(value).toLocaleString(locale.value);
}
```

Template — `:items="visible"`, the period column removed, and the two lifecycle actions rewired:

```html
			<template #[`item.done`]="{ item }">
				<v-checkbox-btn
					:model-value="item.status === Status.Done"
					:aria-label="t('task.done')"
					@click.stop
					@update:model-value="onDoneChanged(item)"
				/>
			</template>

			<template #[`item.name`]="{ item }">
				<span :class="item.status === Status.Done ? $style.doneRow : undefined">
					{{ item.name }}
				</span>
			</template>
```

```html
			<template #[`item.actions`]="{ item }">
				<v-btn
					:icon="mdiDeleteOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('task.cancel')"
					@click.stop="store.close(item.id, Status.Cancelled)"
				/>
			</template>
```

and the form at the bottom becomes `<task-form v-model="dialogOpen" :initial="initialDraft" mode="edit" @submit="handleSubmit" />`.

`Status` is used in the template, so it must be imported into the setup scope as a value — the import above already does that (`import { Status, type Task }`), do not turn it into a type-only import.

- [ ] **Step 6: Point the page at the renamed container**

`src/pages/TodoListPage/TodoListPage.vue` becomes:

```html
<template>
	<tasks-table />
</template>

<script setup lang="ts">
import TasksTable from './containers/TasksTable.vue';
</script>
```

- [ ] **Step 7: Rewrite the quadrant as `TaskQuadrant.vue`**

`git mv src/pages/MatrixPage/TodoQuadrant.vue src/pages/MatrixPage/TaskQuadrant.vue`. Only the item type and the checkbox change; the quadrant now holds open tasks only, so the checkbox is always unchecked and checking it closes the task.

Script:

```ts
import { useI18n } from 'vue-i18n';
import { mdiPlus } from '@mdi/js';
import type { Task } from '@/types';
import type { QuadrantKey } from '@/stores/tasks';

defineProps<{
	quadrant: QuadrantKey;
	items: Task[];
	icon: string;
	accent?: boolean;
}>();

const emit = defineEmits<{
	add: [quadrant: QuadrantKey];
	done: [id: string];
}>();

const { t } = useI18n();
```

Template list section:

```html
			<v-list-item v-for="task in items" :key="task.id">
				<template #prepend>
					<v-checkbox-btn
						:model-value="false"
						:aria-label="t('task.done')"
						@update:model-value="emit('done', task.id)"
					/>
				</template>

				<v-list-item-title>{{ task.name }}</v-list-item-title>
			</v-list-item>
```

Drop the now-unused `.done` class from the style block.

- [ ] **Step 8: Rewire `MatrixBoard.vue`**

```ts
import { ref } from 'vue';
import {
	mdiAccountArrowRightOutline,
	mdiCalendarClockOutline,
	mdiFire,
	mdiTrashCanOutline,
} from '@mdi/js';
import TaskForm from '@/components/TaskForm.vue';
import TaskQuadrant from '../TaskQuadrant.vue';
import { Status } from '@/types';
import {
	QUADRANT_KEYS,
	quadrantFlags,
	useTasksStore,
	type QuadrantKey,
	type TaskDraft,
} from '@/stores/tasks';

const store = useTasksStore();

const dialogOpen = ref(false);
const initialDraft = ref<Partial<TaskDraft>>({});

const quadrantMeta: Record<QuadrantKey, { icon: string; accent?: boolean }> = {
	do: { icon: mdiFire, accent: true },
	schedule: { icon: mdiCalendarClockOutline },
	delegate: { icon: mdiAccountArrowRightOutline },
	eliminate: { icon: mdiTrashCanOutline },
};

function openFor(quadrant: QuadrantKey): void {
	initialDraft.value = quadrantFlags(quadrant);
	dialogOpen.value = true;
}
```

In the template, `<todo-quadrant>` becomes `<task-quadrant>`, the `@toggle` handler becomes `@done="store.close($event, Status.Done)"`, and `<todo-form>` becomes `<task-form>`.

`quadrantFlags` returns `{ important, urgent }` — a plain object literal, not reactive — so it is safe to hand to the form as an initial draft.

- [ ] **Step 9: Rewire `QuickAddFab.vue`**

Swap the import to `TaskForm` and the store to `useTasksStore`; `handleSubmit` still calls `store.add(draft)`, now typed `TaskDraft`. Nothing else changes.

- [ ] **Step 10: Move `DefaultLayout.vue` onto the storage store**

Replace the `useTodosStore` import and its uses:

```ts
import { useStorageStore } from '@/stores/storage';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useTodosStore } from '@/stores/todos';

const store = useStorageStore();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
// Temporary: BackupActions and SyncFlow still read the old store, and an
// unloaded store would silently export and sync an empty list. Both move in
// tasks 3 and 4; this line and the store behind it go in task 5.
const todos = useTodosStore();
```

```ts
onMounted(() => {
	void dreams.load();
	void goals.load();
	void tasks.load();
	void todos.load();
	void storagePersistence.request();
});
```

`store.persistent`, `store.lastError` and `store.dismissError()` in the template and the snackbar computeds now resolve against `useStorageStore` and need no further edits.

- [ ] **Step 11: Move the component tests with their components**

Three unit tests mount the components this task rewrote and will fail on the old names and props:

- `git mv src/components/TodoForm.test.ts src/components/TaskForm.test.ts` — mount `TaskForm`, drive the field labelled by `task.name`, drop every assertion about the period select, and expect the emitted draft to carry `name` rather than `title`.
- `git mv src/pages/MatrixPage/TodoQuadrant.test.ts src/pages/MatrixPage/TaskQuadrant.test.ts` — mount `TaskQuadrant` with `Task` fixtures, and replace the `toggle` event assertion with `done`.
- `src/pages/MatrixPage/containers/MatrixBoard.test.ts` — the board now reads `useTasksStore`; update the fixtures and any stubbed store, and expect a checked item to call `close(id, Status.Done)` rather than `toggleDone(id)`.

Read each file before rewriting it and keep its existing shape — same helpers, same mounting style. These are edits, not rewrites from scratch.

- [ ] **Step 12: Run the unit tests**

Run: `npm test`

Expected: PASS. `src/stores/todos.test.ts` still exists and still passes — the store it tests is untouched until task 5.

- [ ] **Step 13: Run the e2e suite**

Run: `npm run test:e2e`

Expected: PASS, 9/9, including `a task survives a page reload` — the guard that proves no reactive proxy reached IndexedDB.

If `an important and urgent task lands in the Do quadrant` fails on a locator timeout, re-run it once before investigating: that test has a known intermittent failure on this machine, documented in the stage 1a ledger.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: move the list and matrix onto the task store"
```

---

### Task 3: Backup format version 3

**Files:**

- Modify: `src/services/backup/BackupService.ts`
- Modify: `src/services/backup/BackupService.test.ts`
- Modify: `src/services/backup/BackupFile.ts`
- Modify: `src/containers/BackupActions.vue`
- Modify: `src/containers/BackupActions.test.ts`
- Modify: `src/i18n/locales/en.json`, `ru.json`, `pl.json` (the `backup.*` copy)

**Interfaces:**

- Consumes: `parseDream`, `parseGoal`, `parseTask`, `EntityFormatError` from `@/types`; the three entity stores.
- Produces: `BACKUP_VERSION = 3`, `interface Backup`, `BackupService.create(dreams, goals, tasks)`, `BackupService.parse(text): Backup`.

- [ ] **Step 1: Write the failing tests**

Replace the existing suite in `src/services/backup/BackupService.test.ts`. Keep whatever helper style the file already uses; these are the cases that must exist:

```ts
it('creates a version 3 backup holding all three collections', () => {
	const backup = backupService.create([dream], [goal], [task]);

	expect(backup.version).toBe(3);
	expect(backup.dreams).toEqual([dream]);
	expect(backup.goals).toEqual([goal]);
	expect(backup.tasks).toEqual([task]);
	expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false);
});

it('includes closed records', () => {
	const closed = { ...task, status: Status.Cancelled };
	expect(backupService.create([], [], [closed]).tasks).toEqual([closed]);
});

it('reads a version 3 file back', () => {
	const text = JSON.stringify(backupService.create([dream], [goal], [task]));
	const parsed = backupService.parse(text);

	expect(parsed.dreams).toEqual([dream]);
	expect(parsed.goals).toEqual([goal]);
	expect(parsed.tasks).toEqual([task]);
});

it('rejects a version 1 or 2 file', () => {
	for (const version of [1, 2]) {
		const text = JSON.stringify({ version, exportedAt: '', todos: [] });
		expect(() => backupService.parse(text)).toThrow(BackupFormatError);
	}
});

it('rejects a file newer than this app', () => {
	expect(() => backupService.parse(JSON.stringify({ version: 4 }))).toThrow(BackupFormatError);
});

it('names the collection and the index of a broken record', () => {
	const text = JSON.stringify({
		version: 3,
		exportedAt: '',
		dreams: [],
		goals: [],
		tasks: [{ id: 'a' }],
	});

	expect(() => backupService.parse(text)).toThrow(/tasks.*0/);
});

it('rejects a file that is not JSON', () => {
	expect(() => backupService.parse('{')).toThrow(BackupFormatError);
});
```

- [ ] **Step 2: Run them to watch them fail**

Run: `npm test -- src/services/backup/BackupService.test.ts`

Expected: FAIL — `create` takes one argument, `BACKUP_VERSION` is 2, and there is no `dreams` key anywhere.

- [ ] **Step 3: Rewrite `BackupService.ts`**

`readTodo` and the `PERIODS` guard go entirely; the parsers in `types/` are the single source of validation now.

```ts
import {
	EntityFormatError,
	parseDream,
	parseGoal,
	parseTask,
	type Dream,
	type Goal,
	type Task,
} from '@/types';

export const BACKUP_VERSION = 3;

export interface Backup {
	version: number;
	/** ISO 8601 timestamp in UTC. */
	exportedAt: string;
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}

export class BackupFormatError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'BackupFormatError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Wraps the shared parsers so a bad record reports where it is. The parsers
 * already say what is wrong with it; only its address has to be added.
 */
function readAll<T>(raw: unknown, collection: string, parse: (value: unknown) => T): T[] {
	if (!Array.isArray(raw)) {
		throw new BackupFormatError(`The backup has no "${collection}" list`);
	}

	return raw.map((value, index) => {
		try {
			return parse(value);
		} catch (error) {
			if (error instanceof EntityFormatError) {
				throw new BackupFormatError(`${collection}[${index}] is invalid: ${error.message}`);
			}

			throw error;
		}
	});
}

export class BackupService {
	create(dreams: Dream[], goals: Goal[], tasks: Task[]): Backup {
		return {
			version: BACKUP_VERSION,
			exportedAt: new Date().toISOString(),
			// Closed records are included on purpose: a backup restores a complete
			// state, and dropping the tombstones would resurrect everything ever
			// finished or abandoned.
			dreams: dreams.map((dream) => ({ ...dream })),
			goals: goals.map((goal) => ({ ...goal })),
			tasks: tasks.map((task) => ({ ...task })),
		};
	}

	/**
	 * Parses and fully validates a backup file. Callers may only touch storage
	 * after this returns: a malformed file must never cost the user their data.
	 */
	parse(text: string): Backup {
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			throw new BackupFormatError('The file is not valid JSON');
		}

		if (!isRecord(raw)) {
			throw new BackupFormatError('The file does not contain a backup object');
		}

		if (typeof raw.version !== 'number') {
			throw new BackupFormatError('The backup has no version');
		}

		// Versions 1 and 2 held a single `todos` list against a model this app no
		// longer has. Guessing at a migration would invent dreams and goals that
		// were never written, so the file is refused instead.
		if (raw.version !== BACKUP_VERSION) {
			throw new BackupFormatError(
				`This app reads backup version ${BACKUP_VERSION} only, and the file is version ${raw.version}`,
			);
		}

		return {
			version: raw.version,
			exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : '',
			dreams: readAll(raw.dreams, 'dreams', parseDream),
			goals: readAll(raw.goals, 'goals', parseGoal),
			tasks: readAll(raw.tasks, 'tasks', parseTask),
		};
	}
}

export const backupService = new BackupService();
```

- [ ] **Step 4: Run the tests to watch them pass**

Run: `npm test -- src/services/backup/BackupService.test.ts`

Expected: PASS.

- [ ] **Step 5: Update `BackupFile.ts` and `BackupActions.vue`**

`BackupFile.ts` only needs its type import changed from `TodoBackup` to `Backup`.

`BackupActions.vue`:

```ts
import type { Backup } from '@/services/backup/BackupService';
import { BackupFormatError, backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';

const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();

const pending = ref<Backup | null>(null);

const incomingCount = computed(() => {
	const backup = pending.value;

	return backup === null ? 0 : backup.dreams.length + backup.goals.length + backup.tasks.length;
});

const currentCount = computed(
	() => dreams.records.length + goals.records.length + tasks.records.length,
);

function exportFile(): void {
	// records, not active: a backup that omitted closed records would resurrect
	// everything ever finished or abandoned on the next restore.
	backupFile.download(backupService.create(dreams.records, goals.records, tasks.records));
	emit('notify', t('backup.exported'));
}

async function confirmImport(): Promise<void> {
	const backup = pending.value;
	if (!backup) {
		return;
	}

	confirmOpen.value = false;
	pending.value = null;

	await dreams.replaceAll(backup.dreams);
	await goals.replaceAll(backup.goals);
	await tasks.replaceAll(backup.tasks);

	emit('notify', t('backup.restored', { count: incomingTotal(backup) }));
}

function incomingTotal(backup: Backup): number {
	return backup.dreams.length + backup.goals.length + backup.tasks.length;
}
```

In the template, `store.items.length` becomes `currentCount`.

- [ ] **Step 6: Reword the backup copy in all three locales**

The dialog now counts records of three kinds, not tasks. In `en.json`:

```json
		"confirmTitle": "Replace everything?",
		"confirmBody": "Records in the file: {incoming}. Records to be deleted: {current}. This cannot be undone.",
		"restored": "Restored from the file. Records: {count}.",
```

`ru.json`:

```json
		"confirmTitle": "Заменить всё?",
		"confirmBody": "Записей в файле: {incoming}. Будет удалено записей: {current}. Отменить это будет нельзя.",
		"restored": "Восстановлено из файла. Записей: {count}.",
```

`pl.json`:

```json
		"confirmTitle": "Zastąpić wszystko?",
		"confirmBody": "Rekordów w pliku: {incoming}. Rekordów do usunięcia: {current}. Tej operacji nie można cofnąć.",
		"restored": "Przywrócono z pliku. Rekordów: {count}.",
```

This lands here rather than in task 1 for a reason: `BackupActions.test.ts` asserts `Tasks in the file: 1` verbatim, so the copy and the test have to move in one commit or the suite goes red between them.

- [ ] **Step 7: Update `BackupActions.test.ts`**

Read it first and keep its shape. What has to change: the stubbed store becomes the three entity stores, the exported file is asserted to be version 3 with `dreams`/`goals`/`tasks` arrays, and the restore path is expected to call `replaceAll` on all three. The assertion on the confirmation copy moves to the new `Records in the file:` wording from the previous step.

- [ ] **Step 8: Run the checks**

Run: `npm test`, then `npm run lint`, then `npm run build`

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: backup format version 3"
```

---

### Task 4: The sync envelope and the three-collection exchange

**Files:**

- Modify: `src/services/sync/SyncConnection.ts` — it has no unit test today (WebRTC is exercised end to end instead) and this task does not add one
- Modify: `src/pages/SyncPage/containers/SyncFlow.vue`
- Modify: `src/pages/SyncPage/containers/SyncFlow.test.ts`
- Modify: `src/i18n/locales/en.json`, `ru.json`, `pl.json`
- Modify: `e2e/sync.spec.ts`

**Interfaces:**

- Consumes: `syncMerger.merge`, `syncMerger.mergeTasks`, `collectGarbage`, `pruneCompletions`, the three stores.
- Produces: `SYNC_SCHEMA = 3`, `interface SyncDataPayload`, `SyncConnection.exchange(payload: SyncDataPayload): Promise<SyncDataPayload>`.

- [ ] **Step 1: Add the envelope to `SyncConnection.ts`**

Replace the `Todo` import and the `exchange` method. The settings mode from the spec is stage 2's; only the `data` kind exists here, but the `kind` discriminator goes in now so stage 2 adds a variant rather than a breaking change.

```ts
import type { Dream, Goal, Task } from '@/types';

export const SYNC_SCHEMA = 3;

export interface SyncDataPayload {
	schema: number;
	kind: 'data';
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}
```

```ts
	/** Sends our records and resolves with theirs. */
	async exchange(payload: SyncDataPayload): Promise<SyncDataPayload> {
		const open = await this.channelReady;
		const body = JSON.stringify(payload);

		if (body.length > MAX_PAYLOAD_BYTES) {
			throw new SyncError('The list is too large to send in one go');
		}

		const incoming = new Promise<SyncDataPayload>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new SyncError('The other device sent nothing')),
				CONNECT_TIMEOUT_MS,
			);

			open.addEventListener('message', (event: MessageEvent<string>) => {
				clearTimeout(timer);
				try {
					const parsed = JSON.parse(event.data) as Partial<SyncDataPayload>;

					// The schema check comes before anything is read. Without it a
					// device on an older build would merge a shape it does not
					// understand and destroy data on both sides.
					if (parsed.schema !== SYNC_SCHEMA) {
						reject(new SyncError('The other device runs a different version. Update it and retry.'));
						return;
					}

					if (
						!Array.isArray(parsed.dreams) ||
						!Array.isArray(parsed.goals) ||
						!Array.isArray(parsed.tasks)
					) {
						reject(new SyncError('The other device sent something unexpected'));
						return;
					}

					resolve(parsed as SyncDataPayload);
				} catch {
					reject(new SyncError('The other device sent something unexpected'));
				}
			});
		});

		open.send(body);

		return incoming;
	}
```

- [ ] **Step 2: Rewrite `runExchange` in `SyncFlow.vue`**

The three collections merge with the same rule except tasks, which use `mergeTasks` so per-occurrence completion marks survive. Collection runs on the merged result before it is written, so what was just collected does not land back on disk.

```ts
import type { EntityBase } from '@/types';
import { SyncConnection, SYNC_SCHEMA } from '@/services/sync/SyncConnection';
import { syncMerger } from '@/services/sync/SyncMerger';
import { collectGarbage, pruneCompletions } from '@/utils';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';

const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
```

```ts
/** Both sides run this; each sends everything it has and merges what arrives. */
async function runExchange(): Promise<void> {
	if (!connection) {
		return;
	}

	try {
		const before = new Map(
			[...dreams.records, ...goals.records, ...tasks.records].map((record) => [
				record.id,
				record.updated,
			]),
		);

		const theirs = await connection.exchange({
			schema: SYNC_SCHEMA,
			kind: 'data',
			dreams: [...dreams.records],
			goals: [...goals.records],
			tasks: [...tasks.records],
		});

		const now = new Date();
		const mergedDreams = sweep(syncMerger.merge([...dreams.records], theirs.dreams), now);
		const mergedGoals = sweep(syncMerger.merge([...goals.records], theirs.goals), now);
		const mergedTasks = sweep(
			syncMerger.mergeTasks([...tasks.records], theirs.tasks),
			now,
		).map((task) => pruneCompletions(task, tasks.cleanupDays, now));

		const merged = [...mergedDreams, ...mergedGoals, ...mergedTasks];

		result.value = {
			added: merged.filter((record) => !before.has(record.id)).length,
			updated: merged.filter((record) => {
				const was = before.get(record.id);
				return was !== undefined && was !== record.updated;
			}).length,
		};

		await dreams.replaceAll(mergedDreams);
		await goals.replaceAll(mergedGoals);
		await tasks.replaceAll(mergedTasks);

		step.value = 'done';
		connection.close();
		connection = null;
	} catch (error) {
		fail(error);
	}
}

/**
 * Collection runs on the merged result rather than after it is written: a
 * record the other device still holds past our window would otherwise land on
 * disk and be swept only on the next load, one write too late.
 *
 * The three stores share one `cleanupDays`, so any of them can supply it.
 */
function sweep<T extends EntityBase>(records: T[], now: Date): T[] {
	return collectGarbage(records, tasks.cleanupDays, now).keep;
}
```

Note what `sweep` deliberately drops: `collectGarbage` also returns `purge`, the ids to erase. `replaceAll` clears the store first and rewrites what it is given, so a purged record disappears from storage anyway — there is nothing left to remove.

- [ ] **Step 3: Add the schema-mismatch string to the three locales**

The message thrown by `SyncConnection` reaches the user through `sync.failed`, which already interpolates `{reason}`, so no new key is required — but the thrown text is English and `services/` must not import i18n. Leave it as it is and note the limitation in the report; translating service-level errors is not in this stage's scope and no other service does it either.

- [ ] **Step 4: Confirm the e2e sync test still describes reality**

`e2e/sync.spec.ts` pairs two browser contexts, adds `Buy milk` on one and asserts it appears on the other. Its `Title` label was already renamed in task 2; every other selector goes through visible strings this task does not touch. Re-read the file once and change nothing unless a selector is genuinely stale — the point of this step is to notice a break, not to invent one.

- [ ] **Step 5: Update `SyncFlow.test.ts`**

Read it first and keep its shape. What has to change: the stubbed store becomes the three entity stores; the fake connection's `exchange` now receives and returns a `SyncDataPayload` rather than a bare array; and the added/updated counters are asserted across all three collections. Add one case the old suite could not have: a payload whose `schema` is not 3 must fail the exchange rather than merge — that guard is the whole reason the envelope exists.

- [ ] **Step 6: Run everything**

Run: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`

Expected: all PASS, e2e 9/9.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: sync three collections behind a schema-versioned envelope"
```

---

### Task 5: Delete the old stack

Nothing imports it any more. This task proves that by removing it.

**Files:**

- Delete: `src/types/todo.ts` (it has no test file of its own)
- Delete: `src/stores/todos.ts`, `src/stores/todos.test.ts`
- Delete: `src/repositories/TodoStorage.ts`, `src/repositories/IndexedDbRepository.ts`, `src/repositories/IndexedDbRepository.test.ts`, `src/repositories/InMemoryRepository.ts`, `src/repositories/InMemoryRepository.test.ts`
- Modify: `src/layouts/DefaultLayout.vue` (drop the temporary `todos` load)
- Modify: `src/stores/index.ts` (drop the `todos` re-export). `src/types/index.ts` never exported `todo.ts`, and `src/repositories/` has no barrel at all — verify both rather than editing them
- Modify: `src/i18n/locales/en.json`, `ru.json`, `pl.json` (drop `todo` and `period`)
- Modify: `src/vitestHelpers.ts` (if it builds `Todo` fixtures)

**Interfaces:**

- Consumes: nothing.
- Produces: nothing. This task only removes.

- [ ] **Step 1: Drop the temporary load from `DefaultLayout.vue`**

Remove the `useTodosStore` import, the `const todos = ...` line with its explanatory comment, and `void todos.load();` from `onMounted`.

- [ ] **Step 2: Delete the files**

```bash
git rm src/stores/todos.ts src/stores/todos.test.ts \
	src/types/todo.ts \
	src/repositories/TodoStorage.ts \
	src/repositories/IndexedDbRepository.ts \
	src/repositories/IndexedDbRepository.test.ts \
	src/repositories/InMemoryRepository.ts \
	src/repositories/InMemoryRepository.test.ts
```

- [ ] **Step 3: Clean the barrel and the fixtures**

Remove the `todos` re-export from `src/stores/index.ts`. Leave `src/types/index.ts` alone — it lists `entity`, `dream`, `goal` and `task` only — and note that `src/repositories/` has no `index.ts`. Check `src/vitestHelpers.ts` for `Todo` helpers and delete the ones nothing uses.

- [ ] **Step 4: Delete the obsolete i18n keys**

Remove the whole `todo` block and the whole `period` block from all three locales. Every string they held has an equivalent under `task`, added in task 1.

- [ ] **Step 5: Prove nothing references the old stack**

Run: `git grep -n "Todo\b\|todos\|TodoStorage\|IndexedDbRepository\|InMemoryRepository" -- src e2e`

Expected: matches only in file *names* that keep the word for now (`TodoListPage/`, `e2e/todo-crud.spec.ts`) and in nothing else. Any remaining import is a miss — fix it before continuing.

- [ ] **Step 6: Run everything**

Run: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`

Expected: all PASS. The unit-test count drops by however many tests the deleted files carried; that is the expected outcome, not a regression.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: delete the todo stack"
```

---

### Task 6: Documentation

The two `.claude/` files describe a data model that no longer exists. This stage is where they catch up, because from here on every reader of the repo would otherwise be misled.

**Files:**

- Modify: `.claude/CLAUDE.md`
- Modify: `.claude/Architecture.md`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Rewrite the data model section of `.claude/CLAUDE.md`**

Read the file first, then replace its **Data model** section. It currently describes `Todo` with `period`, `done` and `deleted`. The replacement covers:

- the three entities and the two optional links (`Goal.dreamId`, `Task.goalId`), every link optional;
- `Status` as a real enum, `Opened | Done | Cancelled`, shared by all three;
- `updated` moving on every user change — and **never** on garbage collection, with the reason: a device that moved it on startup would win the next merge for free;
- no `deleted` flag: a closed record is its own tombstone, and physical deletion happens only in `collectGarbage`, only past the cleanup window, and never from the interface;
- `completions` merging per `occurrence` rather than as a value, because whole-record last-write-wins would silently drop a mark made on the other device;
- the effective cleanup window being the larger of the two devices', which needs no code and no negotiation;
- the IndexedDB schema now at version 3, three stores, one shared connection.

- [ ] **Step 2: Add the new traps to `.claude/CLAUDE.md`**

Extend **Traps already paid for** with three entries this stage and the last one paid for:

- **Nested reactive values reach storage through the draft.** `toRaw()` unwraps a record but not its fields; a form-bound `schedule` or `deadline` arrives as a proxy and structured clone rejects it. The store factory's `toStorable()` walks every level, and all three write sites go through it.
- **Schedules store wall-clock time, never UTC.** A floating `10:00` must stay 10:00 in another country, and a zone-anchored one must survive its own daylight-saving change; a stored UTC instant breaks both. `created`, `updated` and `Completion.at` stay UTC — they are moments, not appointments.
- **Backup files of versions 1 and 2 are refused, not migrated.** They carry a single `todos` list against a model that no longer exists, and a migration would have to invent the dreams and goals that were never written.

- [ ] **Step 3: Update `.claude/Architecture.md`**

Bring the folder tree and the narrative in line: the deleted files go, `AppDatabase.ts` / `EntityDbRepository.ts` / `EntityMemoryRepository.ts` / `EntityStorage.ts` appear, `createEntityStore.ts` and `storage.ts` are described as the shared half of the three stores, and `src/types/` is documented as carrying **runtime code** — the enums and the `parse*` guards — rather than type declarations alone. Keep the dependency direction statement as it is; it has not changed.

- [ ] **Step 4: Verify**

Run: `npm run lint`

Expected: PASS. Then re-read both documents once against the actual tree — a stale doc is the failure mode this task exists to prevent.

- [ ] **Step 5: Commit**

```bash
git add .claude
git commit -m "docs: describe the dream/goal/task model"
```

---

## Manual verification before the stage is called done

Unit tests cannot see the trap this project has paid for twice. Run it by hand:

```bash
npm run build && npm run preview
```

In **Edge** — not Chrome, whose Cache API is broken on this machine — open `localhost:4173`, add a task, reload the page, and confirm it is still there. Then export a backup, check the file holds `"version": 3` with three arrays, and restore it.
