<template>
	<p v-if="rows.length === 0" class="text-medium-emphasis pa-4">
		{{ emptyText }}
	</p>

	<template v-else>
		<template
			v-for="row in rows"
			:key="row.kind === 'section' ? `section:${row.section.key}` : `item:${row.item.id}`"
		>
			<EntityListSection v-if="row.kind === 'section'" :label="row.section.label">
				<EntityListItem
					v-for="item in row.section.items"
					:key="item.id"
					:name="item.name"
					:note="showNote ? item.note : undefined"
					:done="item.status === Status.Done"
					:date="dateLabel?.(item)"
					@update:done="emit('toggle', item.id, $event)"
					@click="emit('open', item)"
				/>
			</EntityListSection>

			<EntityListItem
				v-else
				:name="row.item.name"
				:note="showNote ? row.item.note : undefined"
				:done="row.item.status === Status.Done"
				:date="dateLabel?.(row.item)"
				@update:done="emit('toggle', row.item.id, $event)"
				@click="emit('open', row.item)"
			/>
		</template>
	</template>
</template>

<script setup lang="ts" generic="T extends ItemBase">
import EntityListSection from './EntityListSection.vue';
import EntityListItem from './EntityListItem.vue';
import { Status, type ItemBase } from '@/types';
import type { EntityRow } from '@/utils/sortEntities';

defineProps<{
	rows: EntityRow<T>[];
	emptyText: string;
	showNote: boolean;
	dateLabel?: (item: T) => string | undefined;
}>();

const emit = defineEmits<{
	toggle: [id: string, done: boolean];
	open: [item: T];
}>();
</script>
