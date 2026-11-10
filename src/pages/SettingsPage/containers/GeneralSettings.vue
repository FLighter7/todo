<style lang="scss" module>
// Each setting is a section under a heading, which also names its field. Vuetify's
// list subheader they used to be is 14px at medium emphasis, and Alegreya's small
// x-height makes it read smaller still: the headings get full contrast and a size
// that holds its own next to the fields.
.heading {
	padding: 0.625rem 1rem;
	color: rgb(var(--v-theme-on-surface));
	font-family: var(--font-display);
	font-size: 1.125rem;
	font-weight: 600;
	line-height: 1.3;
}

// The action rows wrap rather than lose their end at a large text size.
.settings :global(.v-list-item-title) {
	white-space: normal;
}

.fontScale {
	display: flex;
	align-items: center;
	gap: 1rem;
}

.fontScaleValue {
	min-width: 4rem;
	text-align: center;
}
</style>

<template>
	<div :class="$style.settings" class="py-2">
		<h2 :class="$style.heading">{{ t('settings.fontScale') }}</h2>
		<div :class="$style.fontScale" class="mx-4 mb-4">
			<VBtn
				:icon="mdiFormatFontSizeDecrease"
				:aria-label="t('settings.fontScaleDecrease')"
				:disabled="fontScaleIndex === 0"
				@click="stepFontScale(-1)"
			/>
			<span :class="$style.fontScaleValue" aria-live="polite">{{ fontScaleLabel }}</span>
			<VBtn
				:icon="mdiFormatFontSizeIncrease"
				:aria-label="t('settings.fontScaleIncrease')"
				:disabled="fontScaleIndex === FONT_SCALES.length - 1"
				@click="stepFontScale(1)"
			/>
		</div>

		<h2 :id="schemeId" :class="$style.heading">{{ t('settings.scheme') }}</h2>
		<SchemePicker
			v-model="scheme"
			:accent="settings.general.accent"
			:labelledby="schemeId"
			class="mx-4 mb-4"
		/>

		<h2 :id="accentId" :class="$style.heading">{{ t('settings.accent') }}</h2>
		<AccentPicker
			v-model="accent"
			:scheme="settings.general.scheme"
			:mode="mode"
			:labelledby="accentId"
			class="mx-4 mb-4"
		/>

		<h2 :id="startPageId" :class="$style.heading">{{ t('settings.startPage') }}</h2>
		<VSelect
			v-model="startPage"
			:aria-labelledby="startPageId"
			:items="startPageItems"
			item-title="title"
			item-value="value"
			variant="outlined"
			hide-details
			class="mx-4 mb-4"
		>
			<template #item="{ item, props: itemProps }">
				<VListItem v-bind="itemProps" :prepend-icon="item.icon" />
			</template>

			<template #selection="{ item }">
				<VIcon :icon="item.icon" class="mr-2" />
				{{ item.title }}
			</template>
		</VSelect>

		<h2 :id="cleanupDaysId" :class="$style.heading">{{ t('settings.cleanupDays') }}</h2>
		<VSelect
			v-model="cleanupDays"
			:aria-labelledby="cleanupDaysId"
			:items="cleanupDaysItems"
			variant="outlined"
			:hint="t('settings.cleanupDaysHint')"
			persistent-hint
			class="mx-4 mb-4"
		/>

		<h2 :class="$style.heading">{{ t('backup.title') }}</h2>

		<BackupActions @notify="emit('notify', $event)" />

		<h2 :class="$style.heading">{{ t('mockData.title') }}</h2>
		<MockDataActions @notify="emit('notify', $event)" />
	</div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { mdiFormatFontSizeDecrease, mdiFormatFontSizeIncrease } from '@mdi/js';
import AccentPicker from '@/components/AccentPicker.vue';
import SchemePicker from '@/components/SchemePicker.vue';
import BackupActions from '@/containers/BackupActions.vue';
import MockDataActions from '@/containers/MockDataActions.vue';
import { getStartPageOptions, type StartPage } from '@/router';
import { useSettingsStore } from '@/stores/settings';
import { FONT_SCALES, isPageHidden, type ColorScheme, type Hex } from '@/types';
import type { ThemeMode } from '@/plugins/theme';

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const settings = useSettingsStore();

const theme = useTheme();

const schemeId = useId();
const accentId = useId();
const startPageId = useId();
const cleanupDaysId = useId();

const fontScaleIndex = computed(() => FONT_SCALES.indexOf(settings.general.fontScale));

const fontScaleLabel = computed(() =>
	new Intl.NumberFormat(locale.value, { style: 'percent', maximumFractionDigits: 1 }).format(
		settings.general.fontScale,
	),
);

function stepFontScale(step: -1 | 1): void {
	const next = FONT_SCALES[fontScaleIndex.value + step];
	if (next !== undefined) {
		settings.setFontScale(next);
	}
}

const scheme = computed({
	get: () => settings.general.scheme,
	set: (value: ColorScheme) => settings.setScheme(value),
});

const accent = computed({
	get: () => settings.general.accent,
	set: (value: Hex | null) => settings.setAccent(value),
});

// The circles show each accent as the palette on screen draws it.
const mode = computed<ThemeMode>(() => (theme.current.value.dark ? 'dark' : 'light'));

const startPage = computed({
	get: () => settings.general.startPage,
	set: (value: StartPage) => settings.setStartPage(value),
});

const startPageItems = computed(() =>
	getStartPageOptions()
		.filter((option) => !isPageHidden(settings, option.value))
		.map((option) => ({
			title: t(option.labelKey),
			value: option.value,
			icon: option.icon,
		})),
);

const cleanupDays = computed({
	get: () => settings.general.cleanupDays,
	set: (value: 30 | 60 | 90) => settings.setCleanupDays(value),
});

const cleanupDaysItems = computed(() =>
	([30, 60, 90] as const).map((days) => ({
		title: t('settings.cleanupDaysOption', { days }),
		value: days,
	})),
);
</script>
