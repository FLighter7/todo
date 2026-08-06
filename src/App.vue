<style lang="scss" module>
.main {
	padding-bottom: env(safe-area-inset-bottom);
}
</style>

<template>
	<v-app>
		<v-app-bar title="Todo" density="comfortable">
			<template #append>
				<v-btn :icon="themeIcon" aria-label="Toggle theme" @click="toggleTheme" />
			</template>

			<template #extension>
				<v-tabs>
					<v-tab :to="{ name: 'list' }">List</v-tab>
					<v-tab :to="{ name: 'matrix' }">Matrix</v-tab>
				</v-tabs>
			</template>
		</v-app-bar>

		<v-main :class="$style.main">
			<router-view />
		</v-main>
	</v-app>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useTheme } from 'vuetify';
import { persistTheme } from '@/plugins/vuetify';

const theme = useTheme();

const themeIcon = computed(() =>
	theme.global.name.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny',
);

function toggleTheme(): void {
	const next = theme.global.name.value === 'dark' ? 'light' : 'dark';
	theme.global.name.value = next;
	persistTheme(next);
}
</script>
