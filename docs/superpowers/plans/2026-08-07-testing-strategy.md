# Testing Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the testing gaps identified in `docs/superpowers/specs/2026-08-07-testing-strategy-design.md`: add component tests (`@vue/test-utils` + `happy-dom`) for the priority interactive `.vue` files, add Playwright e2e coverage (local CRUD/matrix, PWA/offline, cross-context WebRTC sync), and wire up CI.

**Architecture:** Every component and service touched here already ships and works — this is retrofitting tests onto finished code, not driving out a new feature. So the discipline is _characterization testing_, not literal red/green TDD on every assertion: write the test file, run it, confirm it passes. The one place this plan asks for a genuine red-then-green cycle is the very first test in Task 1, specifically to prove the new `happy-dom` + `@vue/test-utils` harness actually catches a wrong assertion rather than passing vacuously. After that, "run it, confirm pass" is enough. Selectors against Vuetify's rendered DOM are written from reading the component source, not from running a browser — if a locator is slightly off when a step's "run and verify" instruction is executed, fix the selector inline; that's a normal part of running this step, not a sign the plan is wrong.

**Tech Stack:** Vitest 4 (existing), `@vue/test-utils` + `happy-dom` (new, component tests), Playwright `@playwright/test` (new, e2e), GitHub Actions (new, CI).

## Global Constraints

- Formatting: tabs, single quotes, `printWidth: 100`, trailing commas everywhere (`.prettierrc.json`) — run `npm run format` if unsure.
- Everything in this repository is English (CLAUDE.md) — code, comments, commit messages.
- Imports inside `src/` use the `@/` alias.
- Test files are co-located next to the file they test (`Component.test.ts` beside `Component.vue`), per `.claude/Architecture.md`.
- No coverage threshold or gate anywhere in this plan (per the design spec) — tests must pass, no numeric target.
- CI must not add a deploy step and must not require a git remote to exist (CLAUDE.md: no remote/deploy without being asked).
- Before calling the whole plan finished, `npm test`, `npm run lint`, and `npm run build` must all still pass (CLAUDE.md).

---

### Task 1: Component-testing infrastructure + first component test (`TodoQuadrant`)

**Files:**

- Modify: `package.json`
- Create: `src/vitest.setup.ts`
- Create: `src/vitestHelpers.ts`
- Modify: `vite.config.ts:64-67`
- Modify: `.claude/Architecture.md:26-59` (document the two new root files)
- Test: `src/pages/MatrixPage/TodoQuadrant.test.ts`

**Interfaces:**

- Produces: `src/vitest.setup.ts` — no exports, registered as a Vitest `setupFiles` entry; stubs `window.ResizeObserver` and `window.matchMedia`, guarded by `typeof window !== 'undefined'` so it's a no-op under the existing `environment: 'node'` tests.
- Produces: `src/vitestHelpers.ts` exporting `clickButtonByText(wrapper: VueWrapper, text: string): Promise<void>` — every later component test task (2, 3, 4, 7) imports this.
- Produces: the `// @vitest-environment happy-dom` per-file docblock convention every later component test file repeats as its first line.

Steps:

- [ ] **Step 1: Install the component-testing dependencies**

```bash
npm install -D @vue/test-utils happy-dom
```

- [ ] **Step 2: Add the Vitest setup file**

Create `src/vitest.setup.ts`:

```ts
if (typeof window !== 'undefined') {
	class ResizeObserverStub {
		observe(): void {}
		unobserve(): void {}
		disconnect(): void {}
	}

	window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

	window.matchMedia ??= (query: string): MediaQueryList =>
		({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}) as MediaQueryList;
}
```

- [ ] **Step 3: Wire the setup file into Vitest**

In `vite.config.ts`, change:

```ts
		test: {
			environment: 'node',
			include: ['src/**/*.test.ts'],
		},
```

to:

```ts
		test: {
			environment: 'node',
			include: ['src/**/*.test.ts'],
			setupFiles: ['src/vitest.setup.ts'],
		},
```

- [ ] **Step 4: Add the shared component-test helper**

Create `src/vitestHelpers.ts`:

```ts
import type { VueWrapper } from '@vue/test-utils';

/**
 * Vuetify renders clickable actions as either a native <button> (v-btn) or a
 * <div class="v-list-item"> (v-list-item, e.g. inside a v-menu) — neither
 * exposes a stable selector on its own, and this project uses
 * @vue/test-utils rather than testing-library, so matching by visible text
 * across both element kinds is the pragmatic way to click "the Save button"
 * or "the Export to a file menu entry".
 */
export function clickButtonByText(wrapper: VueWrapper, text: string): Promise<void> {
	const target = wrapper
		.findAll('button, .v-list-item')
		.find((candidate) => candidate.text().includes(text));

	if (!target) {
		throw new Error(`No clickable element with text "${text}"`);
	}

	return target.trigger('click');
}
```

