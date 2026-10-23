<style lang="scss" module>
.container {
	padding-bottom: 32px;
}
</style>

<template>
	<VContainer :class="$style.container">
		<EntityList
			:rows="rows"
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
import { storeToRefs } from 'pinia';
import { ItemType, Status, isGoal, isTask, type Task, type TaskDraft } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useEntityTabsStore } from '@/stores/entityTabs';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import { useSortedEntityRows } from '@/composables/useSortedEntityRows';
import EntityList from '@/components/EntityList.vue';
import TaskDialog from '@/components/TaskDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const items = useItemsStore();
const settings = useSettingsStore();
const { tab } = storeToRefs(useEntityTabsStore());
const showNote = computed(() => settings.tasks.rows === 2);

/** A task's section is labelled by its goal whatever the goal's own status. */
function labelFor(goalId: string): string {
	return items.byId.get(goalId)?.name ?? '';
}

const activeSections = computed(() => items.tasksByGoal.active);
const closedSections = computed(() => items.tasksByGoal.closed);

const sections = computed(() => {
	const source = tab.value === 'active' ? activeSections.value : closedSections.value;
	return source.sections.map((section) => ({
		key: section.parentId,
		label: labelFor(section.parentId),
		items: section.items,
	}));
});
const loose = computed(
	() => (tab.value === 'active' ? activeSections.value : closedSections.value).loose,
);
const rows = useSortedEntityRows(sections, loose, 'tasks');

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(items, 'tasks', tab);

const dialogOpen = ref(false);
const editingId = ref<string | null>(null);
const editingTask = computed<Task | null>(() => {
	const record = editingId.value === null ? undefined : items.byId.get(editingId.value);
	return record !== undefined && isTask(record) ? record : null;
});

const goalOptions = computed(() => {
	const options = items.goals.active.map((goal) => ({ value: goal.id, title: goal.name }));
	const currentGoalId = editingTask.value?.goalId;

	if (currentGoalId !== undefined && !options.some((option) => option.value === currentGoalId)) {
		const closedGoal = items.byId.get(currentGoalId);
		if (closedGoal !== undefined && isGoal(closedGoal)) {
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

	await items.update(ItemType.Task, editingId.value, draft);
	editingId.value = null;
}

function onCancel(): void {
	const id = editingId.value;
	if (id === null) {
		return;
	}

	void items.close(id, Status.Cancelled);
	dialogOpen.value = false;
	editingId.value = null;
}

function onToggleCompletionDone(taskId: string, occurrence: string, done: boolean): void {
	void items.setOccurrenceDone(taskId, occurrence, done);
}

function onToggleCompletionSkip(taskId: string, occurrence: string, skipped: boolean): void {
	void items.setOccurrenceSkipped(taskId, occurrence, skipped);
}
</script>
