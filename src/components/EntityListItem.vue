<style lang="scss" module>
// Row height comes from the title line plus Vuetify's own 4px padding alone. Its min-height
// is dropped rather than lowered through the density prop, because VListItem hands its
// density down to the prepend's VCheckboxBtn and would shrink its touch target with it.
.item {
	min-height: 0;

	// The checkbox otherwise centers against the two-line title+note block;
	// Vuetify only aligns prepend/append to the top for its own --three-line items.
	:global(.v-list-item__prepend) {
		align-self: start;
	}

	// The checkbox keeps its full touch target (--v-selection-control-size, 40px), but
	// negative margins shrink its layout box to the title's own line box (1.5rem): it no
	// longer dictates the row height, overflows into the row's padding instead, and stays
	// centered on the title line with or without a note. The margin goes on the control,
	// not the prepend, because only the control's own element carries the variable.
	:global(.v-list-item__prepend > .v-selection-control) {
		margin-block: calc((1.5rem - var(--v-selection-control-size)) / 2);
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