- [ ] **Step 5: Write `TodoQuadrant.test.ts` with one deliberately wrong assertion**

Create `src/pages/MatrixPage/TodoQuadrant.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import type { Todo } from '@/types/todo';
import TodoQuadrant from './TodoQuadrant.vue';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

describe('TodoQuadrant', () => {
	it('renders every item it is given', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo()], color: 'error' },
			global: { plugins: [vuetify, i18n] },
		});

		// Deliberately wrong on purpose: proves this test actually fails when the
		// assertion is wrong, before the next step corrects it to "Buy milk".
		expect(wrapper.text()).toContain('Nonexistent task title');
	});
});
```

- [ ] **Step 6: Run it and confirm it fails**

Run: `npm test -- TodoQuadrant`
Expected: FAIL — `expect(received).toContain(expected)` on `"Nonexistent task title"`.

- [ ] **Step 7: Fix the assertion and add the rest of the coverage**

Replace the test body in `src/pages/MatrixPage/TodoQuadrant.test.ts` with:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import type { Todo } from '@/types/todo';
import TodoQuadrant from './TodoQuadrant.vue';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

describe('TodoQuadrant', () => {
	it('renders every item it is given', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo()], color: 'error' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Buy milk');
	});

	it('shows the empty state when there are no items', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [], color: 'error' },
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('Empty');
	});

	it('strikes through a done item', () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo({ done: true })], color: 'error' },
			global: { plugins: [vuetify, i18n] },
		});

		const title = wrapper.find('.v-list-item-title');
		expect(title.classes().some((cls) => cls.includes('done'))).toBe(true);
	});

	it('emits toggle with the todo id when its checkbox is clicked', async () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'do', items: [makeTodo({ id: 'target' })], color: 'error' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input[type="checkbox"]').setValue(true);

		expect(wrapper.emitted('toggle')).toEqual([['target']]);
	});

	it('emits add with the quadrant key when the add button is clicked', async () => {
		const wrapper = mount(TodoQuadrant, {
			props: { quadrant: 'schedule', items: [], color: 'primary' },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, ''); // the add button has an icon only, no text
		expect(wrapper.emitted('add')).toEqual([['schedule']]);
	});
});
```

Note on the last test: `TodoQuadrant`'s add button has no visible text (icon + `aria-label` only), so `clickButtonByText(wrapper, '')` matches the first (only) button in the header. If `wrapper.findAll('button')` returns more than one button once other tests are added to this file, replace that line with `await wrapper.get('button[aria-label="Add task"]').trigger('click')` instead — both are equivalent here since there is exactly one button in this component.

- [ ] **Step 8: Run the full file and confirm all five tests pass**

Run: `npm test -- TodoQuadrant`
Expected: PASS — 5 passed.

- [ ] **Step 9: Document the two new root files in Architecture.md**

In `.claude/Architecture.md`, in the `src/` tree (around line 29, right after `env.d.ts`), add two lines so the block reads:

```
	env.d.ts                — ambient types (vite/client, vite-plugin-pwa/client)
	vitest.setup.ts         — Vitest setupFiles entry: stubs ResizeObserver/matchMedia for component tests
	vitestHelpers.ts        — shared helpers for component tests (e.g. clickButtonByText)
	App.vue                 — Vue root; renders the active layout, nothing else
```

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/vitest.setup.ts src/vitestHelpers.ts vite.config.ts .claude/Architecture.md src/pages/MatrixPage/TodoQuadrant.test.ts
git commit -m "test: add component-testing infrastructure and TodoQuadrant coverage"
```

---

### Task 2: `TodoForm.test.ts`

**Files:**

- Test: `src/components/TodoForm.test.ts`

**Interfaces:**

- Consumes: `clickButtonByText` from `src/vitestHelpers.ts` (Task 1).

Steps:

- [ ] **Step 1: Write the test file**

Create `src/components/TodoForm.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import TodoForm from './TodoForm.vue';

describe('TodoForm', () => {
	it('blocks submit and shows an error when the title is empty', async () => {
		const wrapper = mount(TodoForm, {
			props: { modelValue: true },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.text()).toContain('Title is required');
	});

	it('emits a trimmed draft and closes on a valid submit', async () => {
		const wrapper = mount(TodoForm, {
			props: { modelValue: true },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('  Buy milk  ');
		await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // important
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('submit')).toEqual([
			[
				{
					title: 'Buy milk',
					note: undefined,
					period: 'one-time',
					important: true,
					urgent: false,
				},
			],
		]);
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('closes without emitting submit when cancelled', async () => {
		const wrapper = mount(TodoForm, {
			props: { modelValue: true },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('input').setValue('Buy milk');
		await clickButtonByText(wrapper, 'Cancel');

		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
	});

	it('prefills from the initial draft when it opens in edit mode', async () => {
		const wrapper = mount(TodoForm, {
			props: {
				modelValue: false,
				mode: 'edit',
				initial: { title: 'Existing task', important: true, urgent: true, period: 'periodic' },
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.setProps({ modelValue: true });

		expect((wrapper.get('input').element as HTMLInputElement).value).toBe('Existing task');
		expect(wrapper.text()).toContain('Edit task');
	});
});
```

