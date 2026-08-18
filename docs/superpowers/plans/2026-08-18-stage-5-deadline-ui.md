# Stage 6, Stage 5 — Deadline UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a goal's `deadline` (already in the data model, never exposed in any UI) be set, cleared, and viewed, at any of its four precision levels (exact day / month / year / season, each with an independently optional year), from `GoalDialog` and `AddEntityDialog`'s Goal tab, and shown formatted in the goal list.

**Architecture:** A pure formatter, `formatDeadline()`, turns a `Deadline` into a locale-aware display string with no dependency on the current time. A new composite input component, `DeadlineField.vue`, is the only place that knows how to turn user interaction into a `parseDeadline`-valid `Deadline` object; `GoalDialog.vue` and `AddEntityDialog.vue`'s Goal tab both mount it the same way they already duplicate their name/note/dream fields. `GoalList.vue` passes a `dateLabel` formatter function down through a newly generic-friendly `EntityList.vue` into `EntityListItem.vue`'s new (previously unbuilt) date slot. `GoalList.vue`'s `initialDraft` — which today drops `deadline` when opening the edit dialog — is fixed as part of the same task that would otherwise be the first thing to make that bug visible.

**Tech Stack:** Vite 8 (Rolldown), Vue 3.5 (`<script setup>`, `defineModel`), TypeScript, Pinia 4, vue-i18n 11 (`useI18n()`'s `t`/`locale`), Vuetify 4.1 (`VSwitch`, `VSelect`, `VTextField`), native `Intl.DateTimeFormat` (no date library in this project), Vitest 4 (`happy-dom` per file via `// @vitest-environment happy-dom`), `@vue/test-utils`.

**Spec:** [docs/superpowers/specs/2026-08-18-stage-5-deadline-ui-design.md](../specs/2026-08-18-stage-5-deadline-ui-design.md)

## Global Constraints

- SFC section order is **style → template → script**, enforced by ESLint's `vue/block-order`. Omit the `<style>` block entirely on files that need no custom CSS — `GoalDialog.vue`, `AddEntityDialog.vue`, `EntityListItem.vue`, and the new `DeadlineField.vue` all stay style-less; use only Vuetify components and utility classes (`text-caption`, `text-medium-emphasis`, etc.), matching existing precedent (e.g. `GoalDialog.vue`'s `dreamName` paragraph).
- Formatting: tabs, single quotes, `printWidth: 100`, trailing commas everywhere (`.prettierrc.json`). Run `npm run format` if unsure.
- Imports inside `src` use the `@/` alias.
- `src/components/` (shared) components get props/emits only, no store or service calls. `DeadlineField.vue` must not call any `useXStore()`. `GoalList.vue` (a page container) is where the deadline formatter is wired to the goals store's data.
- Every file is English except `src/i18n/locales/ru.json` and `src/i18n/locales/pl.json`. New i18n keys need all three locale files updated in the same step that introduces the key.
- Default to no comments; add one only where the _why_ isn't obvious from the code (e.g. the leap-year placeholder in `formatDeadline`).
- Out of scope, per the spec — do not add any of these: `resolveDeadline()`, overdue/urgency visual treatment, deadline-based sorting of the goal list, real calendar-length validation on the day picker (e.g. rejecting "31 February" — `parseDeadline` doesn't enforce that either), recurrence UI, completion-history UI.
- `DeadlineField`'s day picker always offers 1–31 regardless of the selected month — this is intentional, not a bug to fix.
- Do not merge to `main`, push, or add a git remote — stay on `stage-6-dreams-goals-tasks` and commit locally only, one commit per task.
- Every task's "done" bar is `npx vitest run <file>` (or the full `npm test`) passing. Unlike stage 4, this stage's final task **does** include a manual browser check (Edge, not Chrome — see CLAUDE.md's Cache API note) — per CLAUDE.md's storage trap, `toStorable()`/`IndexedDB` structured-clone failures never show up in tests that use the in-memory repository.

---

## File Structure

New files:

- `src/utils/deadline.ts` (+ `.test.ts`) — `formatDeadline(deadline, locale, t)`, pure.
- `src/components/DeadlineField.vue` (+ `.test.ts`) — the composite `v-model<Deadline | undefined>` input.

Modified files:

- `src/i18n/locales/{en,ru,pl}.json` — new `goal.deadline.*` keys, added incrementally across Tasks 1–3.
- `src/components/GoalDialog.vue` + `.test.ts` — deadline field (editing) and formatted display (read view).
- `src/components/AddEntityDialog.vue` + `.test.ts` — deadline field on the Goal tab.
- `src/components/EntityListItem.vue` + `.test.ts` — new optional `date` prop, rendered in a right-aligned slot.
- `src/components/EntityList.vue` + `.test.ts` — new optional `dateLabel?: (item: T) => string | undefined` prop, threaded to `EntityListItem`.
- `src/pages/GoalsPage/containers/GoalList.vue` + `.test.ts` — passes `dateLabel`; fixes `initialDraft` to round-trip `deadline`.

No deleted files.

---

### Task 1: `formatDeadline()` utility

**Files:**

- Create: `src/utils/deadline.ts`
- Test: `src/utils/deadline.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `Season`, `type Deadline` from `@/types`.
- Produces: `formatDeadline(deadline: Deadline, locale: string, t: (key: string) => string): string`. Consumed by `GoalDialog.vue` (Task 3) and `GoalList.vue` (Task 5). The `t` parameter is a minimal structural type — any vue-i18n `t` function satisfies it — so the util stays framework-agnostic and independently testable, same reasoning as `useToggleConfirm`'s structural `ToggleableStore` type.

- [ ] **Step 1: Add the season i18n keys**

In `src/i18n/locales/en.json`, replace:

```json
	"goal": {
		"title": "Goal",
		"dreamLabel": "Dream",
		"noDream": "No dream",
		"empty": "No goals yet."
	}
```

with:

```json
	"goal": {
		"title": "Goal",
		"dreamLabel": "Dream",
		"noDream": "No dream",
		"empty": "No goals yet.",
		"deadline": {
			"seasonWinter": "Winter",
			"seasonSpring": "Spring",
			"seasonSummer": "Summer",
			"seasonAutumn": "Autumn"
		}
	}
```

In `src/i18n/locales/ru.json`, replace:

```json
	"goal": {
		"title": "Цель",
		"dreamLabel": "Мечта",
		"noDream": "Без мечты",
		"empty": "Пока нет целей."
	}
```

with:

```json
	"goal": {
		"title": "Цель",
		"dreamLabel": "Мечта",
		"noDream": "Без мечты",
		"empty": "Пока нет целей.",
		"deadline": {
			"seasonWinter": "Зима",
			"seasonSpring": "Весна",
			"seasonSummer": "Лето",
			"seasonAutumn": "Осень"
		}
	}
```

In `src/i18n/locales/pl.json`, replace:

```json
	"goal": {
		"title": "Cel",
		"dreamLabel": "Marzenie",
		"noDream": "Bez marzenia",
		"empty": "Brak celów."
	}
```

with:

```json
	"goal": {
		"title": "Cel",
		"dreamLabel": "Marzenie",
		"noDream": "Bez marzenia",
		"empty": "Brak celów.",
		"deadline": {
			"seasonWinter": "Zima",
			"seasonSpring": "Wiosna",
			"seasonSummer": "Lato",
			"seasonAutumn": "Jesień"
		}
	}
```

- [ ] **Step 2: Write the failing test file**

`src/utils/deadline.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Season } from '@/types';
import { i18n } from '@/i18n';
import { formatDeadline } from './deadline';

const t = i18n.global.t;

describe('formatDeadline', () => {
	it('formats a year alone', () => {
		expect(formatDeadline({ year: 2027 }, 'en', t)).toBe('2027');
	});

	it('formats a month with a year', () => {
		expect(formatDeadline({ year: 2027, month: 3 }, 'en', t)).toBe('March 2027');
	});

	it('formats a month without a year', () => {
		expect(formatDeadline({ month: 3 }, 'en', t)).toBe('March');
	});

	it('formats an exact day with a year', () => {
		expect(formatDeadline({ year: 2027, month: 3, day: 15 }, 'en', t)).toBe('March 15, 2027');
	});

	it('formats an exact day without a year', () => {
		expect(formatDeadline({ month: 3, day: 15 }, 'en', t)).toBe('March 15');
	});

	it('formats a season with a year', () => {
		expect(formatDeadline({ year: 2027, season: Season.Summer }, 'en', t)).toBe('Summer 2027');
	});

	it('formats a season without a year', () => {
		expect(formatDeadline({ season: Season.Winter }, 'en', t)).toBe('Winter');
	});

	it('formats in a different locale', () => {
		expect(formatDeadline({ year: 2027, month: 3, day: 15 }, 'ru', t)).toBe('15 марта 2027 г.');
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/utils/deadline.test.ts`
Expected: FAIL — `Cannot find module './deadline'`.

- [ ] **Step 4: Write the implementation**

`src/utils/deadline.ts`:

```ts
import { Season, type Deadline } from '@/types';

const SEASON_KEYS: Record<Season, string> = {
	[Season.Winter]: 'goal.deadline.seasonWinter',
	[Season.Spring]: 'goal.deadline.seasonSpring',
	[Season.Summer]: 'goal.deadline.seasonSummer',
	[Season.Autumn]: 'goal.deadline.seasonAutumn',
};

/** A leap year, so a bare "29 February" (no year given) formats without throwing. */
const PLACEHOLDER_YEAR = 2000;

export function formatDeadline(
	deadline: Deadline,
	locale: string,
	t: (key: string) => string,
): string {
	if (deadline.season !== undefined) {
		const season = t(SEASON_KEYS[deadline.season]);
		return deadline.year === undefined ? season : `${season} ${deadline.year}`;
	}

	if (deadline.month !== undefined) {
		const date = new Date(deadline.year ?? PLACEHOLDER_YEAR, deadline.month - 1, deadline.day ?? 1);
		return new Intl.DateTimeFormat(locale, {
			day: deadline.day === undefined ? undefined : 'numeric',
			month: 'long',
			year: deadline.year === undefined ? undefined : 'numeric',
		}).format(date);
	}

	return String(deadline.year);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/utils/deadline.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/utils/deadline.ts src/utils/deadline.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add formatDeadline utility"
```

---

### Task 2: `DeadlineField.vue` composite input

**Files:**

- Create: `src/components/DeadlineField.vue`
- Test: `src/components/DeadlineField.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `Season`, `type Deadline` from `@/types`; `useI18n()` for `t`/`locale`.
- Produces: a `v-model<Deadline | undefined>` component (`defineModel`, no explicit prop/emit names needed). Consumed by `GoalDialog.vue` (Task 3) and `AddEntityDialog.vue` (Task 4).

- [ ] **Step 1: Add the picker i18n keys**

In `src/i18n/locales/en.json`, replace the `goal.deadline` block from Task 1:

```json
		"deadline": {
			"seasonWinter": "Winter",
			"seasonSpring": "Spring",
			"seasonSummer": "Summer",
			"seasonAutumn": "Autumn"
		}
```

with:

```json
		"deadline": {
			"enabled": "Has a deadline",
			"precision": "Precision",
			"precisionDay": "Exact day",
			"precisionMonth": "Month",
			"precisionYear": "Year",
			"precisionSeason": "Season",
			"year": "Year",
			"month": "Month",
			"day": "Day",
			"season": "Season",
			"seasonWinter": "Winter",
			"seasonSpring": "Spring",
			"seasonSummer": "Summer",
			"seasonAutumn": "Autumn"
		}
```

In `src/i18n/locales/ru.json`, replace:

```json
		"deadline": {
			"seasonWinter": "Зима",
			"seasonSpring": "Весна",
			"seasonSummer": "Лето",
			"seasonAutumn": "Осень"
		}
```

with:

```json
		"deadline": {
			"enabled": "Есть дедлайн",
			"precision": "Точность",
			"precisionDay": "Точный день",
			"precisionMonth": "Месяц",
			"precisionYear": "Год",
			"precisionSeason": "Сезон",
			"year": "Год",
			"month": "Месяц",
			"day": "День",
			"season": "Сезон",
			"seasonWinter": "Зима",
			"seasonSpring": "Весна",
			"seasonSummer": "Лето",
			"seasonAutumn": "Осень"
		}
```

In `src/i18n/locales/pl.json`, replace:

```json
		"deadline": {
			"seasonWinter": "Zima",
			"seasonSpring": "Wiosna",
			"seasonSummer": "Lato",
			"seasonAutumn": "Jesień"
		}
```

with:

```json
		"deadline": {
			"enabled": "Ma termin",
			"precision": "Dokładność",
			"precisionDay": "Dokładny dzień",
			"precisionMonth": "Miesiąc",
			"precisionYear": "Rok",
			"precisionSeason": "Pora roku",
			"year": "Rok",
			"month": "Miesiąc",
			"day": "Dzień",
			"season": "Pora roku",
			"seasonWinter": "Zima",
			"seasonSpring": "Wiosna",
			"seasonSummer": "Lato",
			"seasonAutumn": "Jesień"
		}
```

- [ ] **Step 2: Write the failing test file**

`src/components/DeadlineField.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { Season, type Deadline } from '@/types';
import DeadlineField from './DeadlineField.vue';

function mountField(modelValue?: Deadline) {
	return mount(DeadlineField, {
		props: { modelValue },
		global: { plugins: [vuetify, i18n] },
	});
}

describe('DeadlineField collapsed state', () => {
	it('shows only the toggle when there is no deadline', () => {
		const wrapper = mountField(undefined);

		expect(wrapper.findComponent({ name: 'VSelect' }).exists()).toBe(false);
	});
});

describe('DeadlineField turning the toggle on', () => {
	it('reveals the precision selector, defaulting to year', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);

		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(precisionSelect.props('modelValue')).toBe('year');
	});

	it('emits a year-only deadline once a year is typed', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([{ year: 2027 }]);
	});
});

describe('DeadlineField season precision', () => {
	it('emits a season without a year when none is entered', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'season');
		await wrapper.vm.$nextTick();
		const [, seasonSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await seasonSelect.vm.$emit('update:modelValue', Season.Summer);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ year: undefined, season: Season.Summer },
		]);
	});
});

describe('DeadlineField day precision', () => {
	it('does not emit anything until both month and day are set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'day');
		await wrapper.vm.$nextTick();
		const [, monthSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await monthSelect.vm.$emit('update:modelValue', 3);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('emits an exact day without a year once month and day are both set', async () => {
		const wrapper = mountField(undefined);

		await wrapper.get('input[type="checkbox"]').setValue(true);
		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await precisionSelect.vm.$emit('update:modelValue', 'day');
		await wrapper.vm.$nextTick();
		const [, monthSelect, daySelect] = wrapper.findAllComponents({ name: 'VSelect' });
		await monthSelect.vm.$emit('update:modelValue', 3);
		await daySelect.vm.$emit('update:modelValue', 15);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([
			{ year: undefined, month: 3, day: 15 },
		]);
	});
});

describe('DeadlineField existing value', () => {
	it('derives the precision from an existing deadline', () => {
		const wrapper = mountField({ year: 2027, season: Season.Winter });

		const [precisionSelect] = wrapper.findAllComponents({ name: 'VSelect' });
		expect(precisionSelect.props('modelValue')).toBe('season');
	});

	it('emits undefined when the toggle is turned off', async () => {
		const wrapper = mountField({ year: 2027 });

		await wrapper.get('input[type="checkbox"]').setValue(false);

		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/components/DeadlineField.test.ts`
Expected: FAIL — `Cannot find module './DeadlineField.vue'`.

- [ ] **Step 4: Write the implementation**

`src/components/DeadlineField.vue`:

```vue
<template>
	<v-switch
		v-model="hasDeadline"
		:label="t('goal.deadline.enabled')"
		color="primary"
		hide-details
	/>

	<template v-if="hasDeadline">
		<v-select
			v-model="precision"
			:items="precisionItems"
			item-title="title"
			item-value="value"
			:label="t('goal.deadline.precision')"
		/>

		<v-text-field
			:model-value="yearInput"
			type="number"
			:label="t('goal.deadline.year')"
			@update:model-value="onYearInput"
		/>

		<v-select
			v-if="precision === 'day' || precision === 'month'"
			v-model="month"
			:items="monthItems"
			item-title="title"
			item-value="value"
			:label="t('goal.deadline.month')"
		/>

		<v-select
			v-if="precision === 'day'"
			v-model="day"
			:items="dayItems"
			item-title="title"
			item-value="value"
			:label="t('goal.deadline.day')"
		/>

		<v-select
			v-if="precision === 'season'"
			v-model="season"
			:items="seasonItems"
			item-title="title"
			item-value="value"
			:label="t('goal.deadline.season')"
		/>
	</template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Season, type Deadline } from '@/types';

type Precision = 'day' | 'month' | 'year' | 'season';

const deadline = defineModel<Deadline | undefined>();

const { t, locale } = useI18n();

const hasDeadline = ref(false);
const precision = ref<Precision>('year');
const year = ref<number>();
const month = ref<number>();
const day = ref<number>();
const season = ref<Season>();

function syncFromValue(value: Deadline | undefined): void {
	if (value === undefined) {
		hasDeadline.value = false;
		return;
	}

	hasDeadline.value = true;
	year.value = value.year;

	if (value.season !== undefined) {
		precision.value = 'season';
		season.value = value.season;
		month.value = undefined;
		day.value = undefined;
		return;
	}

	if (value.day !== undefined) {
		precision.value = 'day';
		month.value = value.month;
		day.value = value.day;
		season.value = undefined;
		return;
	}

	if (value.month !== undefined) {
		precision.value = 'month';
		month.value = value.month;
		day.value = undefined;
		season.value = undefined;
		return;
	}

	precision.value = 'year';
	month.value = undefined;
	day.value = undefined;
	season.value = undefined;
}

watch(deadline, syncFromValue, { immediate: true });

function build(): Deadline | undefined {
	if (!hasDeadline.value) {
		return undefined;
	}

	if (precision.value === 'season') {
		return season.value === undefined ? undefined : { year: year.value, season: season.value };
	}

	if (precision.value === 'year') {
		return year.value === undefined ? undefined : { year: year.value };
	}

	if (precision.value === 'month') {
		return month.value === undefined ? undefined : { year: year.value, month: month.value };
	}

	if (month.value === undefined || day.value === undefined) {
		return undefined;
	}

	return { year: year.value, month: month.value, day: day.value };
}

watch([hasDeadline, precision, year, month, day, season], () => {
	deadline.value = build();
});

const yearInput = computed(() => (year.value === undefined ? '' : String(year.value)));

function onYearInput(value: string): void {
	const trimmed = value.trim();
	if (trimmed === '') {
		year.value = undefined;
		return;
	}

	const parsed = Number(trimmed);
	year.value = Number.isNaN(parsed) ? undefined : parsed;
}

const precisionItems = computed(() => [
	{ value: 'day', title: t('goal.deadline.precisionDay') },
	{ value: 'month', title: t('goal.deadline.precisionMonth') },
	{ value: 'year', title: t('goal.deadline.precisionYear') },
	{ value: 'season', title: t('goal.deadline.precisionSeason') },
]);

const monthItems = computed(() =>
	Array.from({ length: 12 }, (_, index) => ({
		value: index + 1,
		title: new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(new Date(2000, index, 1)),
	})),
);

const dayItems = computed(() =>
	Array.from({ length: 31 }, (_, index) => ({ value: index + 1, title: String(index + 1) })),
);

const seasonItems = computed(() => [
	{ value: Season.Winter, title: t('goal.deadline.seasonWinter') },
	{ value: Season.Spring, title: t('goal.deadline.seasonSpring') },
	{ value: Season.Summer, title: t('goal.deadline.seasonSummer') },
	{ value: Season.Autumn, title: t('goal.deadline.seasonAutumn') },
]);
</script>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/DeadlineField.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/components/DeadlineField.vue src/components/DeadlineField.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add DeadlineField composite input component"
```

---

### Task 3: Wire `DeadlineField` into `GoalDialog.vue`

**Files:**

- Modify: `src/components/GoalDialog.vue`
- Modify: `src/components/GoalDialog.test.ts`
- Modify: `src/i18n/locales/en.json`, `src/i18n/locales/ru.json`, `src/i18n/locales/pl.json`

**Interfaces:**

- Consumes: `DeadlineField` (Task 2), `formatDeadline` (Task 1), `GoalDraft` (already has `deadline?: Deadline`, `src/stores/goals.ts:7-12`, unchanged).
- Produces: `GoalDialog`'s emitted `save` draft now always includes a `deadline` key (possibly `undefined`). Consumed by `GoalList.vue`'s `handleSave` (Task 5), which passes the draft straight to `goals.update()` unchanged.

- [ ] **Step 1: Add the read-view label key**

In `src/i18n/locales/en.json`, replace the `goal.deadline` block from Task 2:

```json
		"deadline": {
			"enabled": "Has a deadline",
```

with:

```json
		"deadline": {
			"label": "Deadline",
			"enabled": "Has a deadline",
```

In `src/i18n/locales/ru.json`, replace:

```json
		"deadline": {
			"enabled": "Есть дедлайн",
```

with:

```json
		"deadline": {
			"label": "Дедлайн",
			"enabled": "Есть дедлайн",
```

In `src/i18n/locales/pl.json`, replace:

```json
		"deadline": {
			"enabled": "Ma termin",
```

with:

```json
		"deadline": {
			"label": "Termin",
			"enabled": "Ma termin",
```

- [ ] **Step 2: Write the failing tests**

Add to `src/components/GoalDialog.test.ts` (after the existing `describe` blocks):

```ts
describe('GoalDialog deadline', () => {
	it('round-trips an existing deadline back out unchanged', async () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: { year: 2027 } }],
		]);
	});

	it('emits deadline undefined after the deadline switch is turned off', async () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input[type="checkbox"]').setValue(false);
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(wrapper.emitted('save')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: undefined }],
		]);
	});

	it('shows the formatted deadline in the read-only view', () => {
		const wrapper = mount(GoalDialog, {
			props: {
				modelValue: true,
				mode: 'edit',
				initial: { name: 'Learn Japanese', deadline: { year: 2027, month: 3 } },
				dreamOptions,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('March 2027');
	});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/GoalDialog.test.ts`
Expected: FAIL — no deadline field exists yet, and the emitted draft has no `deadline` key.

- [ ] **Step 4: Update the implementation**

Replace the full contents of `src/components/GoalDialog.vue` with:

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
				<deadline-field v-model="deadline" />
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
				<p v-if="dreamName" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('goal.dreamLabel') }}: {{ dreamName }}
				</p>
				<p v-if="deadline" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('goal.deadline.label') }}: {{ formatDeadline(deadline, locale, t) }}
				</p>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import DeadlineField from './DeadlineField.vue';
import { formatDeadline } from '@/utils/deadline';
import type { Deadline } from '@/types';
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

const { t, locale } = useI18n();

const name = ref('');
const note = ref('');
const dreamId = ref('');
const deadline = ref<Deadline | undefined>(undefined);
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

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.initial.name ?? '';
		note.value = props.initial.note ?? '';
		dreamId.value = props.initial.dreamId ?? '';
		deadline.value = props.initial.deadline;
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
		dreamId: dreamId.value === '' ? undefined : dreamId.value,
		deadline: deadline.value,
	});
	open.value = false;
}
</script>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/GoalDialog.test.ts`
Expected: PASS (all tests, including the three new ones — the existing tests still pass because `deadline: undefined` is what an empty `initial` already produces).

- [ ] **Step 6: Commit**

```bash
git add src/components/GoalDialog.vue src/components/GoalDialog.test.ts src/i18n/locales/en.json src/i18n/locales/ru.json src/i18n/locales/pl.json
git commit -m "feat: add deadline field to GoalDialog"
```

---

### Task 4: Wire `DeadlineField` into `AddEntityDialog.vue`'s Goal tab

**Files:**

- Modify: `src/components/AddEntityDialog.vue`
- Modify: `src/components/AddEntityDialog.test.ts`

**Interfaces:**

- Consumes: `DeadlineField` (Task 2).
- Produces: `AddEntityDialog`'s `save-goal` event now always includes a `deadline` key. Consumed by `QuickAddFab.vue`'s existing `handleGoalSave`, which passes the draft straight to `goals.add()` — no change needed there since `GoalDraft.deadline` is already optional and `add()`/`build()` already forward it (`src/stores/goals.ts:27-36`).

- [ ] **Step 1: Write the failing test**

Add to `src/components/AddEntityDialog.test.ts`, inside the existing `describe('AddEntityDialog saving a goal', ...)` block:

```ts
	it('emits save-goal with a deadline when one is set', async () => {
		const wrapper = mountDialog('goal');

		await wrapper.get('input').setValue('Learn Japanese');
		await wrapper.get('input[type="checkbox"]').setValue(true);
		await wrapper.get('input[type="number"]').setValue('2027');
		await clickButtonByText(wrapper, 'Save');

		expect(wrapper.emitted('save-goal')).toEqual([
			[{ name: 'Learn Japanese', note: undefined, dreamId: undefined, deadline: { year: 2027 } }],
		]);
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/AddEntityDialog.test.ts`
Expected: FAIL — no checkbox/number input exists on the Goal tab yet, and `save-goal` carries no `deadline` key.

- [ ] **Step 3: Update the implementation**

In `src/components/AddEntityDialog.vue`, in the template's Goal tab branch, replace:

```vue
				<v-select
					v-model="goalDreamId"
					:items="goalDreamSelectItems"
					item-title="title"
					item-value="value"
					:label="t('goal.dreamLabel')"
				/>
			</template>
```

with:

```vue
				<v-select
					v-model="goalDreamId"
					:items="goalDreamSelectItems"
					item-title="title"
					item-value="value"
					:label="t('goal.dreamLabel')"
				/>
				<deadline-field v-model="goalDeadline" />
			</template>
```

In the `<script setup>` block, add the import (alongside the existing type imports):

```ts
import DeadlineField from './DeadlineField.vue';
import type { Deadline } from '@/types';
```

Add the ref (next to `goalDreamId`):

```ts
const goalDreamId = ref('');
const goalDeadline = ref<Deadline | undefined>(undefined);
```

In the `watch(open, ...)` reset block, add a line next to `goalDreamId.value = '';`:

```ts
	goalDreamId.value = '';
	goalDeadline.value = undefined;
```

In `onSave()`'s goal branch, add `deadline` to the emitted draft:

```ts
		emit('save-goal', {
			name: goalName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
			dreamId: goalDreamId.value === '' ? undefined : goalDreamId.value,
			deadline: goalDeadline.value,
		});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/AddEntityDialog.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/AddEntityDialog.vue src/components/AddEntityDialog.test.ts
git commit -m "feat: add deadline field to AddEntityDialog's Goal tab"
```

---

### Task 5: Show the deadline in the goal list, fix `initialDraft`

**Files:**

- Modify: `src/components/EntityListItem.vue`
- Modify: `src/components/EntityListItem.test.ts`
- Modify: `src/components/EntityList.vue`
- Modify: `src/components/EntityList.test.ts`
- Modify: `src/pages/GoalsPage/containers/GoalList.vue`
- Modify: `src/pages/GoalsPage/containers/GoalList.test.ts`

**Interfaces:**

- Consumes: `formatDeadline` (Task 1).
- Produces: `EntityListItem`'s new `date?: string` prop; `EntityList`'s new `dateLabel?: (item: T) => string | undefined` prop. `DreamsPage`/`TasksPage` pass neither — their `EntityList` usages are untouched by this task and keep rendering exactly as before.

- [ ] **Step 1: Write the failing `EntityListItem` tests**

Add to `src/components/EntityListItem.test.ts`, and extend the `mountItem` helper's prop type:

```ts
function mountItem(props: { name: string; note?: string; done: boolean; date?: string }) {
	return mount(EntityListItem, { props, global: { plugins: [vuetify, i18n] } });
}
```

Add a new `describe` block:

```ts
describe('EntityListItem date', () => {
	it('renders the date when provided', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false, date: 'March 2027' });

		expect(wrapper.text()).toContain('March 2027');
	});

	it('omits the date element entirely when there is none', () => {
		const wrapper = mountItem({ name: 'Visit Japan', done: false });

		expect(wrapper.find('.text-caption').exists()).toBe(false);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/EntityListItem.test.ts`
Expected: FAIL — `date` prop doesn't exist / TypeScript error on the extra prop.

- [ ] **Step 3: Update `EntityListItem.vue`**

Replace the full contents of `src/components/EntityListItem.vue` with:

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

		<template v-if="date" #append>
			<span class="text-caption text-medium-emphasis">{{ date }}</span>
		</template>
	</v-list-item>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
	name: string;
	note?: string;
	done: boolean;
	date?: string;
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
Expected: PASS.

- [ ] **Step 5: Write the failing `EntityList` tests**

Add to `src/components/EntityList.test.ts`:

```ts
describe('EntityList date label', () => {
	it('passes the formatted date through to each item when dateLabel is provided', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a', name: 'Visit Japan' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
				dateLabel: () => 'March 2027',
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.text()).toContain('March 2027');
	});

	it('shows nothing extra when dateLabel is omitted', () => {
		const wrapper = mount(EntityList, {
			props: {
				groups: [],
				ungrouped: [makeDream({ id: 'a' })],
				emptyText: 'Nothing here yet.',
				showNote: false,
			},
			global: { plugins: [vuetify, i18n] },
		});

		expect(wrapper.find('.text-caption').exists()).toBe(false);
	});
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/components/EntityList.test.ts`
Expected: FAIL — `dateLabel` prop doesn't exist.

- [ ] **Step 7: Update `EntityList.vue`**

Replace the full contents of `src/components/EntityList.vue` with:

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
				:date="dateLabel?.(item)"
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
			:date="dateLabel?.(item)"
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
	dateLabel?: (item: T) => string | undefined;
}>();

const emit = defineEmits<{
	toggle: [id: string, done: boolean];
	open: [item: T];
}>();
</script>
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/components/EntityList.test.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing `GoalList` tests**

Add to `src/pages/GoalsPage/containers/GoalList.test.ts`:

```ts
describe('GoalList deadline', () => {
	it('shows the formatted deadline next to the goal', async () => {
		const { wrapper } = await mountWithData([], [makeGoal({ deadline: { year: 2027 } })]);

		expect(wrapper.text()).toContain('2027');
	});

	it('preserves an existing deadline when an unrelated field is edited', async () => {
		const { wrapper, goalsStore } = await mountWithData(
			[],
			[makeGoal({ deadline: { year: 2027 } })],
		);

		await wrapper.get('.v-list-item').trigger('click');
		await wrapper.get('button[aria-label="Edit"]').trigger('click');
		await wrapper.get('input').setValue('Learn Japanese (updated)');
		await wrapper.get('button[aria-label="Save"]').trigger('click');

		expect(goalsStore.records[0].deadline).toEqual({ year: 2027 });
	});
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `npx vitest run src/pages/GoalsPage/containers/GoalList.test.ts`
Expected: The first new test FAILS (no date shown yet). The second new test also FAILS — this is the `initialDraft` bug from the spec: today it round-trips as `deadline: undefined`, wiping the deadline on any unrelated save.

- [ ] **Step 11: Update `GoalList.vue`**

In `src/pages/GoalsPage/containers/GoalList.vue`, update the imports:

```ts
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type Goal } from '@/types';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';
import { useDreamsStore } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import { formatDeadline } from '@/utils/deadline';
import EntityList from '@/components/EntityList.vue';
import GoalDialog from '@/components/GoalDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t, locale } = useI18n();
const goals = useGoalsStore();
```

Add a `dateLabel` function (near `labelFor`):

```ts
function dateLabel(goal: Goal): string | undefined {
	return goal.deadline ? formatDeadline(goal.deadline, locale.value, t) : undefined;
}
```

Fix `initialDraft`:

```ts
const initialDraft = computed<Partial<GoalDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, dreamId, deadline } = editing.value;
	return { name, note, dreamId, deadline };
});
```

In the template, add `:date-label="dateLabel"` to the `<entity-list>` element:

```vue
		<entity-list
			:groups="groups"
			:ungrouped="ungrouped"
			:empty-text="t('goal.empty')"
			:show-note="showNote"
			:date-label="dateLabel"
			@toggle="onToggle"
			@open="openEdit"
		/>
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run src/pages/GoalsPage/containers/GoalList.test.ts`
Expected: PASS (all tests, including the two new ones).

- [ ] **Step 13: Commit**

```bash
git add src/components/EntityListItem.vue src/components/EntityListItem.test.ts src/components/EntityList.vue src/components/EntityList.test.ts src/pages/GoalsPage/containers/GoalList.vue src/pages/GoalsPage/containers/GoalList.test.ts
git commit -m "feat: show goal deadlines in the goal list, fix initialDraft dropping deadline"
```

---

### Task 6: Full verification and manual browser check

**Files:** none (verification only).

- [ ] **Step 1: Run the full unit test suite**

Run: `npm test`
Expected: all tests pass, including every test added in Tasks 1–5.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run the build (includes `vue-tsc --noEmit`)**

Run: `npm run build`
Expected: type-checks and builds cleanly — pay particular attention to `Deadline`'s optional-field types flowing through `DeadlineField`, `GoalDialog`, and `AddEntityDialog` without `any`.

- [ ] **Step 4: Run the e2e suite**

Run: `npm run test:e2e`
Expected: passes unchanged — no existing e2e spec exercises goal creation or `GoalDialog`/`AddEntityDialog`'s Goal tab (`e2e/todo-crud.spec.ts` covers tasks), so this stage shouldn't affect it.

- [ ] **Step 5: Manual browser verification (Edge)**

Per CLAUDE.md's storage trap — `toStorable()`/IndexedDB structured-clone failures never show up in tests that use the in-memory repository. Run `npm run build && npm run preview`, open in Edge, and:

1. Create a goal with a year-only deadline (e.g. "2027"). Reload the page. Confirm the deadline is still shown.
2. Create a goal with a month+year deadline. Reload. Confirm.
3. Create a goal with an exact day, no year. Reload. Confirm.
4. Create a goal with a season+year deadline. Reload. Confirm.
5. Edit a deadline-bearing goal, changing only its name (leave the deadline field untouched). Save, reload. Confirm the deadline is still present — this is the regression case for the `initialDraft` fix.
6. Edit a deadline-bearing goal, turn the "has a deadline" switch off, save. Confirm the goal now shows no deadline, in both the list and the dialog's read view.

- [ ] **Step 6: Report results**

No commit for this task — if all checks pass, the stage is done and ready for the user's own review before considering `main`. If step 5 surfaces a bug, fix it in a follow-up task (write a failing test first, per this project's standing TDD convention) before declaring the stage complete.
