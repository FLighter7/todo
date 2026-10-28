<template>
	<DefaultLayout />
</template>

<script setup lang="ts">
import { watchEffect } from 'vue';
import DefaultLayout from '@/layouts/DefaultLayout.vue';
import { useAppTheme } from '@/composables/useAppTheme';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();

useAppTheme();

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