- [ ] **Step 2: Run it and confirm all four tests pass**

Run: `npm test -- TodoForm`
Expected: PASS — 4 passed. If the checkbox index in the second test toggles the wrong switch (important vs. urgent), swap index `0`/`1` — they follow the template order (important, then urgent).

- [ ] **Step 3: Commit**

```bash
git add src/components/TodoForm.test.ts
git commit -m "test: add TodoForm component tests"
```

---

### Task 3: `MatrixBoard.test.ts`

**Files:**

- Test: `src/pages/MatrixPage/containers/MatrixBoard.test.ts`

**Interfaces:**

- Consumes: `clickButtonByText` from `src/vitestHelpers.ts` (Task 1); `InMemoryRepository` from `src/repositories/InMemoryRepository.ts`; `useTodosStore` from `src/stores/todos.ts`.

Steps:

- [ ] **Step 1: Write the test file**

Create `src/pages/MatrixPage/containers/MatrixBoard.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import type { Todo } from '@/types/todo';
import { InMemoryRepository } from '@/repositories/InMemoryRepository';
import { useTodosStore } from '@/stores/todos';
import MatrixBoard from './MatrixBoard.vue';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'id-1',
		title: 'Buy milk',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
});

describe('MatrixBoard', () => {
	it('places each seeded task in its own quadrant', async () => {
		const store = useTodosStore();
		await store.load(
			async () =>
				new InMemoryRepository([
					makeTodo({ id: 'a', title: 'Do task', important: true, urgent: true }),
					makeTodo({ id: 'b', title: 'Schedule task', important: true, urgent: false }),
				]),
		);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		expect(wrapper.text()).toContain('Do task');
		expect(wrapper.text()).toContain('Schedule task');
	});

	it('opens the form pre-flagged for the quadrant whose add button was clicked', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository());

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });

		// The four quadrant add buttons render in QUADRANT_KEYS order: do, schedule, delegate, eliminate.
		const addButtons = wrapper.findAll('button[aria-label="Add task"]');
		await addButtons[2].trigger('click'); // delegate: urgent, not important

		await wrapper.get('input').setValue('Call the bank');
		await clickButtonByText(wrapper, 'Save');

		expect(store.items[0]).toMatchObject({
			title: 'Call the bank',
			important: false,
			urgent: true,
		});
	});

	it('moves a task to its new quadrant reactively when it is toggled', async () => {
		const store = useTodosStore();
		await store.load(
			async () =>
				new InMemoryRepository([
					makeTodo({ id: 'a', title: 'Eliminate task', important: false, urgent: false }),
				]),
		);

		const wrapper = mount(MatrixBoard, { global: { plugins: [vuetify, i18n] } });
		expect(wrapper.text()).toContain('Eliminate task');

		await store.update('a', { important: true, urgent: true });
		await wrapper.vm.$nextTick();

		expect(store.quadrants.do.map((t) => t.id)).toEqual(['a']);
	});
});
```

- [ ] **Step 2: Run it and confirm all three tests pass**

Run: `npm test -- MatrixBoard`
Expected: PASS — 3 passed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/MatrixPage/containers/MatrixBoard.test.ts
git commit -m "test: add MatrixBoard component tests"
```

---

### Task 4: `BackupMenu.test.ts`

**Files:**

- Test: `src/containers/BackupMenu.test.ts`

**Interfaces:**

- Consumes: `clickButtonByText` from `src/vitestHelpers.ts`; real `backupService` from `src/services/backup/BackupService.ts` (not mocked — pure logic); mocked `backupFile` from `src/services/backup/BackupFile.ts` (the I/O boundary).

Steps:

- [ ] **Step 1: Write the test file**

Create `src/containers/BackupMenu.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useTodosStore } from '@/stores/todos';
import { InMemoryRepository } from '@/repositories/InMemoryRepository';
import BackupMenu from './BackupMenu.vue';

vi.mock('@/services/backup/BackupFile', () => ({
	backupFile: { download: vi.fn(), readText: vi.fn() },
}));

const download = vi.mocked(backupFile.download);
const readText = vi.mocked(backupFile.readText);

beforeEach(() => {
	setActivePinia(createPinia());
	download.mockReset();
	readText.mockReset();
});

