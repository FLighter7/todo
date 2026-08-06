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
				<v-btn :icon="mdiTranslate" :aria-label="t('app.toggleLanguage')" @click="toggleLanguage" />
				<backup-menu @notify="notice = $event" />
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

			<v-snackbar v-model="snackbarOpen" :color="snackbarColor" timeout="5000">
				{{ snackbarText }}
			</v-snackbar>
		</v-main>
	</v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useLocale, useTheme } from 'vuetify';
import { mdiTranslate, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import BackupMenu from '@/components/BackupMenu.vue';
import { persistTheme } from '@/plugins/vuetify';
import { setLocale } from '@/i18n';
import { requestPersistentStorage } from '@/services/storage/persistence';
import { useTodosStore } from '@/stores/todos';

const { t, locale } = useI18n();
const theme = useTheme();
const vuetifyLocale = useLocale();
const store = useTodosStore();

const notice = ref('');

onMounted(() => {
	void store.load();
	void requestPersistentStorage();
});

// Vuetify keeps its own locale for built-in strings, so it has to follow ours.
watch(locale, (value) => {
	vuetifyLocale.current.value = value;
});

const themeIcon = computed(() =>
	theme.global.name.value === 'dark' ? mdiWeatherNight : mdiWeatherSunny,
);

// One snackbar for both kinds of message: store errors carry an i18n key,
// everything else arrives already translated.
const snackbarText = computed(() => (store.lastError === null ? notice.value : t(store.lastError)));

const snackbarColor = computed(() => (store.lastError === null ? undefined : 'error'));

const snackbarOpen = computed({
	get: () => snackbarText.value !== '',
	set: (open: boolean) => {
		if (!open) {
			store.dismissError();
			notice.value = '';
		}
	},
});

function toggleTheme(): void {
	const next = theme.global.name.value === 'dark' ? 'light' : 'dark';
	theme.global.name.value = next;
	persistTheme(next);
}

function toggleLanguage(): void {
	setLocale(locale.value === 'ru' ? 'en' : 'ru');
}
</script>
