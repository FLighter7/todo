<style lang="scss" module>
.container {
	padding-bottom: 32px;
}
</style>

<template>
	<VContainer :class="$style.container">
		<EntityList
			:rows="rows"
			:empty-text="t('goal.empty')"
			:show-note="showNote"
			:date-label="dateLabel"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<GoalDialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			:dream-options="dreamOptions"
			@save="handleSave"
			@cancel="onCancel"
		/>

		<ConfirmDialog
			v-model="toggleConfirmOpen"
			:title="toggleConfirmTitle"
			:body="toggleConfirmBody"
			:actions="toggleConfirmActions"
			@choose="onToggleChoice"
		/>

		<ConfirmDialog
			v-model="cascadeOpen"
			:title="t('entity.cascadeTitle')"
			:body="cascadeBody"
			:actions="cascadeActions"
			@choose="onCascadeChoice"
		/>
	</VContainer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { Status, type Goal } from '@/types';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';
import { useDreamsStore } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useEntityTabsStore } from '@/stores/entityTabs';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import { useSortedEntityRows } from '@/composables/useSortedEntityRows';
import { formatDeadline } from '@/utils/deadline';
import EntityList from '@/components/EntityList.vue';
import GoalDialog from '@/components/GoalDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t, locale } = useI18n();
const goals = useGoalsStore();
const dreams = useDreamsStore();
const settings = useSettingsStore();
const { tab } = storeToRefs(useEntityTabsStore());
const cascade = useCascadeCancel();
const showNote = computed(() => settings.goals.rows === 2);

function labelFor(dreamId: string): string {
	return dreams.records.find((dream) => dream.id === dreamId)?.name ?? '';
}

function dateLabel(goal: Goal): string | undefined {
	return goal.deadline ? formatDeadline(goal.deadline, locale.value, t) : undefined;
}

const activeGrouped = computed(() => goals.groupedByDream.active);
const closedGrouped = computed(() => goals.groupedByDream.closed);

const groups = computed(() => {
	const source = tab.value === 'active' ? activeGrouped.value : closedGrouped.value;
	return source.groups.map((group) => ({
		key: group.dreamId,
		label: labelFor(group.dreamId),
		items: group.items,
	}));
});
const ungrouped = computed(
	() => (tab.value === 'active' ? activeGrouped.value : closedGrouped.value).ungrouped,
);
const rows = useSortedEntityRows(groups, ungrouped, 'goals');

const dialogOpen = ref(false);
const editing = ref<Goal | null>(null);
const initialDraft = computed<Partial<GoalDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, dreamId, deadline } = editing.value;
	return { name, note, dreamId, deadline };
});

const dreamOptions = computed(() => {
	const options = dreams.active.map((dream) => ({ value: dream.id, title: dream.name }));
	const currentDreamId = editing.value?.dreamId;

	if (currentDreamId !== undefined && !options.some((option) => option.value === currentDreamId)) {
		const closedDream = dreams.records.find((dream) => dream.id === currentDreamId);
		if (closedDream) {
			options.push({ value: closedDream.id, title: closedDream.name });
		}
	}

	return options;
});

function openEdit(goal: Goal): void {
	editing.value = goal;
	dialogOpen.value = true;
}

async function handleSave(draft: GoalDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await goals.update(editing.value.id, draft);
	editing.value = null;
}

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(goals, 'goals', tab);

const pendingCancel = ref<Goal | null>(null);
const cascadeCount = ref(0);
const cascadeOpen = ref(false);

const cascadeBody = computed(() => t('entity.cascadeGoalBody', { count: cascadeCount.value }));
const cascadeActions = computed(() => [
	{ key: 'only', label: t('entity.cascadeOnly') },
	{ key: 'branch', label: t('entity.cascadeBranch'), color: 'error' },
]);

function onCancel(): void {
	const goal = editing.value;
	if (!goal) {
		return;
	}

	const count = cascade.countGoalTasks(goal.id);
	if (count === 0) {
		void goals.close(goal.id, Status.Cancelled);
		dialogOpen.value = false;
		editing.value = null;
		return;
	}

	pendingCancel.value = goal;
	cascadeCount.value = count;
	cascadeOpen.value = true;
}

async function onCascadeChoice(key: string): Promise<void> {
	const goal = pendingCancel.value;
	pendingCancel.value = null;
	dialogOpen.value = false;
	editing.value = null;
	if (!goal) {
		return;
	}

	if (key === 'branch') {
		await Promise.all([goals.close(goal.id, Status.Cancelled), cascade.cancelGoalTasks(goal.id)]);
	} else {
		await goals.close(goal.id, Status.Cancelled);
	}
}
</script>
