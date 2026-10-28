<style lang="scss" module>
.label {
	margin-bottom: 0.5rem;
	color: rgb(var(--v-theme-on-surface-variant));
}
</style>

<template>
	<div class="mt-2">
		<div :id="labelId" :class="$style.label" class="text-body-medium">{{ t('entity.color') }}</div>
		<ColorSwatches
			v-model="swatch"
			:labelledby="labelId"
			:none="none"
			:fit="fit"
			:custom-label="t('entity.colorCustom')"
			:hint="t('entity.colorHint')"
			:custom-start="palette.colors['on-surface-variant']"
		/>
		<VSwitch
			v-model="paintItems"
			:label="t('entity.paintItems')"
			:disabled="color === undefined"
			color="primary"
			hide-details
		/>
	</div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import ColorSwatches from './ColorSwatches.vue';
import type { Hex } from '@/types';
import { SCHEMES, sectionColorFor } from '@/plugins/theme';
import { useThemeOnScreen } from '@/composables/useThemeOnScreen';

/** The colour as picked; none leaves the section the palette's own grey. */
const color = defineModel<Hex | undefined>('color');
/** Whether the rows inside take the colour too. Off and out of reach while there is none. */
const paintItems = defineModel<boolean>('paintItems', { default: false });

const { t } = useI18n();
const labelId = useId();
const onScreen = useThemeOnScreen();

const palette = computed(() => SCHEMES[onScreen.value.scheme][onScreen.value.mode]);

const swatch = computed({
	get: () => color.value ?? null,
	set: (value: Hex | null) => {
		color.value = value ?? undefined;
	},
});

// Each circle is the colour a section draws, so the check on it is in the
// background colour, which stands as far from it as the page does.
function fit(seed: Hex): { color: Hex; onColor: Hex } {
	return {
		color: sectionColorFor(onScreen.value.scheme, onScreen.value.mode, seed),
		onColor: palette.value.colors.background,
	};
}

/** No colour of one's own: the grey a section's legend is drawn in. */
const none = computed(() => ({
	id: 'default',
	label: t('entity.colorDefault'),
	color: palette.value.colors['on-surface-variant'],
	onColor: palette.value.colors.background,
}));
</script>
