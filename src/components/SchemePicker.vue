<style lang="scss" module>
.schemes {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
	gap: 0.75rem;
}

// A card per scheme: a native radio, hidden, inside the label, so the arrow
// keys, the role and the checked state are the browser's own.
.scheme {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0.5rem;
	border: 1px solid rgb(var(--v-theme-outline));
	border-radius: 0.75rem;
	cursor: pointer;

	&:has(:focus-visible) {
		outline: var(--v-app-focus-width) solid rgb(var(--v-theme-primary));
		outline-offset: 2px;
	}
}

// Not by colour alone: the chosen card also carries a check by its name.
.selected {
	border-color: rgb(var(--v-theme-primary));
	box-shadow: inset 0 0 0 1px rgb(var(--v-theme-primary));
}

// What the scheme looks like, light on the left and dark on the right. Its
// colours are the sample itself, so a forced-colours mode must leave them.
.preview {
	display: flex;
	height: 3.5rem;
	overflow: hidden;
	border-radius: 0.5rem;
	forced-color-adjust: none;
}

.half {
	display: flex;
	flex: 1 1 0%;
	align-items: center;
	justify-content: center;
	background: var(--preview-background);
}

.surface {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	width: 70%;
	padding: 0.375rem;
	border: 1px solid var(--preview-outline);
	border-radius: 0.25rem;
	background: var(--preview-surface);
}

.line {
	height: 0.25rem;
	border-radius: 0.125rem;
	background: var(--preview-text);
}

.dot {
	width: 40%;
	height: 0.5rem;
	border-radius: 0.25rem;
	background: var(--preview-primary);
}

.name {
	display: flex;
	align-items: center;
	gap: 0.25rem;
	font-weight: 600;
}

.hint {
	color: rgb(var(--v-theme-on-surface-variant));
}
</style>

<template>
	<div role="radiogroup" :aria-labelledby="labelledby" :class="$style.schemes">
		<label
			v-for="scheme in COLOR_SCHEMES"
			:key="scheme"
			:for="`${name}-${scheme}`"
			:class="[$style.scheme, model === scheme && $style.selected]"
		>
			<input
				:id="`${name}-${scheme}`"
				v-model="model"
				type="radio"
				class="d-sr-only"
				:name="name"
				:value="scheme"
				:aria-labelledby="`${name}-${scheme}-name`"
				:aria-describedby="scheme === 'black' ? `${name}-black-hint` : undefined"
			/>
			<span :class="$style.preview" aria-hidden="true">
				<span
					v-for="mode in THEME_MODES"
					:key="mode"
					:class="$style.half"
					:style="previewStyle(scheme, mode)"
				>
					<span :class="$style.surface">
						<span :class="$style.line" />
						<span :class="$style.dot" />
					</span>
				</span>
			</span>
			<span :id="`${name}-${scheme}-name`" :class="$style.name" class="text-body-medium">
				<VIcon v-if="model === scheme" :icon="mdiCheckCircle" size="small" color="primary" />
				{{ t(`settings.schemes.${scheme}`) }}
			</span>
			<span
				v-if="scheme === 'black'"
				:id="`${name}-black-hint`"
				:class="$style.hint"
				class="text-body-small"
			>
				{{ t('settings.schemeBlackHint') }}
			</span>
		</label>
	</div>
</template>

<script setup lang="ts">
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheckCircle } from '@mdi/js';
import { COLOR_SCHEMES, type ColorScheme, type Hex } from '@/types';
import { THEME_MODES, paletteFor, type ThemeMode } from '@/plugins/theme';

const model = defineModel<ColorScheme>({ required: true });

const props = defineProps<{
	/** The accent in use, so that each preview shows it as that scheme would draw it. */
	accent: Hex | null;
	/** The heading that names the group. */
	labelledby: string;
}>();

const { t } = useI18n();
const name = useId();

function previewStyle(scheme: ColorScheme, mode: ThemeMode): Record<string, string> {
	const { colors } = paletteFor(scheme, mode, props.accent);
	return {
		'--preview-background': colors.background,
		'--preview-surface': colors.surface,
		'--preview-outline': colors.outline,
		'--preview-text': colors['on-surface'],
		'--preview-primary': colors.primary,
	};
}
</script>
