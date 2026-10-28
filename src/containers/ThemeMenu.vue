<style lang="scss" module></style>

<template>
	<VBtn :icon="themeIcon" variant="text" :aria-label="t('app.toggleTheme')" @click="open = true" />

	<VDialog v-model="open" max-width="360" :aria-labelledby="titleId">
		<VCard variant="elevated">
			<VCardTitle :id="titleId" tag="h2">{{ t('settings.theme') }}</VCardTitle>

			<VList>
				<VListItem
					v-for="option in options"
					:key="option.value"
					:active="settings.general.theme === option.value"
					:aria-current="settings.general.theme === option.value ? 'true' : undefined"
					color="primary"
					:prepend-icon="option.icon"
					:title="t(option.labelKey)"
					:append-icon="settings.general.theme === option.value ? mdiCheck : undefined"
					@click="select(option.value)"
				/>
			</VList>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiThemeLightDark, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import type { AppTheme } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import { useReturnFocus } from '@/composables/useKeepFocus';

const { t } = useI18n();
const settings = useSettingsStore();

const open = ref(false);
const titleId = useId();

useReturnFocus(open);

const options: Array<{ value: AppTheme; labelKey: string; icon: string }> = [
	{ value: 'system', labelKey: 'settings.themeSystem', icon: mdiThemeLightDark },
	{ value: 'light', labelKey: 'settings.themeLight', icon: mdiWeatherSunny },
	{ value: 'dark', labelKey: 'settings.themeDark', icon: mdiWeatherNight },
];

const themeIcon = computed(
	() =>
		options.find((option) => option.value === settings.general.theme)?.icon ?? mdiThemeLightDark,
);

// The choice is applied by useAppTheme, which follows the setting itself.
function select(value: AppTheme): void {
	settings.setTheme(value);
	open.value = false;
}
</script>
