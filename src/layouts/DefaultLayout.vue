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

			<span :class="$style.logo">TODO</span>

			<template #append>
				<theme-menu />
				<locale-menu />
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
import { useLocale } from 'vuetify';
import { mdiCogOutline } from '@mdi/js';
import BottomNav from './BottomNav.vue';
import LocaleMenu from '@/containers/LocaleMenu.vue';
import ThemeMenu from '@/containers/ThemeMenu.vue';
import { readStoredStartPage } from '@/router';
import { storagePersistence } from '@/repositories/StoragePersistence';
import { useStorageStore } from '@/stores/storage';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';

const { t, locale } = useI18n();
const vuetifyLocale = useLocale();
const store = useStorageStore();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const route = useRoute();
const router = useRouter();

const notice = ref('');

const lastMainRoute = ref<'list' | 'matrix'>(
	readStoredStartPage() === 'matrix' ? 'matrix' : 'list',
);

watch(
	() => route.name,
	(name) => {
		if (name === 'list' || name === 'matrix') {
			lastMainRoute.value = name;
		}
	},
);

onMounted(() => {
	void dreams.load();
	void goals.load();
	void tasks.load();
	void storagePersistence.request();
});

// Vuetify keeps its own locale for built-in strings, so it has to follow ours.
watch(locale, (value) => {
	vuetifyLocale.current.value = value;
});

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

function onGearClick(): void {
	if (route.name === 'settings') {
		router.push({ name: lastMainRoute.value });
		return;
	}

	router.push({ name: 'settings' });
}
</script>
