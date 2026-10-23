<style lang="scss" module>
// Wraps rather than squeezing a label mid-word when large text leaves no room
// for both switches on one line.
.flags {
	display: flex;
	flex-wrap: wrap;
	column-gap: 1.5rem;
}

.chips {
	display: flex;
	gap: 0.5rem;
	margin-top: 0.5rem;
}
</style>

<template>
	<EntityDialog
		v-model="open"
		v-model:editing="editingRecord"
		:title="t('task.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<template v-if="editing">
				<VTextField
					v-model="name"
					:label="t('entity.name')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="onSave"
				/>
				<VTextarea v-model="note" :label="t('entity.note')" rows="3" />
				<div :class="$style.flags">
					<VSwitch v-model="important" :label="t('task.important')" color="primary" hide-details />
					<VSwitch v-model="urgent" :label="t('task.urgent')" color="primary" hide-details />
				</div>
				<VSelect
					v-model="goalId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('task.goalLabel')"
				/>
				<ScheduleField v-model="schedule" />
			</template>
			<template v-else>
				<div class="text-title-large">{{ name }}</div>
				<p v-if="note" class="text-body-medium mt-2">{{ note }}</p>
				<p v-if="goalName" class="text-body-medium mt-2 text-medium-emphasis">
					{{ t('task.goalLabel') }}: {{ goalName }}
				</p>
				<p v-if="schedule" class="text-body-medium mt-2 text-medium-emphasis">
					{{ t('task.schedule.label') }}: {{ scheduleSummary }}
				</p>
				<TaskCompletions
					v-if="showCompletions"
					:occurrences="occurrences"
					:locale="locale"
					@toggle-done="onToggleDone"
					@toggle-skip="onToggleSkip"
				/>
				<div v-if="important || urgent" :class="$style.chips">
					<VChip v-if="important" size="small" color="primary">{{ t('task.important') }}</VChip>
					<VChip v-if="urgent" size="small" color="primary">{{ t('task.urgent') }}</VChip>
				</div>
			</template>
		</template>
	</EntityDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import ScheduleField from './ScheduleField.vue';
import TaskCompletions from './TaskCompletions.vue';
import { describeRecurrence, formatWallClock, listOccurrences, parseRRule } from '@/utils/schedule';
import { isPeriodic, type Schedule, type Task } from '@/types';
import type { TaskDraft } from '@/stores/tasks';

const PAST_WINDOW = 5;
const FUTURE_WINDOW = 5;

const props = withDefaults(
	defineProps<{
		record?: Task | null;
		initialFlags?: { important: boolean; urgent: boolean };
		mode?: 'add' | 'edit';
		goalOptions: Array<{ value: string; title: string }>;
	}>(),
	{ record: null, initialFlags: undefined, mode: 'edit' },
);

const emit = defineEmits<{
	save: [draft: TaskDraft];
	cancel: [];
	'toggle-completion-done': [taskId: string, occurrence: string, done: boolean];
	'toggle-completion-skip': [taskId: string, occurrence: string, skipped: boolean];
}>();

const open = defineModel<boolean>({ required: true });

const { t, locale } = useI18n();

const name = ref('');
const note = ref('');
const important = ref(false);
const urgent = ref(false);
const goalId = ref('');
const schedule = ref<Schedule | undefined>(undefined);
const showErrors = ref(false);
const editingRecord = ref(props.mode === 'add');

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

const selectItems = computed(() => [{ value: '', title: t('task.noGoal') }, ...props.goalOptions]);

const goalName = computed(
	() => selectItems.value.find((item) => item.value === goalId.value)?.title,
);

const scheduleSummary = computed(() => {
	if (schedule.value === undefined) {
		return '';
	}

	if (schedule.value.rrule === undefined) {
		return formatWallClock(schedule.value.start, locale.value);
	}

	const rule = parseRRule(schedule.value.rrule);
	if (rule === undefined) {
		return formatWallClock(schedule.value.start, locale.value);
	}

	return describeRecurrence(rule, t, locale.value);
});

const showCompletions = computed(() => props.record !== null && isPeriodic(props.record));

const occurrences = computed(() => {
	const record = props.record;
	if (record === null || record.schedule === undefined || !isPeriodic(record)) {
		return [];
	}

	return listOccurrences(
		record.schedule,
		record.completions,
		new Date(),
		PAST_WINDOW,
		FUTURE_WINDOW,
	);
});

function onToggleDone(occurrence: string, done: boolean): void {
	if (props.record === null) {
		return;
	}

	emit('toggle-completion-done', props.record.id, occurrence, done);
}

function onToggleSkip(occurrence: string, skipped: boolean): void {
	if (props.record === null) {
		return;
	}

	emit('toggle-completion-skip', props.record.id, occurrence, skipped);
}

/** Snapshots the draft from the live `props.record` -- run both when the
 *  dialog opens and whenever editing is (re-)entered, so a change applied to
 *  the record while the dialog sat in its read view (e.g. a completion skip
 *  toggled from `TaskCompletions`) is never silently overwritten by a stale
 *  draft. */
function seedDraftFromRecord(): void {
	name.value = props.record?.name ?? '';
	note.value = props.record?.note ?? '';
	important.value = props.record?.important ?? props.initialFlags?.important ?? false;
	urgent.value = props.record?.urgent ?? props.initialFlags?.urgent ?? false;
	goalId.value = props.record?.goalId ?? '';
	schedule.value = props.record?.schedule;
}

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		seedDraftFromRecord();
		showErrors.value = false;
	},
	{ immediate: true },
);

watch(editingRecord, (isEditing) => {
	if (isEditing) {
		seedDraftFromRecord();
	}
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
		important: important.value,
		urgent: urgent.value,
		goalId: goalId.value === '' ? undefined : goalId.value,
		schedule: schedule.value,
	});
	open.value = false;
}
</script>
