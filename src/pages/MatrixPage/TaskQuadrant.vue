<style lang="scss" module>
.card {
	display: flex;
	flex-direction: column;
	height: 100%;
	min-height: 12rem;
}

.title {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.muted {
	color: rgb(var(--v-theme-on-surface-variant));
}

.list {
	flex: 1 1 auto;
	overflow-y: auto;
}
</style>

<template>
	<v-card
		:class="$style.card"
		:variant="accent ? 'tonal' : 'outlined'"
		:color="accent ? 'primary' : undefined"
	>
		<v-card-title :class="$style.title">
			<v-icon :icon="icon" size="small" />
			<span class="text-subtitle-1" :class="quadrant === 'eliminate' ? $style.muted : undefined">
				{{ t(`quadrant.${quadrant}`) }}
			</span>
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

			<v-list-item v-for="task in items" :key="task.id">
				<template #prepend>
					<v-checkbox-btn
						:model-value="false"
						:aria-label="t('task.done')"
						@update:model-value="emit('done', task.id)"
					/>
				</template>

				<v-list-item-title>{{ task.name }}</v-list-item-title>
			</v-list-item>
		</v-list>
	</v-card>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { mdiPlus } from '@mdi/js';
import type { Task } from '@/types';
import type { QuadrantKey } from '@/stores/tasks';

defineProps<{
	quadrant: QuadrantKey;
	items: Task[];
	icon: string;
	accent?: boolean;
}>();

const emit = defineEmits<{
	add: [quadrant: QuadrantKey];
	done: [id: string];
}>();

const { t } = useI18n();
</script>
