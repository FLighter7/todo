<template>
	<VContainer>
		<DreamDialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			@save="handleSave"
			@cancel="onCancel"
		/>

		<EntityList
			:groups="[]"
			:ungrouped="visible"
			:empty-text="t('dream.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
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
import { Status, type Dream } from '@/types';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useEntityTabsStore } from '@/stores/entityTabs';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import EntityList from '@/components/EntityList.vue';
import DreamDialog from '@/components/DreamDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const dreams = useDreamsStore();
const settings = useSettingsStore();
const { tab } = storeToRefs(useEntityTabsStore());
const cascade = useCascadeCancel();

const visible = computed(() => (tab.value === 'active' ? dreams.active : dreams.closed));
const showNote = computed(() => settings.dreams.rows === 2);

const dialogOpen = ref(false);
const editing = ref<Dream | null>(null);
const initialDraft = computed<Partial<DreamDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note } = editing.value;
	return { name, note };
});

function openEdit(dream: Dream): void {
	editing.value = dream;
	dialogOpen.value = true;
}

async function handleSave(draft: DreamDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await dreams.update(editing.value.id, draft);
	editing.value = null;
}

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(dreams, 'dreams', tab);

const pendingCancel = ref<Dream | null>(null);
const cascadeCounts = ref({ goals: 0, tasks: 0 });
const cascadeOpen = ref(false);

const cascadeBody = computed(() =>
	t('entity.cascadeDreamBody', {
		goals: cascadeCounts.value.goals,
		tasks: cascadeCounts.value.tasks,
	}),
);
const cascadeActions = computed(() => [
	{ key: 'only', label: t('entity.cascadeOnly') },
	{ key: 'branch', label: t('entity.cascadeBranch'), color: 'error' },
]);

function onCancel(): void {
	const dream = editing.value;
	if (!dream) {
		return;
	}

	const counts = cascade.countDreamDescendants(dream.id);
	if (counts.goals === 0 && counts.tasks === 0) {
		void dreams.close(dream.id, Status.Cancelled);
		dialogOpen.value = false;
		editing.value = null;
		return;
	}

	pendingCancel.value = dream;
	cascadeCounts.value = counts;
	cascadeOpen.value = true;
}

async function onCascadeChoice(key: string): Promise<void> {
	const dream = pendingCancel.value;
	pendingCancel.value = null;
	dialogOpen.value = false;
	editing.value = null;
	if (!dream) {
		return;
	}

	if (key === 'branch') {
		await Promise.all([
			dreams.close(dream.id, Status.Cancelled),
			cascade.cancelDreamGoals(dream.id),
		]);
	} else {
		await dreams.close(dream.id, Status.Cancelled);
	}
}
</script>
