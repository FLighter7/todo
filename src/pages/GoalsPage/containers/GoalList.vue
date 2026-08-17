<template>
	<v-container>
		<v-btn-toggle v-model="tab" mandatory color="primary" class="mb-4">
			<v-btn value="active">{{ t('entity.active') }}</v-btn>
			<v-btn value="history">{{ t('entity.history') }}</v-btn>
		</v-btn-toggle>

		<entity-list
			:groups="groups"
			:ungrouped="ungrouped"
			:empty-text="t('goal.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
		/>

		<goal-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			:dream-options="dreamOptions"
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

		<confirm-dialog
			v-model="cascadeOpen"
			:title="t('entity.cascadeTitle')"
			:body="cascadeBody"
			:actions="cascadeActions"
			@choose="onCascadeChoice"
		/>
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Status, type Goal } from '@/types';
import { useGoalsStore, type GoalDraft } from '@/stores/goals';
import { useDreamsStore } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import EntityList from '@/components/EntityList.vue';
import GoalDialog from '@/components/GoalDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const goals = useGoalsStore();
const dreams = useDreamsStore();
const settings = useSettingsStore();
const cascade = useCascadeCancel();

const tab = ref<'active' | 'history'>('active');
const showNote = computed(() => settings.goals.rows === 2);

function labelFor(dreamId: string): string {
	return dreams.records.find((dream) => dream.id === dreamId)?.name ?? '';
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

const dialogOpen = ref(false);
const editing = ref<Goal | null>(null);
const initialDraft = computed<Partial<GoalDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, dreamId } = editing.value;
	return { name, note, dreamId };
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

const pendingToggle = ref<{ goal: Goal; done: boolean } | null>(null);
const toggleConfirmOpen = ref(false);

const toggleConfirmTitle = computed(() =>
	pendingToggle.value?.done ? t('entity.confirmDoneTitle') : t('entity.confirmReopenTitle'),
);
const toggleConfirmBody = computed(() => {
	const pending = pendingToggle.value;
	if (!pending) {
		return '';
	}

	return pending.done
		? t('entity.confirmDoneBody', { name: pending.goal.name })
		: t('entity.confirmReopenBody', { name: pending.goal.name });
});
const toggleConfirmActions = computed(() => [
	{ key: 'no', label: t('form.cancel') },
	{ key: 'yes', label: t('entity.confirm'), color: 'primary' },
]);

async function applyToggle(goal: Goal, done: boolean): Promise<void> {
	if (done) {
		await goals.close(goal.id, Status.Done);
	} else {
		await goals.reopen(goal.id);
	}
}

function onToggle(id: string): void {
	const goal = goals.records.find((record) => record.id === id);
	if (!goal) {
		return;
	}

	const markingDone = tab.value === 'active';
	const needsConfirm = markingDone ? settings.goals.confirmDone : settings.goals.confirmReopen;
	if (!needsConfirm) {
		void applyToggle(goal, markingDone);
		return;
	}

	pendingToggle.value = { goal, done: markingDone };
	toggleConfirmOpen.value = true;
}

async function onToggleChoice(key: string): Promise<void> {
	const pending = pendingToggle.value;
	pendingToggle.value = null;
	if (key !== 'yes' || !pending) {
		return;
	}

	await applyToggle(pending.goal, pending.done);
}

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
