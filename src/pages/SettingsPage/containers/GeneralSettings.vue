<style lang="scss" module>
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
	<VList>
		<VListSubheader>{{ t('settings.fontScale') }}</VListSubheader>
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

		<VListSubheader>{{ t('settings.startPage') }}</VListSubheader>
		<VSelect
			v-model="startPage"
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

		<VListSubheader>{{ t('settings.cleanupDays') }}</VListSubheader>
		<VSelect
			v-model="cleanupDays"
			:items="cleanupDaysItems"
			variant="outlined"
			:hint="t('settings.cleanupDaysHint')"
			persistent-hint
			class="mx-4 mb-4"
		/>

		<VListSubheader>{{ t('backup.title') }}</VListSubheader>

		<BackupActions @notify="emit('notify', $event)" />

		<VListSubheader>{{ t('mockData.title') }}</VListSubheader>
		<MockDataActions @notify="emit('notify', $event)" />
	</VList>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiFormatFontSizeDecrease, mdiFormatFontSizeIncrease } from '@mdi/js';
import BackupActions from '@/containers/BackupActions.vue';
import MockDataActions from '@/containers/MockDataActions.vue';
import { getStartPageOptions, type StartPage } from '@/router';
import { useSettingsStore } from '@/stores/settings';
import { FONT_SCALES, isPageHidden } from '@/types';

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const settings = useSettingsStore();

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
