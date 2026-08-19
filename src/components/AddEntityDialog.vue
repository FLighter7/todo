<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}
</style>

<template>
	<VDialog v-model="open" max-width="480">
		<VCard variant="elevated">
			<VTabs v-model="activeTab" color="primary">
				<VTab value="dream">{{ t('dream.title') }}</VTab>
				<VTab value="goal">{{ t('goal.title') }}</VTab>
				<VTab value="task">{{ t('task.title') }}</VTab>
			</VTabs>

			<VCardText>
				<template v-if="activeTab === 'dream'">
					<VTextField
						v-model="dreamName"
						:label="t('entity.name')"
						:error-messages="dreamNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<VTextarea v-model="dreamNote" :label="t('entity.note')" rows="3" />
				</template>

				<template v-else-if="activeTab === 'goal'">
					<VTextField
						v-model="goalName"
						:label="t('entity.name')"
						:error-messages="goalNameError"
						autofocus
						@keyup.enter="onSave"
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
						v-model="taskName"
						:label="t('entity.name')"
						:error-messages="taskNameError"
						autofocus
						@keyup.enter="onSave"
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

			<VCardActions>
				<VSpacer />
				<VBtn color="primary" variant="flat" @click="onSave">{{ t('form.save') }}</VBtn>
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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
			deadline: goalDeadline.value,
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
		schedule: taskSchedule.value,
	});
	open.value = false;
}
</script>
