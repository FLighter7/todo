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
					:active="preference === option.value"
					color="primary"
					:prepend-icon="option.icon"
					:title="t(option.labelKey)"
					:append-icon="preference === option.value ? mdiCheck : undefined"
					@click="select(option.value)"
				/>
			</v-list>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { mdiCheck, mdiThemeLightDark, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import { type AppTheme, persistTheme, readStoredTheme, resolveTheme } from '@/plugins/vuetify';

const { t } = useI18n();
const theme = useTheme();

const open = ref(false);
const preference = ref<AppTheme>(readStoredTheme());

const options: Array<{ value: AppTheme; labelKey: string; icon: string }> = [
	{ value: 'system', labelKey: 'settings.themeSystem', icon: mdiThemeLightDark },
	{ value: 'light', labelKey: 'settings.themeLight', icon: mdiWeatherSunny },
	{ value: 'dark', labelKey: 'settings.themeDark', icon: mdiWeatherNight },
];

const themeIcon = computed(
	() => options.find((option) => option.value === preference.value)?.icon ?? mdiThemeLightDark,
);

function select(value: AppTheme): void {
	preference.value = value;
	persistTheme(value);
	theme.change(resolveTheme(value));
	open.value = false;
}

function syncWithSystem(event: MediaQueryListEvent): void {
	if (preference.value === 'system') {
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
