<style lang="scss" module>
.swatches {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5rem;
}

.ring:has(:focus-visible) {
	outline: var(--v-app-focus-width) solid rgb(var(--v-theme-primary));
	outline-offset: 2px;
}

// A circle per accent, at least 44px across. Each is drawn in the colour it
// would give this palette, which is the sample itself, so a forced-colours mode
// must leave it.
.swatch {
	display: flex;
	flex: none;
	align-items: center;
	justify-content: center;
	width: 2.75rem;
	height: 2.75rem;
	border-radius: 50%;
	background: var(--swatch);
	color: var(--on-swatch);
	cursor: pointer;
	forced-color-adjust: none;
}

// The custom colour is a row of its own under the group rather than one more
// circle in it: a radio group may hold only radios, and a circle of every hue
// says less than its name does.
.customRow {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 0.75rem;
	margin-top: 0.5rem;
	padding-right: 1rem;
	border-radius: 1.375rem;
	cursor: pointer;
}

// Until a colour of one's own is picked, its circle shows every hue at once.
.custom {
	background: conic-gradient(
		from 90deg,
		#e53935,
		#fdd835,
		#43a047,
		#00acc1,
		#1e88e5,
		#8e24aa,
		#e53935
	);
	color: #000000;
}

.customIcon {
	border-radius: 50%;
	background: #ffffff;
}

// The native colour input covers the whole row, unseen, so that a tap anywhere
// on it opens the system's own colour picker.
.colorInput {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	padding: 0;
	border: 0;
	opacity: 0;
	cursor: pointer;
}

.hint {
	margin-top: 0.5rem;
	color: rgb(var(--v-theme-on-surface-variant));
}
</style>

<template>
	<div>
		<!-- A native radio, hidden, inside each label: the arrow keys, the role and
		     the checked state are the browser's own. -->
		<div role="radiogroup" :aria-labelledby="labelledby" :class="$style.swatches">
			<label
				v-for="option in options"
				:key="option.id"
				:for="`${name}-${option.id}`"
				:class="[$style.swatch, $style.ring]"
				:style="{ '--swatch': option.color, '--on-swatch': option.onColor }"
			>
				<input
					:id="`${name}-${option.id}`"
					v-model="selected"
					type="radio"
					class="d-sr-only"
					:name="name"
					:value="option.id"
				/>
				<span class="d-sr-only">{{ option.label }}</span>
				<VIcon v-if="selected === option.id" :icon="mdiCheck" />
				<VIcon v-else-if="option.id === SCHEME_OWN" :icon="mdiPaletteOutline" />
			</label>
		</div>

		<label :for="customId" :class="[$style.customRow, $style.ring]">
			<span
				:class="[$style.swatch, !isCustom && $style.custom]"
				:style="isCustom ? { '--swatch': custom.primary, '--on-swatch': custom.onPrimary } : {}"
			>
				<VIcon v-if="isCustom" :icon="mdiCheck" />
				<VIcon v-else :icon="mdiPlus" :class="$style.customIcon" size="small" />
			</span>
			<span class="text-body-medium">{{ t('settings.accentCustom') }}</span>
			<input
				:id="customId"
				type="color"
				:class="$style.colorInput"
				:value="model ?? palette.colors.primary"
				:aria-describedby="hintId"
				@change="pickCustom"
			/>
		</label>

		<p :id="hintId" :class="$style.hint" class="text-body-small">{{ t('settings.accentHint') }}</p>
	</div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiPaletteOutline, mdiPlus } from '@mdi/js';
import { isHex, type ColorScheme, type Hex } from '@/types';
import { ACCENT_SWATCHES, SCHEMES, textRatio, type ThemeMode } from '@/plugins/theme';
import { fitAccent } from '@/utils/accent';

/** The radio that stands for no accent of one's own: the scheme's primary colour. */
const SCHEME_OWN = 'scheme';

const model = defineModel<Hex | null>({ required: true });

const props = defineProps<{
	/** The palette on screen, which every circle is drawn for. */
	scheme: ColorScheme;
	mode: ThemeMode;
	/** The heading that names the group. */
	labelledby: string;
}>();

const { t } = useI18n();
const name = useId();
const hintId = useId();
const customId = useId();

const palette = computed(() => SCHEMES[props.scheme][props.mode]);

function fitted(seed: Hex): { primary: Hex; onPrimary: Hex } {
	return fitAccent(seed, palette.value.colors, textRatio(SCHEMES[props.scheme].level));
}

const options = computed(() => [
	{
		id: SCHEME_OWN,
		label: t('settings.accentScheme'),
		color: palette.value.colors.primary,
		onColor: palette.value.colors['on-primary'],
	},
	...ACCENT_SWATCHES.map(({ id, seed }) => {
		const { primary, onPrimary } = fitted(seed);
		return { id, label: t(`settings.accents.${id}`), color: primary, onColor: onPrimary };
	}),
]);

function swatchOf(accent: Hex | null): string | undefined {
	if (accent === null) {
		return SCHEME_OWN;
	}

	return ACCENT_SWATCHES.find(({ seed }) => seed.toLowerCase() === accent.toLowerCase())?.id;
}

// A colour of one's own leaves every radio unchecked: the custom circle beside
// the group is the one marked.
const selected = computed({
	get: () => swatchOf(model.value),
	set: (id: string | undefined) => {
		if (id === SCHEME_OWN) {
			model.value = null;
			return;
		}

		const swatch = ACCENT_SWATCHES.find((candidate) => candidate.id === id);
		if (swatch) {
			model.value = swatch.seed;
		}
	},
});

const isCustom = computed(() => model.value !== null && selected.value === undefined);

const custom = computed(() => fitted(model.value ?? palette.value.colors.primary));

// On change, not on input: a picker reports every step of a drag, and each
// one would refit and save the accent.
function pickCustom(event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	if (isHex(value)) {
		model.value = value;
	}
}
</script>
