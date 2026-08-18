<template>
	<p v-if="groups.length === 0 && ungrouped.length === 0" class="text-medium-emphasis pa-4">
		{{ emptyText }}
	</p>

	<template v-else>
		<entity-list-group v-for="group in groups" :key="group.key" :label="group.label">
			<entity-list-item
				v-for="item in group.items"
				:key="item.id"
				:name="item.name"
				:note="showNote ? item.note : undefined"
				:done="item.status === Status.Done"
				:date="dateLabel?.(item)"
				@update:done="emit('toggle', item.id, $event)"
				@click="emit('open', item)"
			/>
		</entity-list-group>

		<entity-list-item
			v-for="item in ungrouped"
			:key="item.id"
			:name="item.name"
			:note="showNote ? item.note : undefined"
			:done="item.status === Status.Done"
			:date="dateLabel?.(item)"
			@update:done="emit('toggle', item.id, $event)"
			@click="emit('open', item)"
		/>
	</template>
</template>

<script setup lang="ts" generic="T extends EntityBase">
import EntityListGroup from './EntityListGroup.vue';
import EntityListItem from './EntityListItem.vue';
import { Status, type EntityBase } from '@/types';

defineProps<{
	groups: Array<{ key: string; label: string; items: T[] }>;
	ungrouped: T[];
	emptyText: string;
	showNote: boolean;
	dateLabel?: (item: T) => string | undefined;
}>();

const emit = defineEmits<{
	toggle: [id: string, done: boolean];
	open: [item: T];
}>();
</script>
