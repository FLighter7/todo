<style lang="scss" module></style>

<template>
	<v-btn :icon="themeIcon" variant="text" :aria-label="t('app.toggleTheme')" @click="open = true" />

	<v-dialog v-model="open" max-width="360">
		<v-card variant="elevated">
			<v-card-title>{{ t('settings.theme') }}</v-card-title>

			<v-list>
				<v-list-item
					v-for="option in options"
					:key="option.value"
					:active="settings.general.theme === option.value"
					color="primary"
					:prepend-icon="option.icon"
					:title="t(option.labelKey)"
					:append-icon="settings.general.theme === option.value ? mdiCheck : undefined"
					@click="select(option.value)"
				/>
			</v-list>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { mdiCheck, mdiThemeLightDark, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import type { AppTheme } from '@/types';
import { resolveTheme } from '@/plugins/vuetify';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const theme = useTheme();
const settings = useSettingsStore();

const open = ref(false);

const options: Array<{ value: AppTheme; labelKey: string; icon: string }> = [
	{ value: 'system', labelKey: 'settings.themeSystem', icon: mdiThemeLightDark },
	{ value: 'light', labelKey: 'settings.themeLight', icon: mdiWeatherSunny },
	{ value: 'dark', labelKey: 'settings.themeDark', icon: mdiWeatherNight },
];

const themeIcon = computed(
	() =>
		options.find((option) => option.value === settings.general.theme)?.icon ?? mdiThemeLightDark,
);

function select(value: AppTheme): void {
	settings.setTheme(value);
	open.value = false;
}

// Reactive, not just from select(): this makes every write path -- setTheme,
// replaceAll (backup import, sync accept) -- apply live, not only a click
// through this menu's own list.
watch(
	() => settings.general.theme,
	(value) => theme.change(resolveTheme(value)),
	{ immediate: true },
);

function syncWithSystem(event: MediaQueryListEvent): void {
	if (settings.general.theme === 'system') {
		theme.change(event.matches ? 'dark' : 'light');
	}
}

const media = window.matchMedia('(prefers-color-scheme: dark)');

onMounted(() => {
	media.addEventListener('change', syncWithSystem);
});

onUnmounted(() => {
	media.removeEventListener('change', syncWithSystem);
});
</script>