describe('BackupMenu export', () => {
	it('downloads a backup built from the current items and notifies', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([]));
		await store.add({ title: 'Buy milk', period: 'one-time', important: false, urgent: false });

		const wrapper = mount(BackupMenu, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, ''); // opens the v-menu (icon-only activator button)
		await clickButtonByText(wrapper, 'Export to a file');

		expect(download).toHaveBeenCalledTimes(1);
		expect(download.mock.calls[0][0].todos).toHaveLength(1);
		expect(wrapper.emitted('notify')).toEqual([['Backup saved.']]);
	});
});

describe('BackupMenu import', () => {
	it('shows a confirmation with counts and replaces the list on confirm', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([]));
		await store.add({ title: 'Old task', period: 'one-time', important: false, urgent: false });

		const incoming = backupService.create([
			{
				id: 'new-1',
				title: 'Imported task',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				period: 'one-time',
				important: false,
				urgent: false,
				done: false,
				deleted: false,
			},
		]);
		readText.mockResolvedValue(JSON.stringify(incoming));

		const wrapper = mount(BackupMenu, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('Tasks in the file: 1');
		expect(wrapper.text()).toContain('Tasks to be deleted: 1');

		await clickButtonByText(wrapper, 'Replace');

		expect(store.items.map((t) => t.id)).toEqual(['new-1']);
		expect(wrapper.emitted('notify')?.at(-1)).toEqual(['Restored from the file. Tasks: 1.']);
	});

	it('notifies with the reason and does not touch the store when the file is invalid', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([]));
		await store.add({ title: 'Untouched', period: 'one-time', important: false, urgent: false });

		readText.mockResolvedValue('not json at all');

		const wrapper = mount(BackupMenu, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['nope'], 'bad.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(store.items.map((t) => t.title)).toEqual(['Untouched']);
		expect(wrapper.emitted('notify')?.[0][0]).toContain('Could not read the file');
	});
});
```

- [ ] **Step 2: Run it and confirm all three tests pass**

Run: `npm test -- BackupMenu`
Expected: PASS — 3 passed. If the export test's first `clickButtonByText(wrapper, '')` matches the wrong button once the file-input's hidden element is counted, restrict it to `wrapper.get('button[aria-label="Backup"]').trigger('click')` instead.

- [ ] **Step 3: Commit**

```bash
git add src/containers/BackupMenu.test.ts
git commit -m "test: add BackupMenu component tests"
```

---

### Task 5: `SyncCode.test.ts`

**Files:**

- Test: `src/pages/SyncPage/SyncCode.test.ts`

**Interfaces:**

- Mocks the `qrcode` package's default export (`QRCode.toCanvas`) and `navigator.clipboard`.

Steps:

- [ ] **Step 1: Write the test file**

Create `src/pages/SyncPage/SyncCode.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import QRCode from 'qrcode';
import SyncCode from './SyncCode.vue';

vi.mock('qrcode', () => ({
	default: { toCanvas: vi.fn().mockResolvedValue(undefined) },
}));

const toCanvas = vi.mocked(QRCode.toCanvas);
const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
	toCanvas.mockClear();
	writeText.mockClear();
	Object.defineProperty(navigator, 'clipboard', {
		value: { writeText },
		configurable: true,
	});
});

