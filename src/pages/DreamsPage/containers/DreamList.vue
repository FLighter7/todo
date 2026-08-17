<template>
	<v-container>
		<v-btn-toggle v-model="tab" mandatory color="primary" class="mb-4">
			<v-btn value="active">{{ t('entity.active') }}</v-btn>
			<v-btn value="history">{{ t('entity.history') }}</v-btn>
		</v-btn-toggle>

		<dream-dialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			@save="handleSave"
			@cancel="onCancel"
		/>

		<entity-list
			:groups="[]"
			:ungrouped="visible"
			:empty-text="t('dream.empty')"
			:show-note="showNote"
			@toggle="onToggle"
			@open="openEdit"
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
import { Status, type Dream } from '@/types';
import { useDreamsStore, type DreamDraft } from '@/stores/dreams';
import { useSettingsStore } from '@/stores/settings';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import EntityList from '@/components/EntityList.vue';
import DreamDialog from '@/components/DreamDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const dreams = useDreamsStore();
const settings = useSettingsStore();
const cascade = useCascadeCancel();

const tab = ref<'active' | 'history'>('active');
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

const pendingToggle = ref<{ dream: Dream; done: boolean } | null>(null);
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
		? t('entity.confirmDoneBody', { name: pending.dream.name })
		: t('entity.confirmReopenBody', { name: pending.dream.name });
});
const toggleConfirmActions = computed(() => [
	{ key: 'no', label: t('form.cancel') },
	{ key: 'yes', label: t('entity.confirm'), color: 'primary' },
]);

async function applyToggle(dream: Dream, done: boolean): Promise<void> {
	if (done) {
		await dreams.close(dream.id, Status.Done);
	} else {
		await dreams.reopen(dream.id);
	}
}

function onToggle(id: string): void {
	const dream = dreams.records.find((record) => record.id === id);
	if (!dream) {
		return;
	}

	const markingDone = tab.value === 'active';
	const needsConfirm = markingDone ? settings.dreams.confirmDone : settings.dreams.confirmReopen;
	if (!needsConfirm) {
		void applyToggle(dream, markingDone);
		return;
	}

	pendingToggle.value = { dream, done: markingDone };
	toggleConfirmOpen.value = true;
}

async function onToggleChoice(key: string): Promise<void> {
	const pending = pendingToggle.value;
	pendingToggle.value = null;
	if (key !== 'yes' || !pending) {
		return;
	}

	await applyToggle(pending.dream, pending.done);
}

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
