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
	<VCard
		:class="$style.card"
		:variant="accent ? 'tonal' : 'outlined'"
		:color="accent ? 'primary' : undefined"
	>
		<VCardTitle :class="$style.title">
			<VIcon :icon="icon" size="small" />
			<span class="text-body-large" :class="quadrant === 'eliminate' ? $style.muted : undefined">
				{{ t(`quadrant.${quadrant}`) }}
			</span>
			<VSpacer />
			<VBtn
				:icon="mdiPlus"
				variant="text"
				density="comfortable"
				:aria-label="t('form.add')"
				@click="emit('add', quadrant)"
			/>
		</VCardTitle>

		<VList :class="$style.list" bg-color="transparent" density="compact">
			<VListItem v-if="items.length === 0" :title="t('quadrant.empty')" disabled />

			<VListItem v-for="task in items" :key="task.id">
				<template #prepend>
					<VCheckboxBtn
						:model-value="false"
						:aria-label="t('task.done')"
						@update:model-value="emit('done', task.id)"
					/>
				</template>

				<VListItemTitle>{{ task.name }}</VListItemTitle>
			</VListItem>
		</VList>
	</VCard>
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
