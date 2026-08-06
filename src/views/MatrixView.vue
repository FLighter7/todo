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
			<todo-quadrant
				v-for="key in QUADRANT_KEYS"
				:key="key"
				:quadrant="key"
				:items="store.quadrants[key]"
				:color="colors[key]"
				@add="openFor"
				@toggle="store.toggleDone($event)"
			/>
		</div>

		<todo-form v-model="dialogOpen" :initial="initialDraft" @submit="store.add($event)" />
	</v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import TodoForm from '@/components/TodoForm.vue';
import TodoQuadrant from '@/components/TodoQuadrant.vue';
import {
	QUADRANT_KEYS,
	quadrantFlags,
	useTodosStore,
	type QuadrantKey,
	type TodoDraft,
} from '@/stores/todos';

const store = useTodosStore();

const dialogOpen = ref(false);
const initialDraft = ref<Partial<TodoDraft>>({});

const colors: Record<QuadrantKey, string> = {
	do: 'error',
	schedule: 'primary',
	delegate: 'warning',
	eliminate: 'surface-variant',
};

function openFor(quadrant: QuadrantKey): void {
	initialDraft.value = quadrantFlags(quadrant);
	dialogOpen.value = true;
}
</script>
