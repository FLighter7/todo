<style lang="scss" module>
.grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 1rem;
}

@media (max-width: 600px) {
	.grid {
		grid-template-columns: 1fr;
	}
}
</style>

<template>
	<VContainer>
		<div :class="$style.grid">
			<TaskQuadrant
				v-for="key in QUADRANT_KEYS"
				:key="key"
				:quadrant="key"
				:items="items.quadrants[key]"
				:icon="quadrantMeta[key].icon"
				:accent="quadrantMeta[key].accent"
				@add="openFor"
				@done="onDone"
			/>
		</div>

		<TaskDialog
			v-model="dialogOpen"
			mode="add"
			:initial-flags="initialFlags"
			:goal-options="goalOptions"
			:group-options="groupOptions"
			:show-goal="settings.general.pages.goals"
			:show-group="settings.general.pages.groups"
			@save="onSave"
		/>
	</VContainer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	mdiAccountArrowRightOutline,
	mdiCalendarClockOutline,
	mdiFire,
	mdiTrashCanOutline,
} from '@mdi/js';
import TaskDialog from '@/components/TaskDialog.vue';
import TaskQuadrant from '../TaskQuadrant.vue';
import { ItemType, Status, type TaskDraft } from '@/types';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useAnnouncerStore } from '@/stores/announcer';
import { QUADRANT_KEYS, quadrantFlags, type QuadrantKey } from '@/utils/quadrants';

const { t } = useI18n();
const items = useItemsStore();
const settings = useSettingsStore();
const announcer = useAnnouncerStore();

const dialogOpen = ref(false);
const initialFlags = ref<{ important: boolean; urgent: boolean } | undefined>(undefined);

const goalOptions = computed(() =>
	items.goals.active.map((goal) => ({ value: goal.id, title: goal.name })),
);
const groupOptions = computed(() =>
	items.groups.active.map((group) => ({ value: group.id, title: group.name })),
);

const quadrantMeta: Record<QuadrantKey, { icon: string; accent?: boolean }> = {
	do: { icon: mdiFire, accent: true },
	schedule: { icon: mdiCalendarClockOutline },
	delegate: { icon: mdiAccountArrowRightOutline },
	eliminate: { icon: mdiTrashCanOutline },
};

// The task leaves the quadrant with nothing on screen to say why; a screen reader says it.
function onDone(id: string): void {
	const name = items.byId.get(id)?.name ?? '';
	void items.close(id, Status.Done);
	announcer.announce(t('announce.done', { name }));
}

function onSave(draft: TaskDraft): void {
	void items.add(ItemType.Task, draft);
	announcer.announce(t('announce.added', { name: draft.name }));
}

function openFor(quadrant: QuadrantKey): void {
	initialFlags.value = quadrantFlags(quadrant);
	dialogOpen.value = true;
}
</script>
