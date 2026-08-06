<style lang="scss" module>
.card {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 12rem;
}

.list {
	flex: 1 1 auto;
	overflow-y: auto;
}

.done {
	opacity: 0.55;
	text-decoration: line-through;
}
</style>

<template>
	<v-card :class="$style.card" variant="tonal" :color="color">
		<v-card-title class="d-flex align-center">
			<span class="text-subtitle-1">{{ t(`quadrant.${quadrant}`) }}</span>
			<v-spacer />
			<v-btn
				:icon="mdiPlus"
				variant="text"
				density="comfortable"
				:aria-label="t('form.add')"
				@click="emit('add', quadrant)"
			/>
		</v-card-title>

		<v-list :class="$style.list" bg-color="transparent" density="compact">
			<v-list-item v-if="items.length === 0" :title="t('quadrant.empty')" disabled />

			<v-list-item v-for="todo in items" :key="todo.id">
				<template #prepend>
					<v-checkbox-btn
						:model-value="todo.done"
						:aria-label="t('todo.done')"
						@update:model-value="emit('toggle', todo.id)"
					/>
				</template>

				<v-list-item-title :class="todo.done ? $style.done : undefined">
					{{ todo.title }}
				</v-list-item-title>
			</v-list-item>
		</v-list>
	</v-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { mdiPlus } from '@mdi/js';
import type { Todo } from '@/types/todo';
import type { QuadrantKey } from '@/stores/todos';

defineProps<{
	quadrant: QuadrantKey;
	items: Todo[];
	color: string;
}>();

const emit = defineEmits<{
	add: [quadrant: QuadrantKey];
	toggle: [id: string];
}>();

const { t } = useI18n();
</script>
