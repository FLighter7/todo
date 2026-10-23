<style lang="scss" module>
// Wraps rather than squeezing a label mid-word when large text leaves no room
// for both switches on one line.
.flags {
	display: flex;
	flex-wrap: wrap;
	column-gap: 1.5rem;
}

.saveAndNewIcon {
	display: inline-flex;
	position: relative;
}

.saveAndNewBadge {
	bottom: -4px;
	position: absolute;
	right: -4px;
}
</style>

<template>
	<VDialog v-model="open" max-width="480">
		<VCard variant="elevated">
			<VCardActions>
				<VSpacer />
				<VBtn
					icon
					variant="text"
					density="comfortable"
					:aria-label="t('form.saveAndNew')"
					@click="onSaveAndNew"
				>
					<span :class="$style.saveAndNewIcon">
						<VIcon :icon="mdiCheck" />
						<VIcon :icon="mdiPlusThick" size="16" :class="$style.saveAndNewBadge" />
					</span>
				</VBtn>
				<VBtn
					:icon="mdiCheck"
					variant="text"
					density="comfortable"
					:aria-label="t('form.save')"
					@click="onSave"
				/>
			</VCardActions>

			<VTabs v-model="activeTab" color="primary">
				<VTab value="dream">{{ t('dream.title') }}</VTab>
				<VTab value="goal">{{ t('goal.title') }}</VTab>
				<VTab value="task">{{ t('task.title') }}</VTab>
			</VTabs>

			<VCardText>
				<template v-if="activeTab === 'dream'">
					<VTextField
						ref="nameField"
						v-model="dreamName"
						:label="t('entity.name')"
						:error-messages="dreamNameError"
						autofocus
					/>
					<VTextarea v-model="dreamNote" :label="t('entity.note')" rows="3" />
				</template>

				<template v-else-if="activeTab === 'goal'">
					<VTextField
						ref="nameField"
						v-model="goalName"
						:label="t('entity.name')"
						:error-messages="goalNameError"
						autofocus
					/>
					<VTextarea v-model="goalNote" :label="t('entity.note')" rows="3" />
					<VSelect
						v-model="goalDreamId"
						:items="goalDreamSelectItems"
						item-title="title"
						item-value="value"
						:label="t('goal.dreamLabel')"
					/>
					<DeadlineField v-model="goalDeadline" />
				</template>

				<template v-else>
					<VTextField
						ref="nameField"
						v-model="taskName"
						:label="t('entity.name')"
						:error-messages="taskNameError"
						autofocus
					/>
					<VTextarea v-model="taskNote" :label="t('entity.note')" rows="3" />
					<div :class="$style.flags">
						<VSwitch
							v-model="taskImportant"
							:label="t('task.important')"
							color="primary"
							hide-details
						/>
						<VSwitch v-model="taskUrgent" :label="t('task.urgent')" color="primary" hide-details />
					</div>
					<VSelect
						v-model="taskGoalId"
						:items="taskGoalSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.goalLabel')"
					/>
					<ScheduleField v-model="taskSchedule" />
				</template>
			</VCardText>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiPlusThick } from '@mdi/js';
import type { DreamDraft } from '@/stores/dreams';
import type { GoalDraft } from '@/stores/goals';
import type { TaskDraft } from '@/stores/tasks';
import DeadlineField from './DeadlineField.vue';
import ScheduleField from './ScheduleField.vue';
import type { Deadline, Schedule } from '@/types';

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
const nameField = useTemplateRef<{ focus: () => void }>('nameField');

const dreamName = ref('');
const dreamNote = ref('');

const goalName = ref('');
const goalNote = ref('');
const goalDreamId = ref('');
const goalDeadline = ref<Deadline | undefined>(undefined);

const taskName = ref('');
const taskNote = ref('');
const taskImportant = ref(false);
const taskUrgent = ref(false);
const taskGoalId = ref('');
const taskSchedule = ref<Schedule | undefined>(undefined);

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
	goalDeadline.value = undefined;
	taskName.value = '';
	taskNote.value = '';
	taskImportant.value = false;
	taskUrgent.value = false;
	taskGoalId.value = '';
	taskSchedule.value = undefined;
});

function trySave(): boolean {
	if (activeTab.value === 'dream') {
		if (dreamName.value.trim() === '') {
			showErrors.value = true;
			return false;
		}

		const trimmedNote = dreamNote.value.trim();
		emit('save-dream', {
			name: dreamName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
		});
		return true;
	}

	if (activeTab.value === 'goal') {
		if (goalName.value.trim() === '') {
			showErrors.value = true;
			return false;
		}

		const trimmedNote = goalNote.value.trim();
		emit('save-goal', {
			name: goalName.value.trim(),
			note: trimmedNote === '' ? undefined : trimmedNote,
			dreamId: goalDreamId.value === '' ? undefined : goalDreamId.value,
			deadline: goalDeadline.value,
		});
		return true;
	}

	if (taskName.value.trim() === '') {
		showErrors.value = true;
		return false;
	}

	const trimmedNote = taskNote.value.trim();
	emit('save-task', {
		name: taskName.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: taskImportant.value,
		urgent: taskUrgent.value,
		goalId: taskGoalId.value === '' ? undefined : taskGoalId.value,
		schedule: taskSchedule.value,
	});
	return true;
}

function onSave(): void {
	if (trySave()) {
		open.value = false;
	}
}

function onSaveAndNew(): void {
	if (!trySave()) {
		return;
	}

	showErrors.value = false;
	if (activeTab.value === 'dream') {
		dreamName.value = '';
		dreamNote.value = '';
	} else if (activeTab.value === 'goal') {
		goalName.value = '';
		goalNote.value = '';
	} else {
		taskName.value = '';
		taskNote.value = '';
	}

	void nextTick(() => nameField.value?.focus());
}
</script>
