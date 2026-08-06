<style lang="scss" module>
.main {
	padding-bottom: env(safe-area-inset-bottom);
}
</style>

<template>
	<v-app>
		<v-app-bar :title="t('app.title')" density="comfortable">
			<template #append>
				<v-btn :icon="themeIcon" :aria-label="t('app.toggleTheme')" @click="toggleTheme" />
				<v-btn icon="mdi-translate" :aria-label="t('app.toggleLanguage')" @click="toggleLanguage" />
			</template>

			<template #extension>
				<v-tabs>
					<v-tab :to="{ name: 'list' }">{{ t('nav.list') }}</v-tab>
					<v-tab :to="{ name: 'matrix' }">{{ t('nav.matrix') }}</v-tab>
				</v-tabs>
			</template>
		</v-app-bar>

		<v-main :class="$style.main">
			<v-alert
				v-if="!store.persistent"
				type="warning"
				variant="tonal"
				class="ma-4"
				:text="t('storage.unavailable')"
			/>

			<router-view />

			<v-snackbar
				:model-value="store.lastError !== null"
				color="error"
				timeout="5000"
				@update:model-value="store.dismissError()"
			>
				{{ store.lastError === null ? '' : t(store.lastError) }}
			</v-snackbar>
		</v-main>
	</v-app>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTheme } from 'vuetify';
import { persistTheme } from '@/plugins/vuetify';
import { setLocale } from '@/i18n';
import { useTodosStore } from '@/stores/todos';

const { t, locale } = useI18n();
const theme = useTheme();
const store = useTodosStore();

onMounted(() => {
	void store.load();
});

const themeIcon = computed(() =>
	theme.global.name.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny',
);

function toggleTheme(): void {
	const next = theme.global.name.value === 'dark' ? 'light' : 'dark';
	theme.global.name.value = next;
	persistTheme(next);
}

function toggleLanguage(): void {
	setLocale(locale.value === 'ru' ? 'en' : 'ru');
}
</script>