describe('SyncCode', () => {
	it('draws the given code onto the canvas on mount', () => {
		mount(SyncCode, { props: { code: '1oc.example' }, global: { plugins: [vuetify, i18n] } });

		expect(toCanvas).toHaveBeenCalledWith(
			expect.any(HTMLCanvasElement),
			'1oc.example',
			expect.objectContaining({ errorCorrectionLevel: 'L' }),
		);
	});

	it('redraws when the code prop changes', async () => {
		const wrapper = mount(SyncCode, {
			props: { code: '1oc.first' },
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.setProps({ code: '1oc.second' });

		expect(toCanvas).toHaveBeenLastCalledWith(
			expect.any(HTMLCanvasElement),
			'1oc.second',
			expect.anything(),
		);
	});

	it('copies the code and emits copied when the button is clicked', async () => {
		const wrapper = mount(SyncCode, {
			props: { code: '1oc.example' },
			global: { plugins: [vuetify, i18n] },
		});

		await clickButtonByText(wrapper, 'Copy code');

		expect(writeText).toHaveBeenCalledWith('1oc.example');
		expect(wrapper.emitted('copied')).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run it and confirm all three tests pass**

Run: `npm test -- SyncCode`
Expected: PASS — 3 passed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SyncPage/SyncCode.test.ts
git commit -m "test: add SyncCode component tests"
```

---

### Task 6: `SyncScanner.test.ts`

**Files:**

- Test: `src/pages/SyncPage/SyncScanner.test.ts`

**Interfaces:**

- Mocks the `qr-scanner` package's default export (the `QrScanner` class).

Steps:

- [ ] **Step 1: Write the test file**

Create `src/pages/SyncPage/SyncScanner.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import SyncScanner from './SyncScanner.vue';

// vi.mock's factory is hoisted above regular imports, so it runs before any
// plain top-level `const` in this file would be initialized. Values the
// factory needs to close over must come from vi.hoisted() instead, which is
// hoisted together with vi.mock rather than left behind by it.
const { start, destroy, scannerState } = vi.hoisted(() => ({
	start: vi.fn(),
	destroy: vi.fn(),
	scannerState: { onDecode: null as ((result: { data: string }) => void) | null },
}));

vi.mock('qr-scanner', () => ({
	default: vi
		.fn()
		.mockImplementation(
			(_video: HTMLVideoElement, onDecode: (result: { data: string }) => void) => {
				scannerState.onDecode = onDecode;
				return { start, destroy };
			},
		),
}));

beforeEach(() => {
	start.mockReset();
	destroy.mockReset();
	scannerState.onDecode = null;
});

describe('SyncScanner camera path', () => {
	it('emits code when the scanner decodes a frame', async () => {
		start.mockResolvedValue(undefined);

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		expect(wrapper.text()).not.toContain('camera is unavailable');
		scannerState.onDecode?.({ data: '1oc.scanned' });

		expect(wrapper.emitted('code')).toEqual([['1oc.scanned']]);
	});

	it('falls back to the paste UI when the camera fails to start', async () => {
		start.mockRejectedValue(new Error('no camera'));

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		expect(wrapper.text()).toContain('camera is unavailable');
		expect(destroy).toHaveBeenCalled();
	});
});

describe('SyncScanner paste path', () => {
	it('emits the trimmed pasted code and clears the field', async () => {
		start.mockResolvedValue(undefined);

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		await wrapper.get('textarea').setValue('  1oc.pasted  ');
		await clickButtonByText(wrapper, 'Use this code');

		expect(wrapper.emitted('code')).toEqual([['1oc.pasted']]);
		expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('');
	});

	it('disables the submit button while the field is empty', async () => {
		start.mockResolvedValue(undefined);

		const wrapper = mount(SyncScanner, { global: { plugins: [vuetify, i18n] } });
		await flushPromises();

		const button = wrapper
			.findAll('button')
			.find((candidate) => candidate.text().includes('Use this code'));

		expect(button?.attributes('disabled')).toBeDefined();
	});
});
```

- [ ] **Step 2: Run it and confirm all four tests pass**

Run: `npm test -- SyncScanner`
Expected: PASS — 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SyncPage/SyncScanner.test.ts
git commit -m "test: add SyncScanner component tests"
```

---

### Task 7: `SyncFlow.test.ts`

**Files:**

- Test: `src/pages/SyncPage/containers/SyncFlow.test.ts`

**Interfaces:**

- Consumes: `clickButtonByText` from `src/vitestHelpers.ts`.
- Mocks `SyncConnection` from `src/services/sync/SyncConnection.ts` entirely (real `RTCPeerConnection` is exercised by e2e instead, per the design doc). Uses the real `syncMerger` (pure logic) and real Pinia store.
- Stubs the child components `SyncCode`/`SyncScanner` so this test drives `SyncFlow`'s own state machine without depending on Tasks 5/6's mocks (`qrcode`/`qr-scanner`) — auto-stubbed children still support `.vm.$emit(...)`.

Steps:

- [ ] **Step 1: Write the test file**

Create `src/pages/SyncPage/containers/SyncFlow.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import type { Todo } from '@/types/todo';
import { InMemoryRepository } from '@/repositories/InMemoryRepository';
import { useTodosStore } from '@/stores/todos';
import SyncCode from '../SyncCode.vue';
import SyncScanner from '../SyncScanner.vue';
import SyncFlow from './SyncFlow.vue';

// See the note in SyncScanner.test.ts: vi.mock's factory is hoisted above
// plain top-level `const`s, so the mocks it closes over must be declared
// through vi.hoisted() instead.
const { createOffer, acceptOffer, acceptAnswer, exchange, close } = vi.hoisted(() => ({
	createOffer: vi.fn(),
	acceptOffer: vi.fn(),
	acceptAnswer: vi.fn(),
	exchange: vi.fn(),
	close: vi.fn(),
}));

vi.mock('@/services/sync/SyncConnection', () => ({
	SyncConnection: vi.fn().mockImplementation(() => ({
		createOffer,
		acceptOffer,
		acceptAnswer,
		exchange,
		close,
	})),
}));

function makeTodo(overrides: Partial<Todo> = {}): Todo {
	return {
		id: 'local-1',
		title: 'Local task',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		period: 'one-time',
		important: false,
		urgent: false,
		done: false,
		deleted: false,
		...overrides,
	};
}

beforeEach(() => {
	setActivePinia(createPinia());
	vi.clearAllMocks();
});

describe('SyncFlow as initiator', () => {
	it('walks offer -> answer -> merged and updates the store', async () => {
		createOffer.mockResolvedValue('1oc.offer');
		acceptAnswer.mockResolvedValue(undefined);
		exchange.mockResolvedValue([
			makeTodo({ id: 'remote-1', title: 'Remote task', updated: '2026-08-07T10:00:00.000Z' }),
		]);

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([makeTodo()]));

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		expect(createOffer).toHaveBeenCalledTimes(1);
		expect(wrapper.findComponent(SyncCode).props('code')).toBe('1oc.offer');

		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oa.answer');

		expect(acceptAnswer).toHaveBeenCalledWith('1oa.answer');
		expect(store.items.map((t) => t.id).sort()).toEqual(['local-1', 'remote-1']);
		expect(wrapper.text()).toContain('Sync finished');
	});

	it('shows the failure state when creating the offer rejects', async () => {
		createOffer.mockRejectedValue(new Error('No camera or WebRTC unavailable'));

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository());

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');

		expect(wrapper.text()).toContain('Sync failed');
	});
});

describe('SyncFlow as responder', () => {
	it('walks scan offer -> show answer -> merged and updates the store', async () => {
		acceptOffer.mockResolvedValue('1oa.answer');
		exchange.mockResolvedValue([
			makeTodo({ id: 'remote-2', title: 'From initiator', updated: '2026-08-07T10:00:00.000Z' }),
		]);

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([makeTodo({ id: 'local-2' })]));

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device joins');
		await wrapper.findComponent(SyncScanner).vm.$emit('code', '1oc.offer');

		expect(acceptOffer).toHaveBeenCalledWith('1oc.offer');
		expect(store.items.map((t) => t.id).sort()).toEqual(['local-2', 'remote-2']);
		expect(wrapper.text()).toContain('Sync finished');
	});
});

describe('SyncFlow reset', () => {
	it('closes the connection and returns to idle', async () => {
		createOffer.mockResolvedValue('1oc.offer');

		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository());

		const wrapper = mount(SyncFlow, {
			global: { plugins: [vuetify, i18n], stubs: { SyncCode: true, SyncScanner: true } },
		});

		await clickButtonByText(wrapper, 'This device starts');
		await clickButtonByText(wrapper, 'Cancel');

		expect(close).toHaveBeenCalledTimes(1);
		expect(wrapper.text()).toContain('This device starts');
	});
});
```

- [ ] **Step 2: Run it and confirm all four tests pass**

Run: `npm test -- SyncFlow`
Expected: PASS — 4 passed.

- [ ] **Step 3: Commit**

```bash
git add src/pages/SyncPage/containers/SyncFlow.test.ts
git commit -m "test: add SyncFlow component tests"
```

---

### Task 8: Playwright infrastructure + smoke test

**Files:**

- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Create: `playwright.config.ts`
- Create: `e2e/app-shell.spec.ts`
- Modify: `.claude/Architecture.md:6-22` (document `e2e/` and `playwright.config.ts`)

**Interfaces:**

- Produces: `playwright.config.ts` with `testDir: './e2e'`, `baseURL: 'http://localhost:4173/todo/'`, and a `webServer` entry that runs `npm run preview` — every later e2e task (9, 10, 11) relies on this baseURL and webServer.

Steps:

- [ ] **Step 1: Install Playwright and its browser**

```bash
npm install -D @playwright/test
npx playwright install --with-deps chromium
```

- [ ] **Step 2: Add the Playwright config**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: true,
	retries: process.env.CI ? 1 : 0,
	reporter: 'list',
	use: {
		baseURL: 'http://localhost:4173/todo/',
		trace: 'on-first-retry',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'npm run preview',
		url: 'http://localhost:4173/todo/',
		reuseExistingServer: !process.env.CI,
		timeout: 30_000,
	},
});
```

- [ ] **Step 3: Add the `test:e2e` script**

In `package.json`, add to `scripts` (after `"test:watch"`):

```json
		"test:e2e": "playwright test",
```

- [ ] **Step 4: Include `e2e/` and the Playwright config in the TypeScript project**

In `tsconfig.json`, change:

```json
	"include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
```

to:

```json
	"include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts", "playwright.config.ts", "e2e/**/*.ts"]
```

- [ ] **Step 5: Ignore Playwright's local output**

In `.gitignore`, add:

```
test-results
playwright-report
blob-report
```

- [ ] **Step 6: Write a smoke test to prove the harness works end to end**

Create `e2e/app-shell.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('the app shell loads and shows the list page', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Todo' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();
});
```

Note: `npm run preview` serves the _built_ app, so build first. If `page.getByRole('heading', { name: 'Todo' })` doesn't match (the app-bar title may not render as an `h1`/`h2` in Vuetify's markup), replace it with `await expect(page.getByText('Todo').first()).toBeVisible();` — the important assertion for this smoke test is just that the page loaded and the add button is reachable.

- [ ] **Step 7: Build, then run the smoke test and confirm it passes**

Run:

```bash
npm run build
npm run test:e2e
```

Expected: PASS — 1 passed. (Playwright's `webServer` starts `npm run preview` automatically against the `dist/` from the build above and tears it down after the run.)

- [ ] **Step 8: Document the new files in Architecture.md**

In `.claude/Architecture.md`'s root table (around line 11, after the `docs/` row, keeping the table's rough alphabetical order), add:

```
| `e2e/` | Playwright end-to-end tests, run against a built `npm run preview` server |
```

and after the `vite.config.ts` row, add:

```
| `playwright.config.ts` | Playwright config: test directory, base URL, and the `webServer` that runs `npm run preview` |
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore playwright.config.ts e2e/app-shell.spec.ts .claude/Architecture.md
git commit -m "test: add Playwright e2e infrastructure and a smoke test"
```

---

### Task 9: E2E — CRUD and matrix scenario

**Files:**

- Test: `e2e/todo-crud.spec.ts`

**Interfaces:**

- Consumes: `playwright.config.ts`'s `baseURL` and `webServer` (Task 8). Each Playwright test gets an isolated browser context (fresh IndexedDB) automatically, so tests don't need to clean up after each other.

Steps:

- [ ] **Step 1: Write the test file**

Create `e2e/todo-crud.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('adds a task from the list page and it appears in the table', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Buy milk');
	await page.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByText('Buy milk')).toBeVisible();
});

