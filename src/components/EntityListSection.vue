<style lang="scss" module>
.section {
	border: 1px solid rgb(var(--v-theme-outline));
	border-radius: 4px;
	padding: 0;
	margin: 0;
}

.section + .section {
	margin-top: 4px;
}

.legend {
	margin-left: 8px;
	font-size: 0.875rem;
	color: rgb(var(--v-theme-on-surface-variant));
	padding-inline: 0.25rem;
}

// A section in a colour of its own draws its border and its legend in it.
.colored {
	border-color: var(--section-color);

	> .legend {
		color: var(--section-color);
	}
}

// Painted, the rows take the colour too: the name, the note and the checkbox
// inherit it. A row's date and its "Cancelled" set Vuetify's medium-emphasis
// colour on themselves, so they stay the palette's grey.
.painted :global(.v-list-item) {
	color: var(--section-color);
}
</style>

<template>
	<fieldset
		:class="[$style.section, drawn && $style.colored, drawn && paintItems && $style.painted]"
		:style="drawn ? { '--section-color': drawn } : undefined"
	>
		<legend :class="$style.legend">{{ label }}</legend>
		<slot />
	</fieldset>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Hex } from '@/types';
import { sectionColorFor } from '@/plugins/theme';
import { useThemeOnScreen } from '@/composables/useThemeOnScreen';

const props = defineProps<{
	label: string;
	/** The colour the section's parent picked, drawn as the palette on screen needs it. */
	color?: Hex;
	paintItems?: boolean;
}>();

const onScreen = useThemeOnScreen();

const drawn = computed(() =>
	props.color === undefined
		? undefined
		: sectionColorFor(onScreen.value.scheme, onScreen.value.mode, props.color),
);
</script>
