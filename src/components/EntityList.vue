<template>
	<div ref="root">
		<p v-if="rows.length === 0" class="text-medium-emphasis pa-4">
			{{ emptyText }}
		</p>

		<template v-else>
			<template v-for="block in blocks" :key="block.key">
				<EntityListSection
					v-if="block.label !== undefined"
					:label="block.label"
					:color="block.color"
					:paint-items="block.paintItems"
				>
					<div role="list">
						<EntityListItem
							v-for="item in block.items"
							:key="item.id"
							:name="item.name"
							:note="showNote ? item.note : undefined"
							:done="item.status === Status.Done"
							:cancelled="item.status === Status.Cancelled"
							:date="dateLabel?.(item)"
							@update:done="emit('toggle', item.id, $event)"
							@click="emit('open', item)"
						/>
					</div>
				</EntityListSection>

				<div v-else role="list">
					<EntityListItem
						v-for="item in block.items"
						:key="item.id"
						:name="item.name"
						:note="showNote ? item.note : undefined"
						:done="item.status === Status.Done"
						:cancelled="item.status === Status.Cancelled"
						:date="dateLabel?.(item)"
						@update:done="emit('toggle', item.id, $event)"
						@click="emit('open', item)"
					/>
				</div>
			</template>
		</template>
	</div>
</template>

<script setup lang="ts" generic="T extends ItemBase">
import { computed, useTemplateRef } from 'vue';
import EntityListSection from './EntityListSection.vue';
import EntityListItem from './EntityListItem.vue';
import { Status, type Hex, type ItemBase } from '@/types';
import type { EntityRow } from '@/utils/sortEntities';
import { useKeepFocusInList } from '@/composables/useKeepFocus';

const props = defineProps<{
	rows: EntityRow<T>[];
	emptyText: string;
	showNote: boolean;
	dateLabel?: (item: T) => string | undefined;
}>();

const emit = defineEmits<{
	toggle: [id: string, done: boolean];
	open: [item: T];
}>();

/**
 * The rows as lists: one per section, and one per run of records outside any
 * section, so that a screen reader can say how many rows a list holds and jump
 * from list to list. A label marks a section.
 */
const blocks = computed(() => {
	const result: Array<{
		key: string;
		label?: string;
		color?: Hex;
		paintItems?: boolean;
		items: T[];
	}> = [];
	for (const row of props.rows) {
		if (row.kind === 'section') {
			result.push({
				key: `section:${row.section.key}`,
				label: row.section.label,
				color: row.section.color,
				paintItems: row.section.paintItems,
				items: row.section.items,
			});
			continue;
		}

		const last = result.at(-1);
		if (last !== undefined && last.label === undefined) {
			last.items.push(row.item);
		} else {
			result.push({ key: `run:${row.item.id}`, items: [row.item] });
		}
	}
	return result;
});

useKeepFocusInList(useTemplateRef<HTMLElement>('root'));
</script>
