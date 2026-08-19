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
				:items="store.quadrants[key]"
				:icon="quadrantMeta[key].icon"
				:accent="quadrantMeta[key].accent"
				@add="openFor"
				@done="store.close($event, Status.Done)"
			/>
		</div>

		<TaskDialog
			v-model="dialogOpen"
			mode="add"
			:initial-flags="initialFlags"
			:goal-options="goalOptions"
			@save="store.add($event)"
		/>
	</VContainer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
	mdiAccountArrowRightOutline,
	mdiCalendarClockOutline,
	mdiFire,
	mdiTrashCanOutline,
} from '@mdi/js';
import TaskDialog from '@/components/TaskDialog.vue';
import { useGoalsStore } from '@/stores/goals';
import TaskQuadrant from '../TaskQuadrant.vue';
import { Status } from '@/types';
import { QUADRANT_KEYS, quadrantFlags, useTasksStore, type QuadrantKey } from '@/stores/tasks';

const store = useTasksStore();
const goals = useGoalsStore();

const dialogOpen = ref(false);
const initialFlags = ref<{ important: boolean; urgent: boolean } | undefined>(undefined);

const goalOptions = computed(() =>
	goals.active.map((goal) => ({ value: goal.id, title: goal.name })),
);

const quadrantMeta: Record<QuadrantKey, { icon: string; accent?: boolean }> = {
	do: { icon: mdiFire, accent: true },
	schedule: { icon: mdiCalendarClockOutline },
	delegate: { icon: mdiAccountArrowRightOutline },
	eliminate: { icon: mdiTrashCanOutline },
};

function openFor(quadrant: QuadrantKey): void {
	initialFlags.value = quadrantFlags(quadrant);
	dialogOpen.value = true;
}
</script>
