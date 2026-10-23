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
import { ItemType, Status, isDream, type Goal, type GoalDraft } from '@/types';
import { useItemsStore } from '@/stores/items';
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
const items = useItemsStore();
const settings = useSettingsStore();
const { tab } = storeToRefs(useEntityTabsStore());
const cascade = useCascadeCancel();
const showNote = computed(() => settings.goals.rows === 2);

/** A goal's section is labelled by its dream whatever the dream's own status. */
function labelFor(dreamId: string): string {
	return items.byId.get(dreamId)?.name ?? '';
}

function dateLabel(goal: Goal): string | undefined {
	return goal.deadline ? formatDeadline(goal.deadline, locale.value, t) : undefined;
}

const activeSections = computed(() => items.goalsByDream.active);
const closedSections = computed(() => items.goalsByDream.closed);

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
const rows = useSortedEntityRows(sections, loose, 'goals');

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
	const options = items.dreams.active.map((dream) => ({ value: dream.id, title: dream.name }));
	const currentDreamId = editing.value?.dreamId;

	if (currentDreamId !== undefined && !options.some((option) => option.value === currentDreamId)) {
		const closedDream = items.byId.get(currentDreamId);
		if (closedDream !== undefined && isDream(closedDream)) {
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

	await items.update(ItemType.Goal, editing.value.id, draft);
	editing.value = null;
}

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(items, 'goals', tab);

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
		void items.close(goal.id, Status.Cancelled);
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
		await Promise.all([items.close(goal.id, Status.Cancelled), cascade.cancelGoalTasks(goal.id)]);
	} else {
		await items.close(goal.id, Status.Cancelled);
	}
}
</script>