test('an important and urgent task lands in the Do quadrant', async ({ page }) => {
	await page.goto('/matrix');

	// Quadrant cards render in QUADRANT_KEYS order: Do, Schedule, Delegate, Eliminate.
	await page.getByRole('button', { name: 'Add task' }).first().click();
	await page.getByLabel('Title').fill('Ship the release');
	await page.getByRole('button', { name: 'Save' }).click();

	const doQuadrant = page.getByText('Do').locator('..').locator('..');
	await expect(doQuadrant.getByText('Ship the release')).toBeVisible();
});

test('toggling done crosses the task out', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Finish the report');
	await page.getByRole('button', { name: 'Save' }).click();

	const row = page.getByRole('row', { name: /Finish the report/ });
	await row.getByRole('checkbox').click();

	await expect(row.getByText('Finish the report')).toHaveCSS(
		'text-decoration-line',
		'line-through',
	);
});

test('deleting a task removes it from the list', async ({ page }) => {
	await page.goto('/');

	await page.getByRole('button', { name: 'Add task' }).click();
	await page.getByLabel('Title').fill('Throwaway task');
	await page.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByText('Throwaway task')).toBeVisible();

	await page
		.getByRole('row', { name: /Throwaway task/ })
		.getByRole('button', { name: 'Actions' })
		.click();

	await expect(page.getByText('No tasks yet. Add the first one.')).toBeVisible();
});
```

- [ ] **Step 2: Run it and confirm all four tests pass**

Run: `npm run test:e2e -- todo-crud`
Expected: PASS — 4 passed. The Do-quadrant locator (`getByText('Do').locator('..').locator('..')`) walks up from the quadrant label to its card by DOM ancestry; if Vuetify's `v-card-title`/`v-card` nesting doesn't match two levels exactly, adjust the `.locator('..')` count, or replace it with `page.locator('.v-card', { hasText: 'Do' })` instead.

- [ ] **Step 3: Commit**

```bash
git add e2e/todo-crud.spec.ts
git commit -m "test: add e2e coverage for CRUD and the matrix"
```

---

### Task 10: E2E — PWA/offline scenario

**Files:**

- Test: `e2e/pwa-offline.spec.ts`

Steps:

- [ ] **Step 1: Write the test file**

Create `e2e/pwa-offline.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('registers a service worker on first load', async ({ page }) => {
	await page.goto('/');

	const hasController = await page.waitForFunction(
		() => navigator.serviceWorker.controller !== null,
		null,
		{ timeout: 15_000 },
	);

	expect(await hasController.jsonValue()).toBe(true);
});

