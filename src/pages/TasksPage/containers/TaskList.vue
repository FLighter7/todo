<template>
	<v-container>
		<v-btn-toggle v-model="tab" mandatory color="primary" class="mb-4">
			<v-btn value="active">{{ t('entity.active') }}</v-btn>
			<v-btn value="history">{{ t('entity.history') }}</v-btn>
		</v-btn-toggle>

		<entity-list
			:groups="groups"
			:ungrouped="ungrouped"
			:empty-text="t('task.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<task-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			:goal-options="goalOptions"
			@save="handleSave"
			@cancel="onCancel"
		/>

		<confirm-dialog
			v-model="toggleConfirmOpen"
			:title="toggleConfirmTitle"
			:body="toggleConfirmBody"
			:actions="toggleConfirmActions"
			@choose="onToggleChoice"
		/>
	</v-container>
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
const editing = ref<Task | null>(null);
const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent, goalId, schedule } = editing.value;
	return { name, note, important, urgent, goalId, schedule };
});

const goalOptions = computed(() => {
	const options = goals.active.map((goal) => ({ value: goal.id, title: goal.name }));
	const currentGoalId = editing.value?.goalId;

	if (currentGoalId !== undefined && !options.some((option) => option.value === currentGoalId)) {
		const closedGoal = goals.records.find((goal) => goal.id === currentGoalId);
		if (closedGoal) {
			options.push({ value: closedGoal.id, title: closedGoal.name });
		}
	}

	return options;
});

function openEdit(task: Task): void {
	editing.value = task;
	dialogOpen.value = true;
}

async function handleSave(draft: TaskDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await tasks.update(editing.value.id, draft);
	editing.value = null;
}

function onCancel(): void {
	const task = editing.value;
	if (!task) {
		return;
	}

	void tasks.close(task.id, Status.Cancelled);
	dialogOpen.value = false;
	editing.value = null;
}
</script>
