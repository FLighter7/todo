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
	<v-container>
		<div :class="$style.grid">
			<task-quadrant
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

		<task-form v-model="dialogOpen" :initial="initialDraft" @submit="store.add($event)" />
	</v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
	mdiAccountArrowRightOutline,
	mdiCalendarClockOutline,
	mdiFire,
	mdiTrashCanOutline,
} from '@mdi/js';
import TaskForm from '@/components/TaskForm.vue';
import TaskQuadrant from '../TaskQuadrant.vue';
import { Status } from '@/types';
import {
	QUADRANT_KEYS,
	quadrantFlags,
	useTasksStore,
	type QuadrantKey,
	type TaskDraft,
} from '@/stores/tasks';

const store = useTasksStore();

const dialogOpen = ref(false);
const initialDraft = ref<Partial<TaskDraft>>({});

const quadrantMeta: Record<QuadrantKey, { icon: string; accent?: boolean }> = {
	do: { icon: mdiFire, accent: true },
	schedule: { icon: mdiCalendarClockOutline },
	delegate: { icon: mdiAccountArrowRightOutline },
	eliminate: { icon: mdiTrashCanOutline },
};

function openFor(quadrant: QuadrantKey): void {
	initialDraft.value = quadrantFlags(quadrant);
	dialogOpen.value = true;
}
</script>
