<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}
</style>

<template>
	<v-dialog v-model="open" max-width="480">
		<v-card variant="elevated">
			<v-tabs v-model="activeTab" color="primary">
				<v-tab value="dream">{{ t('dream.title') }}</v-tab>
				<v-tab value="goal">{{ t('goal.title') }}</v-tab>
				<v-tab value="task">{{ t('task.title') }}</v-tab>
			</v-tabs>

			<v-card-text>
				<template v-if="activeTab === 'dream'">
					<v-text-field
						v-model="dreamName"
						:label="t('entity.name')"
						:error-messages="dreamNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<v-textarea v-model="dreamNote" :label="t('entity.note')" rows="3" />
				</template>

				<template v-else-if="activeTab === 'goal'">
					<v-text-field
						v-model="goalName"
						:label="t('entity.name')"
						:error-messages="goalNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<v-textarea v-model="goalNote" :label="t('entity.note')" rows="3" />
					<v-select
						v-model="goalDreamId"
						:items="goalDreamSelectItems"
						item-title="title"
						item-value="value"
						:label="t('goal.dreamLabel')"
					/>
					<deadline-field v-model="goalDeadline" />
				</template>

				<template v-else>
					<v-text-field
						v-model="taskName"
						:label="t('entity.name')"
						:error-messages="taskNameError"
						autofocus
						@keyup.enter="onSave"
					/>
					<v-textarea v-model="taskNote" :label="t('entity.note')" rows="3" />
					<div :class="$style.flags">
						<v-switch
							v-model="taskImportant"
							:label="t('task.important')"
							color="primary"
							hide-details
						/>
						<v-switch v-model="taskUrgent" :label="t('task.urgent')" color="primary" hide-details />
					</div>
					<v-select
						v-model="taskGoalId"
						:items="taskGoalSelectItems"
						item-title="title"
						item-value="value"
						:label="t('task.goalLabel')"
					/>
					<schedule-field v-model="taskSchedule" />
				</template>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn color="primary" variant="flat" @click="onSave">{{ t('form.save') }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
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
