<template>
	<ColorSwatches
		v-model="model"
		:labelledby="labelledby"
		:none="schemeOwn"
		:fit="fitted"
		:custom-label="t('settings.accentCustom')"
		:hint="t('settings.accentHint')"
		:custom-start="palette.colors.primary"
	/>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPaletteOutline } from '@mdi/js';
import ColorSwatches from './ColorSwatches.vue';
import type { ColorScheme, Hex } from '@/types';
import { SCHEMES, textRatio, type ThemeMode } from '@/plugins/theme';
import { fitAccent } from '@/utils/accent';

const model = defineModel<Hex | null>({ required: true });

const props = defineProps<{
	/** The palette on screen, which every circle is drawn for. */
	scheme: ColorScheme;
	mode: ThemeMode;
	/** The heading that names the group. */
	labelledby: string;
}>();

const { t } = useI18n();

const palette = computed(() => SCHEMES[props.scheme][props.mode]);

function fitted(seed: Hex): { color: Hex; onColor: Hex } {
	const { primary, onPrimary } = fitAccent(
		seed,
		palette.value.colors,
		textRatio(SCHEMES[props.scheme].level),
	);
	return { color: primary, onColor: onPrimary };
}

/** The radio that stands for no accent of one's own: the scheme's primary colour. */
const schemeOwn = computed(() => ({
	id: 'scheme',
	label: t('settings.accentScheme'),
	color: palette.value.colors.primary,
	onColor: palette.value.colors['on-primary'],
	icon: mdiPaletteOutline,
}));
</script>
