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

// The quadrant's name keeps the card title's look; as a heading it is where a
// screen reader jumps from quadrant to quadrant.
.heading {
	font: inherit;
	margin: 0;
}

.muted {
	color: rgb(var(--v-theme-on-surface-variant));
}

.list {
	flex: 1 1 auto;
	overflow-y: auto;

	// A task's name wraps rather than losing its end to an ellipsis in a narrow quadrant.
	:global(.v-list-item-title) {
		white-space: normal;
		overflow-wrap: anywhere;
	}
}
</style>

<template>
	<VCard
		ref="root"
		:class="$style.card"
		:variant="accent ? 'tonal' : 'outlined'"
		:color="accent ? 'primary' : undefined"
	>
		<VCardTitle :class="$style.title">
			<VIcon :icon="icon" size="small" />
			<h2 :class="[$style.heading, quadrant === 'eliminate' ? $style.muted : undefined]">
				{{ t(`quadrant.${quadrant}`) }}
			</h2>
			<VSpacer />
			<VBtn
				:icon="mdiPlus"
				variant="text"
				:aria-label="t('quadrant.addTo', { quadrant: t(`quadrant.${quadrant}`) })"
				@click="emit('add', quadrant)"
			/>
		</VCardTitle>

		<VList :class="$style.list" bg-color="transparent" density="compact">
			<VListItem
				v-if="items.length === 0"
				:title="t('quadrant.empty')"
				class="text-medium-emphasis"
			/>

			<VListItem v-for="task in items" :key="task.id">
				<template #prepend>
					<VCheckboxBtn
						:model-value="false"
						:aria-label="t('task.doneNamed', { name: task.name })"
						@update:model-value="emit('done', task.id)"
					/>
				</template>

				<VListItemTitle>{{ task.name }}</VListItemTitle>
			</VListItem>
		</VList>
	</VCard>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus } from '@mdi/js';
import { useKeepFocusInList } from '@/composables/useKeepFocus';
import type { Task } from '@/types';
import type { QuadrantKey } from '@/utils/quadrants';

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

const card = useTemplateRef<{ $el: HTMLElement }>('root');
useKeepFocusInList(computed(() => card.value?.$el ?? null));
</script>
