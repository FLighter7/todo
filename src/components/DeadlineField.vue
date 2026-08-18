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
		title: new Intl.DateTimeFormat(locale.value, { month: 'long' }).format(
			new Date(2000, index, 1),
		),
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
