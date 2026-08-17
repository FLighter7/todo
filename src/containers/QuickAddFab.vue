<style lang="scss" module>
.fab {
	box-shadow: 0 0.25rem 0.75rem rgb(var(--v-theme-on-surface) / 25%);
}
</style>

<template>
	<v-btn
		:class="$style.fab"
		:icon="mdiPlus"
		color="primary"
		variant="flat"
		size="large"
		:aria-label="t('form.add')"
		@click="dialogOpen = true"
	/>

	<dream-dialog v-if="route.name === 'dreams'" v-model="dialogOpen" mode="add" @save="handleDreamSave" />
	<goal-dialog
		v-else-if="route.name === 'goals'"
		v-model="dialogOpen"
		mode="add"
		:dream-options="dreamOptions"
		@save="handleGoalSave"
	/>
	<task-form v-else v-model="dialogOpen" @submit="handleTaskSubmit" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiPlus } from '@mdi/js';
import TaskForm from '@/components/TaskForm.vue';
import DreamDialog from '@/components/DreamDialog.vue';
import GoalDialog from '@/components/GoalDialog.vue';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';

const { t } = useI18n();
const route = useRoute();
const tasksStore = useTasksStore();
const dreamsStore = useDreamsStore();
const goalsStore = useGoalsStore();

const dialogOpen = ref(false);

const dreamOptions = computed(() =>
	dreamsStore.active.map((dream) => ({ value: dream.id, title: dream.name })),
);

async function handleTaskSubmit(draft: TaskDraft): Promise<void> {
	await tasksStore.add(draft);
}

async function handleDreamSave(draft: DreamDraft): Promise<void> {
	await dreamsStore.add(draft);
}

async function handleGoalSave(draft: GoalDraft): Promise<void> {
	await goalsStore.add(draft);
}
</script>
