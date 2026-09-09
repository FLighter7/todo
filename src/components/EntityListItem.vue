<style lang="scss" module>
.item {
	// The checkbox otherwise centers against the two-line title+note block;
	// Vuetify only aligns prepend/append to the top for its own --three-line items.
	:global(.v-list-item__prepend) {
		align-self: start;
	}
}

// The checkbox's touch target (--v-selection-control-size, 40px by default) is taller
// than the title's own line box (1.5rem), so top-aligning it still leaves it sitting
// lower than the title text once a note pushes the item past one line. Pull it back up
// by half that difference so it centers on the title line, same as a note-less item.
.item:global(:has(.v-list-item-subtitle)) {
	:global(.v-list-item__prepend) {
		margin-top: calc((1.5rem - var(--v-selection-control-size, 40px)) / 2);
	}
}
</style>

<template>
	<VListItem :class="$style.item" @click="emit('click')">
		<template #prepend>
			<VCheckboxBtn
				:model-value="done"
				:aria-label="t('task.done')"
				@click.stop
				@update:model-value="emit('update:done', $event ?? false)"
			/>
		</template>

		<VListItemTitle>{{ name }}</VListItemTitle>
		<VListItemSubtitle v-if="note">{{ note }}</VListItemSubtitle>

		<template v-if="date" #append>
			<span class="text-caption text-medium-emphasis">{{ date }}</span>
		</template>
	</VListItem>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
	name: string;
	note?: string;
	done: boolean;
	date?: string;
}>();

const emit = defineEmits<{
	'update:done': [value: boolean];
	click: [];
}>();

const { t } = useI18n();
</script>