test('the app shell still loads after going offline', async ({ page, context }) => {
	await page.goto('/');
	await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {
		timeout: 15_000,
	});

	await context.setOffline(true);
	await page.reload();

	await expect(page.getByRole('button', { name: 'Add task' })).toBeVisible();

	await context.setOffline(false);
});
```

- [ ] **Step 2: Run it and confirm both tests pass**

Run: `npm run test:e2e -- pwa-offline`
Expected: PASS — 2 passed. If the first test's `waitForFunction` times out, the service worker may still be in the `installing`/`waiting` state on first visit rather than `activated` — per the README's own manual PWA check, that's normal on a first-ever visit to an origin; if it's flaky, add `await page.reload()` once before the `waitForFunction` call so the second navigation is controlled by the now-activated worker.

- [ ] **Step 3: Commit**

```bash
git add e2e/pwa-offline.spec.ts
git commit -m "test: add e2e coverage for PWA/offline"
```

---

### Task 11: E2E — cross-context WebRTC sync scenario

**Files:**

- Test: `e2e/sync.spec.ts`

**Interfaces:**

- Uses two independent `BrowserContext`s from the same `browser` fixture (Playwright's documented pattern for multi-user scenarios) to simulate two devices. Drives the pairing exclusively through `SyncScanner`'s existing manual paste fallback (`sync.orPaste` / `sync.paste`) — no camera, no test-only hook needed, confirming the open question from the design doc.

Steps:

- [ ] **Step 1: Write the test file**

Create `e2e/sync.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('a task added on one device reaches the other after pairing', async ({ browser }) => {
	const deviceA = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const deviceB = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
	const pageA = await deviceA.newPage();
	const pageB = await deviceB.newPage();

	await pageA.goto('/');
	await pageA.getByRole('button', { name: 'Add task' }).click();
	await pageA.getByLabel('Title').fill('Buy milk');
	await pageA.getByRole('button', { name: 'Save' }).click();
	await expect(pageA.getByText('Buy milk')).toBeVisible();

	await pageA.goto('/sync');
	await pageB.goto('/sync');

	await pageA.getByRole('button', { name: 'This device starts' }).click();
	await pageA.getByRole('button', { name: 'Copy code' }).click();
	const offerCode = await pageA.evaluate(() => navigator.clipboard.readText());

	await pageB.getByRole('button', { name: 'This device joins' }).click();
	await pageB.getByLabel('No camera? Paste the code here').fill(offerCode);
	await pageB.getByRole('button', { name: 'Use this code' }).click();

	await pageB.getByRole('button', { name: 'Copy code' }).click();
	const answerCode = await pageB.evaluate(() => navigator.clipboard.readText());

	await pageA.getByLabel('No camera? Paste the code here').fill(answerCode);
	await pageA.getByRole('button', { name: 'Use this code' }).click();

	await expect(pageA.getByText(/Sync finished/)).toBeVisible({ timeout: 20_000 });
	await expect(pageB.getByText(/Sync finished/)).toBeVisible({ timeout: 20_000 });

	await pageB.goto('/');
	await expect(pageB.getByText('Buy milk')).toBeVisible();

	await deviceA.close();
	await deviceB.close();
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `npm run test:e2e -- sync`
Expected: PASS — 1 passed.

This is the one test in the whole plan whose outcome genuinely can't be predicted from reading the code — it depends on whether the two Chromium contexts' WebRTC stacks can resolve each other's `.local` mDNS ICE candidates over loopback in this environment (see CLAUDE.md's "Sync only works within one network" note; two contexts of the same browser process on the same machine are the smallest possible case of "one network"). If it times out with `SyncError: The other device did not connect in time` instead of failing on a selector, that confirms the environment is blocking loopback multicast rather than the test being wrong — worth a note back to the design doc if so, since it would mean this scenario needs a different environment (e.g. `--use-fake-...` isn't applicable here; it would need investigating separately). Do not paper over a timeout by increasing it speculatively — a real failure here is information, not flakiness to suppress.

- [ ] **Step 3: Commit**

```bash
git add e2e/sync.spec.ts
git commit -m "test: add e2e coverage for cross-device WebRTC sync"
```

---

### Task 12: CI workflow

**Files:**

- Create: `.github/workflows/ci.yml`

Steps:

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 2: Validate the workflow's YAML syntax locally**

Run: `node --eval "require('node:fs').readFileSync('.github/workflows/ci.yml','utf8')" && npx --yes js-yaml .github/workflows/ci.yml`

Expected: the file prints back as parsed YAML with no errors. (This only checks syntax — the workflow itself won't actually run until the repository has a remote, per CLAUDE.md's "no remote/deploy without being asked".)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for lint, test, build, and e2e"
```

---

## Final verification

After all 12 tasks:

- [ ] `npm test` — all unit and component tests pass.
- [ ] `npm run lint` — no errors, including on the new `e2e/`, `playwright.config.ts`, `src/vitest.setup.ts`, and `src/vitestHelpers.ts` files.
- [ ] `npm run build` — type-checks and builds cleanly (now also type-checking `e2e/**` and `playwright.config.ts`, per Task 8's `tsconfig.json` change).
- [ ] `npm run test:e2e` — all e2e specs pass against a freshly built `dist/`.
- [ ] Manually open `http://localhost:4173/todo/` in Edge once (per CLAUDE.md's Chrome caveat) and confirm nothing regressed — this plan only adds tests and config, but it does touch `vite.config.ts` and `tsconfig.json`, both build-relevant files.
