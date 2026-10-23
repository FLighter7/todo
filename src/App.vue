<template>
	<DefaultLayout />
</template>

<script setup lang="ts">
import { watchEffect } from 'vue';
import { useTheme } from 'vuetify';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { useSettingsStore } from '@/stores/settings';

const theme = useTheme();
const settings = useSettingsStore();

// The <html> background shows through on iOS overscroll bounce and during
// the brief window before Vuetify's own styles paint; keep it in step with
// the active theme instead of leaving it a static, light-only color.
// Vuetify's Color type also allows HSV/RGB/HSL objects, but this app's own
// theme definitions (src/plugins/vuetify.ts) only ever use hex strings.
watchEffect(() => {
	document.documentElement.style.backgroundColor = theme.current.value.colors.background as string;
});

// Runs during setup, before the first paint, so a saved text size never
// flashes in at the default first; reactive, so every write path -- the
// settings page, a backup import -- applies live. See font-scale.scss.
watchEffect(() => {
	document.documentElement.style.setProperty(
		'--app-font-scale',
		String(settings.general.fontScale),
	);
});
</script>
