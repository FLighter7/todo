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

// A circle per colour, at least 44px across. Each is drawn in the colour the
// palette on screen gives it, which is the sample itself, so a forced-colours
// mode must leave it.
.swatch {
	position: relative;
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

// Each native input covers its whole circle or row, unseen: a tap anywhere on
// it reaches the input, and a screen reader's highlight shows where it is. The
// colour input opens the system's own colour picker.
.input {
	position: absolute;
	z-index: 1;
	inset: 0;
	width: 100%;
	height: 100%;
	margin: 0;
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
		<!-- A native radio, unseen, inside each label: the arrow keys, the role and
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
					:class="$style.input"
					:name="name"
					:value="option.id"
				/>
				<span class="d-sr-only">{{ option.label }}</span>
				<VIcon v-if="selected === option.id" :icon="mdiCheck" />
				<VIcon v-else-if="option.id === none.id && none.icon" :icon="none.icon" />
			</label>
		</div>

		<label :for="customId" :class="[$style.customRow, $style.ring]">
			<span
				:class="[$style.swatch, !isCustom && $style.custom]"
				:style="isCustom ? { '--swatch': custom.color, '--on-swatch': custom.onColor } : {}"
			>
				<VIcon v-if="isCustom" :icon="mdiCheck" />
				<VIcon v-else :icon="mdiPlus" :class="$style.customIcon" size="small" />
			</span>
			<span class="text-body-medium">{{ customLabel }}</span>
			<input
				:id="customId"
				type="color"
				:class="$style.input"
				:value="model ?? customStart"
				:aria-describedby="hintId"
				@change="pickCustom"
			/>
		</label>

		<p :id="hintId" :class="$style.hint" class="text-body-small">{{ hint }}</p>
	</div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiPlus } from '@mdi/js';
import { isHex, type Hex } from '@/types';
import { ACCENT_SWATCHES, findSwatch } from '@/plugins/theme';

interface SwatchColors {
	color: Hex;
	/** The check drawn on the circle. */
	onColor: Hex;
}

const model = defineModel<Hex | null>({ required: true });

const props = defineProps<{
	/** The heading that names the group. */
	labelledby: string;
	/** The radio that stands for no colour of one's own, first in the group. */
	none: SwatchColors & { id: string; label: string; icon?: string };
	/** A seed as the palette on screen draws it. */
	fit: (seed: Hex) => SwatchColors;
	customLabel: string;
	hint: string;
	/** What the system's picker opens on while no colour of one's own is picked. */
	customStart: Hex;
}>();

const { t } = useI18n();
const name = useId();
const hintId = useId();
const customId = useId();

const options = computed(() => [
	props.none,
	...ACCENT_SWATCHES.map(({ id, seed }) => ({
		id,
		label: t(`settings.accents.${id}`),
		...props.fit(seed),
	})),
]);

// A colour of one's own leaves every radio unchecked: the custom circle beside
// the group is the one marked.
const selected = computed({
	get: () => (model.value === null ? props.none.id : findSwatch(model.value)),
	set: (id: string | undefined) => {
		if (id === props.none.id) {
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

const custom = computed(() => props.fit(model.value ?? props.customStart));

// On change, not on input: a picker reports every step of a drag, and each
// one would refit and save the colour.
function pickCustom(event: Event): void {
	const value = (event.target as HTMLInputElement).value;
	if (isHex(value)) {
		model.value = value;
	}
}
</script>
