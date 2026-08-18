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
	</template>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { durationBetween, endTimeFromDuration } from '@/utils/schedule';
import type { Schedule } from '@/types';

type Repeat = 'none';

const props = defineProps<{ modelValue?: Schedule }>();
const emit = defineEmits<{ 'update:modelValue': [value: Schedule | undefined] }>();

const { t } = useI18n();

const hasSchedule = ref(false);
const start = ref('');
const hasEndTime = ref(false);
const endTime = ref('');
const hasTzid = ref(false);
const tzid = ref<string>();
const repeat = ref<Repeat>('none');

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

	hasTzid.value = value.tzid !== undefined;
	tzid.value = value.tzid;

	if (value.duration !== undefined) {
		hasEndTime.value = true;
		endTime.value = endTimeFromDuration(value.start, value.duration);
	} else {
		hasEndTime.value = false;
		endTime.value = '';
	}

	repeat.value = 'none';
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

	return {
		start: start.value,
		tzid: hasTzid.value ? tzid.value : undefined,
		duration,
		rrule: undefined,
	};
}

watch([hasSchedule, start, hasEndTime, endTime, hasTzid, tzid, repeat], () => {
	const next = build();
	lastEmitted.value = next;
	emit('update:modelValue', next);
});

const repeatItems = computed(() => [{ value: 'none', title: t('task.schedule.repeatNone') }]);

const timeZoneItems = computed(() => Intl.supportedValuesOf('timeZone'));
</script>
