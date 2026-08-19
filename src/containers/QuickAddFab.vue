<style lang="scss" module>
.fab {
	box-shadow: 0 0.25rem 0.75rem rgb(var(--v-theme-on-surface) / 25%);
}
</style>

<template>
	<VBtn
		:class="$style.fab"
		:icon="mdiPlus"
		color="primary"
		variant="flat"
		size="large"
		:aria-label="t('form.add')"
		@click="dialogOpen = true"
	/>

	<AddEntityDialog
		v-model="dialogOpen"
		:default-tab="defaultTab"
		:dream-options="dreamOptions"
		:goal-options="goalOptions"
		@save-dream="handleDreamSave"
		@save-goal="handleGoalSave"
		@save-task="handleTaskSubmit"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiPlus } from '@mdi/js';
import AddEntityDialog from '@/components/AddEntityDialog.vue';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';

const { t } = useI18n();
const route = useRoute();
const tasksStore = useTasksStore();
const dreamsStore = useDreamsStore();
const goalsStore = useGoalsStore();

const dialogOpen = ref(false);

const defaultTab = computed<'dream' | 'goal' | 'task'>(() => {
	if (route.name === 'dreams') {
		return 'dream';
	}

	if (route.name === 'goals') {
		return 'goal';
	}

	return 'task';
});

const dreamOptions = computed(() =>
	dreamsStore.active.map((dream) => ({ value: dream.id, title: dream.name })),
);
const goalOptions = computed(() =>
	goalsStore.active.map((goal) => ({ value: goal.id, title: goal.name })),
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
