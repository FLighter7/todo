<style lang="scss" module>
.weekdays {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}
</style>

<template>
	<v-switch
		v-model="hasSchedule"
		:label="t('task.schedule.enabled')"
		color="primary"
		hide-details
	/>

	<template v-if="hasSchedule">
		<v-text-field v-model="start" type="datetime-local" :label="t('task.schedule.start')" />

		<v-switch
			v-model="hasEndTime"
			:label="t('task.schedule.hasEndTime')"
			color="primary"
			hide-details
		/>
		<v-text-field
			v-if="hasEndTime"
			v-model="endTime"
			type="time"
			:label="t('task.schedule.endTime')"
		/>

		<v-switch v-model="hasTzid" :label="t('task.schedule.hasTzid')" color="primary" hide-details />
		<v-select
			v-if="hasTzid"
			v-model="tzid"
			:items="timeZoneItems"
			:label="t('task.schedule.tzid')"
		/>

		<v-select
			v-model="repeat"
			:items="repeatItems"
			item-title="title"
			item-value="value"
			:label="t('task.schedule.repeat')"
		/>

		<template v-if="repeat !== 'none' && repeat !== 'custom'">
			<v-text-field
				v-model.number="interval"
				type="number"
				min="1"
				:label="t('task.schedule.interval')"
			/>

			<div v-if="repeat === 'weekly'" :class="$style.weekdays">
				<v-checkbox
					v-for="day in weekdayItems"
					:key="day.value"
					:model-value="byweekday.includes(day.value)"
					:label="day.title"
					:readonly="byweekday.length === 1 && byweekday.includes(day.value)"
					density="compact"
					hide-details
					@update:model-value="toggleWeekday(day.value)"
				/>
			</div>

			<v-select
				v-model="endType"
				:items="endTypeItems"
				item-title="title"
				item-value="value"
				:label="t('task.schedule.endType')"
			/>

			<v-text-field
				v-if="endType === 'count'"
				v-model.number="count"
				type="number"
				min="2"
				:label="t('task.schedule.endCountField')"
			/>

			<v-text-field
				v-if="endType === 'until'"
				v-model="until"
				type="date"
				:label="t('task.schedule.endUntilField')"
			/>

			<p class="text-caption text-medium-emphasis">{{ preview }}</p>
		</template>

		<p v-if="repeat === 'custom'" class="text-caption text-medium-emphasis">
			{{ t('task.schedule.repeatCustom') }}: {{ customRRule }}
		</p>
	</template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	buildRRule,
	describeRecurrence,
	durationBetween,
	endTimeFromDuration,
	formatWallClock,
	nextOccurrence,
	parseRRule,
	weekdayName,
	type RecurrenceRule,
} from '@/utils/schedule';
import type { Schedule } from '@/types';

type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type EndType = 'never' | 'count' | 'until';

const props = defineProps<{ modelValue?: Schedule }>();
const emit = defineEmits<{ 'update:modelValue': [value: Schedule | undefined] }>();

const { t, locale } = useI18n();

const hasSchedule = ref(false);
const start = ref('');
const hasEndTime = ref(false);
const endTime = ref('');
const hasTzid = ref(false);
const tzid = ref<string>();
const repeat = ref<Repeat>('none');
const interval = ref(1);
const byweekday = ref<number[]>([]);
const endType = ref<EndType>('never');
const count = ref(2);
const until = ref('');
const customRRule = ref<string>();
const exdate = ref<string[]>();
const rdate = ref<string[]>();

/**
 * The last value this component itself wrote via `build()`. `syncFromValue`
 * uses it to tell "the parent genuinely cleared the schedule" apart from
 * "this is just an echo of what we ourselves just emitted" -- `build()`
 * legitimately returns `undefined` while the toggle is on but the current
 * fields aren't complete yet (e.g. the end-time switch is on but no time is
 * picked yet), and that echo must not collapse the form.
 */
const lastEmitted = ref<Schedule | undefined>(undefined);

function syncFromValue(value: Schedule | undefined): void {
	if (value === undefined) {
		if (lastEmitted.value === undefined) {
			return;
		}

		hasSchedule.value = false;
		return;
	}

	hasSchedule.value = true;
	start.value = value.start;
	exdate.value = value.exdate;
	rdate.value = value.rdate;

	hasTzid.value = value.tzid !== undefined;
	tzid.value = value.tzid;

	if (value.duration !== undefined) {
		hasEndTime.value = true;
		endTime.value = endTimeFromDuration(value.start, value.duration);
	} else {
		hasEndTime.value = false;
		endTime.value = '';
	}

	if (value.rrule === undefined) {
		repeat.value = 'none';
		return;
	}

	const parsed = parseRRule(value.rrule);
	if (parsed === undefined) {
		repeat.value = 'custom';
		customRRule.value = value.rrule;
		return;
	}

	repeat.value = parsed.freq;
	interval.value = parsed.interval;
	byweekday.value = parsed.byweekday ?? [];
	endType.value = parsed.end.type;
	count.value = parsed.end.type === 'count' ? parsed.end.count : 2;
	until.value = parsed.end.type === 'until' ? parsed.end.until : '';
}

