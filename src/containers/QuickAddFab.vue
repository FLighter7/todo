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
		:group-options="groupOptions"
		:show-dream="settings.general.pages.dreams"
		:show-goal="settings.general.pages.goals"
		:show-group="settings.general.pages.groups"
		:show-task="!isPageHidden(settings, 'tasks') || !isPageHidden(settings, 'matrix')"
		@save-dream="handleDreamSave"
		@save-goal="handleGoalSave"
		@save-group="handleGroupSave"
		@save-task="handleTaskSubmit"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiPlus } from '@mdi/js';
import AddEntityDialog from '@/components/AddEntityDialog.vue';
import {
	ItemType,
	isPageHidden,
	type DreamDraft,
	type GoalDraft,
	type GroupDraft,
	type TaskDraft,
} from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const route = useRoute();
const items = useItemsStore();
const settings = useSettingsStore();

const dialogOpen = ref(false);

const defaultTab = computed<'dream' | 'goal' | 'group' | 'task'>(() => {
	if (route.name === 'dreams') {
		return 'dream';
	}

	if (route.name === 'goals') {
		return 'goal';
	}

	if (route.name === 'groups') {
		return 'group';
	}

	return 'task';
});

const dreamOptions = computed(() =>
	items.dreams.active.map((dream) => ({ value: dream.id, title: dream.name })),
);
const goalOptions = computed(() =>
	items.goals.active.map((goal) => ({ value: goal.id, title: goal.name })),
);
const groupOptions = computed(() =>
	items.groups.active.map((group) => ({ value: group.id, title: group.name })),
);

async function handleTaskSubmit(draft: TaskDraft): Promise<void> {
	await items.add(ItemType.Task, draft);
}

async function handleDreamSave(draft: DreamDraft): Promise<void> {
	await items.add(ItemType.Dream, draft);
}

async function handleGoalSave(draft: GoalDraft): Promise<void> {
	await items.add(ItemType.Goal, draft);
}

async function handleGroupSave(draft: GroupDraft): Promise<void> {
	await items.add(ItemType.Group, draft);
}
</script>
