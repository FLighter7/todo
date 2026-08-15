<style lang="scss" module>
.main {
	padding-bottom: calc(4rem + env(safe-area-inset-bottom));
}

.logo {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	font-family: var(--font-display);
	font-size: 1.25rem;
	font-weight: 600;
	letter-spacing: 0.02em;
}
</style>

<template>
	<v-app>
		<v-app-bar density="comfortable">
			<template #prepend>
				<v-btn
					:icon="mdiCogOutline"
					variant="text"
					:aria-label="t('nav.settings')"
					@click="onGearClick"
				/>
			</template>

			<span :class="$style.logo">{{ t('app.title') }}</span>

			<template #append>
				<v-btn
					:icon="themeIcon"
					variant="text"
					:aria-label="t('app.toggleTheme')"
					@click="toggleTheme"
				/>
				<v-btn
					:icon="mdiTranslate"
					variant="text"
					:aria-label="t('app.toggleLanguage')"
					@click="toggleLanguage"
				/>
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

			<router-view @notify="notice = $event" />

			<v-snackbar v-model="snackbarOpen" :color="snackbarColor" location="top" timeout="5000">
				{{ snackbarText }}
			</v-snackbar>
		</v-main>

		<bottom-nav />
	</v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useLocale, useTheme } from 'vuetify';
import { mdiCogOutline, mdiTranslate, mdiWeatherNight, mdiWeatherSunny } from '@mdi/js';
import BottomNav from './BottomNav.vue';
import { persistTheme } from '@/plugins/vuetify';
import { setLocale } from '@/i18n';
import { readStoredStartPage } from '@/router';
import { storagePersistence } from '@/repositories/StoragePersistence';
import { useTodosStore } from '@/stores/todos';

const { t, locale } = useI18n();
const theme = useTheme();
const vuetifyLocale = useLocale();
const store = useTodosStore();
const route = useRoute();
const router = useRouter();

const notice = ref('');

const lastMainRoute = ref<'list' | 'matrix'>(readStoredStartPage());

watch(
	() => route.name,
	(name) => {
		if (name === 'list' || name === 'matrix') {
			lastMainRoute.value = name;
		}
	},
);

onMounted(() => {
	void store.load();
	void storagePersistence.request();
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
	theme.change(next);
	persistTheme(next);
}

function toggleLanguage(): void {
	setLocale(locale.value === 'ru' ? 'en' : 'ru');
}

function onGearClick(): void {
	if (route.name === 'settings') {
		router.push({ name: lastMainRoute.value });
		return;
	}

	router.push({ name: 'settings' });
}
</script>