watch(() => props.modelValue, syncFromValue, { immediate: true });

function build(): Schedule | undefined {
	if (!hasSchedule.value || start.value === '') {
		return undefined;
	}

	if (hasTzid.value && tzid.value === undefined) {
		return undefined;
	}

	let duration: string | undefined;
	if (hasEndTime.value) {
		if (endTime.value === '') {
			return undefined;
		}

		duration = durationBetween(start.value, endTime.value);
		if (duration === undefined) {
			return undefined;
		}
	}

	const rrule = buildRRuleFromForm();
	if (rrule === 'invalid') {
		return undefined;
	}

	return {
		start: start.value,
		tzid: hasTzid.value ? tzid.value : undefined,
		duration,
		rrule,
		exdate: exdate.value,
		rdate: rdate.value,
	};
}

function buildRRuleFromForm(): string | undefined | 'invalid' {
	if (repeat.value === 'none') {
		return undefined;
	}

	if (repeat.value === 'custom') {
		return customRRule.value;
	}

	if (!Number.isInteger(Number(interval.value)) || Number(interval.value) < 1) {
		return 'invalid';
	}

	if (repeat.value === 'weekly' && byweekday.value.length === 0) {
		return 'invalid';
	}

	if (endType.value === 'count' && count.value < 2) {
		return 'invalid';
	}

	if (endType.value === 'until' && until.value === '') {
		return 'invalid';
	}

	const end: RecurrenceRule['end'] =
		endType.value === 'never'
			? { type: 'never' }
			: endType.value === 'count'
				? { type: 'count', count: count.value }
				: { type: 'until', until: until.value };

	return buildRRule({
		freq: repeat.value,
		interval: interval.value,
		byweekday: repeat.value === 'weekly' ? byweekday.value : undefined,
		end,
	});
}

watch(
	[hasSchedule, start, hasEndTime, endTime, hasTzid, tzid, repeat, interval, endType, count, until],
	() => {
		const next = build();
		lastEmitted.value = next;
		emit('update:modelValue', next);
	},
	{ deep: false },
);

watch(
	byweekday,
	() => {
		const next = build();
		lastEmitted.value = next;
		emit('update:modelValue', next);
	},
	{ deep: true },
);

const repeatItems = computed(() => [
	{ value: 'none', title: t('task.schedule.repeatNone') },
	{ value: 'daily', title: t('task.schedule.repeatDaily') },
	{ value: 'weekly', title: t('task.schedule.repeatWeekly') },
	{ value: 'monthly', title: t('task.schedule.repeatMonthly') },
	{ value: 'yearly', title: t('task.schedule.repeatYearly') },
	...(repeat.value === 'custom'
		? [{ value: 'custom', title: t('task.schedule.repeatCustom') }]
		: []),
]);

const weekdayItems = computed(() =>
	Array.from({ length: 7 }, (_, index) => {
		const iso = index + 1;
		return { value: iso, title: weekdayName(iso, locale.value) };
	}),
);

function toggleWeekday(iso: number): void {
	if (byweekday.value.includes(iso)) {
		if (byweekday.value.length === 1) {
			return;
		}

		byweekday.value = byweekday.value.filter((day) => day !== iso);
		return;
	}

	byweekday.value = [...byweekday.value, iso].sort((a, b) => a - b);
}

const endTypeItems = computed(() => [
	{ value: 'never', title: t('task.schedule.endNever') },
	{ value: 'count', title: t('task.schedule.endCountOption') },
	{ value: 'until', title: t('task.schedule.endUntilOption') },
]);

const preview = computed(() => {
	if (
		repeat.value === 'none' ||
		repeat.value === 'custom' ||
		start.value === '' ||
		(endType.value === 'until' && until.value === '')
	) {
		return '';
	}

	const end: RecurrenceRule['end'] =
		endType.value === 'never'
			? { type: 'never' }
			: endType.value === 'count'
				? { type: 'count', count: count.value }
				: { type: 'until', until: until.value };

	const rule: RecurrenceRule = {
		freq: repeat.value,
		interval: interval.value,
		byweekday: repeat.value === 'weekly' ? byweekday.value : undefined,
		end,
	};
	const description = describeRecurrence(rule, t, locale.value);

	const built = build();
	if (built === undefined) {
		return description;
	}

	const next = nextOccurrence(built, new Date());
	if (next === undefined) {
		return description;
	}

	return `${description} — ${t('task.schedule.nextOccurrence', { date: formatWallClock(next.start, locale.value) })}`;
});

watch([repeat, start], () => {
	if (repeat.value === 'weekly' && byweekday.value.length === 0 && start.value !== '') {
		const startDate = new Date(`${start.value}:00Z`);
		const isoWeekday = ((startDate.getUTCDay() + 6) % 7) + 1;
		byweekday.value = [isoWeekday];
	}
});

const timeZoneItems = computed(() => Intl.supportedValuesOf('timeZone'));
</script>
