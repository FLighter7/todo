<style lang="scss" module>
.tabs {
	position: sticky;
	top: 0;
	z-index: 1;
	width: 100%;
	background-color: rgb(var(--v-theme-background));
}
</style>

<template>
	<VContainer>
		<VBtnToggle v-model="tab" mandatory color="primary" :class="[$style.tabs, 'mb-4']">
			<VBtn value="active">{{ t('entity.active') }}</VBtn>
			<VBtn value="history">{{ t('entity.history') }}</VBtn>
		</VBtnToggle>

		<EntityList
			:groups="groups"
			:ungrouped="ungrouped"
			:empty-text="t('task.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<TaskDialog
			v-model="dialogOpen"
			mode="edit"
			:record="editingTask"
			:goal-options="goalOptions"
			@save="handleSave"
			@cancel="onCancel"
			@toggle-completion-done="onToggleCompletionDone"
			@toggle-completion-skip="onToggleCompletionSkip"
		/>

		<ConfirmDialog
			v-model="toggleConfirmOpen"
			:title="toggleConfirmTitle"
			:body="toggleConfirmBody"
			:actions="toggleConfirmActions"
			@choose="onToggleChoice"
		/>
	</VContainer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type Task } from '@/types';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';
import { useGoalsStore } from '@/stores/goals';
import { useSettingsStore } from '@/stores/settings';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import EntityList from '@/components/EntityList.vue';
import TaskDialog from '@/components/TaskDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const tasks = useTasksStore();
const goals = useGoalsStore();
const settings = useSettingsStore();

const tab = ref<'active' | 'history'>('active');
const showNote = computed(() => settings.tasks.rows === 2);

function labelFor(goalId: string): string {
	return goals.records.find((goal) => goal.id === goalId)?.name ?? '';
}

const activeGrouped = computed(() => tasks.groupedByGoal.active);
const closedGrouped = computed(() => tasks.groupedByGoal.closed);

const groups = computed(() => {
	const source = tab.value === 'active' ? activeGrouped.value : closedGrouped.value;
	return source.groups.map((group) => ({
		key: group.goalId,
		label: labelFor(group.goalId),
		items: group.items,
	}));
});
const ungrouped = computed(
	() => (tab.value === 'active' ? activeGrouped.value : closedGrouped.value).ungrouped,
);

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(tasks, 'tasks', tab);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const editingTask = computed<Task | null>(
	() => tasks.records.find((task) => task.id === editingId.value) ?? null,
);

const goalOptions = computed(() => {
	const options = goals.active.map((goal) => ({ value: goal.id, title: goal.name }));
	const currentGoalId = editingTask.value?.goalId;

	if (currentGoalId !== undefined && !options.some((option) => option.value === currentGoalId)) {
		const closedGoal = goals.records.find((goal) => goal.id === currentGoalId);
		if (closedGoal) {
			options.push({ value: closedGoal.id, title: closedGoal.name });
		}
	}

	return options;
});

function openEdit(task: Task): void {
	editingId.value = task.id;
	dialogOpen.value = true;
}

async function handleSave(draft: TaskDraft): Promise<void> {
	if (editingId.value === null) {
		return;
	}

	await tasks.update(editingId.value, draft);
	editingId.value = null;
}

function onCancel(): void {
	const id = editingId.value;
	if (id === null) {
		return;
	}

	void tasks.close(id, Status.Cancelled);
	dialogOpen.value = false;
	editingId.value = null;
}

function onToggleCompletionDone(taskId: string, occurrence: string, done: boolean): void {
	void tasks.setOccurrenceDone(taskId, occurrence, done);
}

function onToggleCompletionSkip(taskId: string, occurrence: string, skipped: boolean): void {
	void tasks.setOccurrenceSkipped(taskId, occurrence, skipped);
}
</script>
