<style lang="scss" module>
// The colour as the section draws it, beside its name, which says it in words.
.dot {
	display: inline-block;
	width: 0.75rem;
	height: 0.75rem;
	border-radius: 50%;
	background: var(--dot);
	vertical-align: -0.0625rem;
	forced-color-adjust: none;
}
</style>

<template>
	<p v-if="color" class="text-body-medium mt-2 text-medium-emphasis">
		{{ t('entity.color') }}:
		<span :class="$style.dot" :style="{ '--dot': drawn }" aria-hidden="true" />
		{{ text }}
	</p>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Hex } from '@/types';
import { findSwatch, sectionColorFor } from '@/plugins/theme';
import { useThemeOnScreen } from '@/composables/useThemeOnScreen';

const props = defineProps<{ color?: Hex; paintItems?: boolean }>();

const { t } = useI18n();
const onScreen = useThemeOnScreen();

const text = computed(() => {
	const swatch = props.color === undefined ? undefined : findSwatch(props.color);
	const name = swatch === undefined ? t('entity.colorCustom') : t(`settings.accents.${swatch}`);
	return props.paintItems ? `${name}, ${t('entity.paintItemsOn')}` : name;
});

const drawn = computed(() =>
	props.color === undefined
		? undefined
		: sectionColorFor(onScreen.value.scheme, onScreen.value.mode, props.color),
);
</script>
