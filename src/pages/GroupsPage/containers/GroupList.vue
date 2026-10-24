<style lang="scss" module>
.container {
	padding-bottom: 32px;
}
</style>

<template>
	<VContainer :class="$style.container">
		<GroupDialog
			v-model="dialogOpen"
			mode="edit"
			:initial="initialDraft"
			@save="handleSave"
			@cancel="onCancel"
		/>

		<EntityList
			:rows="rows"
			:empty-text="t('group.empty')"
			:show-note="false"
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
import { ItemType, Status, type Group, type GroupDraft } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useEntityTabsStore } from '@/stores/entityTabs';
import { useCascadeCancel } from '@/composables/useCascadeCancel';
import { useToggleConfirm } from '@/composables/useToggleConfirm';
import { useSortedEntityRows } from '@/composables/useSortedEntityRows';
import type { ListSection } from '@/utils/sortEntities';
import EntityList from '@/components/EntityList.vue';
import GroupDialog from '@/components/GroupDialog.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const { t } = useI18n();
const items = useItemsStore();
const { tab } = storeToRefs(useEntityTabsStore());
const cascade = useCascadeCancel();

const visible = computed(() =>
	tab.value === 'active' ? items.groups.active : items.groups.closed,
);
const sections = computed<ListSection<Group>[]>(() => []);
const rows = useSortedEntityRows(sections, visible, 'groups');

const dialogOpen = ref(false);
const editing = ref<Group | null>(null);
const initialDraft = computed<Partial<GroupDraft>>(() =>
	editing.value === null ? {} : { name: editing.value.name },
);

function openEdit(group: Group): void {
	editing.value = group;
	dialogOpen.value = true;
}

async function handleSave(draft: GroupDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await items.update(ItemType.Group, editing.value.id, draft);
	editing.value = null;
}

const {
	toggleConfirmOpen,
	toggleConfirmTitle,
	toggleConfirmBody,
	toggleConfirmActions,
	onToggle,
	onToggleChoice,
} = useToggleConfirm(items, 'groups', tab);

const pendingCancel = ref<Group | null>(null);
const cascadeCount = ref(0);
const cascadeOpen = ref(false);

const cascadeBody = computed(() => t('entity.cascadeGroupBody', { count: cascadeCount.value }));
const cascadeActions = computed(() => [
	{ key: 'only', label: t('entity.cascadeOnly') },
	{ key: 'branch', label: t('entity.cascadeBranch'), color: 'error' },
]);

function onCancel(): void {
	const group = editing.value;
	if (!group) {
		return;
	}

	const count = cascade.countGroupTasks(group.id);
	if (count === 0) {
		void items.close(group.id, Status.Cancelled);
		dialogOpen.value = false;
		editing.value = null;
		return;
	}

	pendingCancel.value = group;
	cascadeCount.value = count;
	cascadeOpen.value = true;
}

async function onCascadeChoice(key: string): Promise<void> {
	const group = pendingCancel.value;
	pendingCancel.value = null;
	dialogOpen.value = false;
	editing.value = null;
	if (!group) {
		return;
	}

	if (key === 'branch') {
		await Promise.all([
			items.close(group.id, Status.Cancelled),
			cascade.cancelGroupTasks(group.id),
		]);
	} else {
		await items.close(group.id, Status.Cancelled);
	}
}
</script>
