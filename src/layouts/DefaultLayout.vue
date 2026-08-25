<style lang="scss" module>
.main {
	padding-bottom: calc(4rem + env(safe-area-inset-bottom));

	:global(.v-main__scroller) {
		scrollbar-gutter: stable both-edges;
	}
}

.appBar {
	padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
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
	<VApp>
		<VAppBar :class="$style.appBar" density="comfortable">
			<template #prepend>
				<VBtn
					:icon="mdiCogOutline"
					variant="text"
					:aria-label="t('nav.settings')"
					@click="onNavIconClick('settings')"
				/>
				<VBtn
					:icon="mdiSync"
					variant="text"
					:aria-label="t('sync.title')"
					@click="onNavIconClick('sync')"
				/>
			</template>

			<span :class="$style.logo">TODO</span>

			<template #append>
				<ThemeMenu />
				<LocaleMenu />
			</template>
		</VAppBar>

		<VMain scrollable :class="$style.main">
			<VAlert
				v-if="!store.persistent"
				type="warning"
				variant="tonal"
				class="ma-4"
				:text="t('storage.unavailable')"
			/>

			<RouterView @notify="notice = $event" />

			<VSnackbar v-model="snackbarOpen" :color="snackbarColor" location="top" timeout="5000">
				{{ snackbarText }}
			</VSnackbar>
		</VMain>

		<BottomNav />
	</VApp>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useLocale } from 'vuetify';
import { mdiCogOutline, mdiSync } from '@mdi/js';
import BottomNav from './BottomNav.vue';
import LocaleMenu from '@/containers/LocaleMenu.vue';
import ThemeMenu from '@/containers/ThemeMenu.vue';
import { getStartPageOptions, readStoredStartPage, type StartPage } from '@/router';
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

// Prefer the route we actually landed on (e.g. a reload on /matrix) over the
// stored start page — otherwise a deep-link toggles back to the wrong place.
const initialMainRoute = getStartPageOptions().find((option) => option.value === route.name)?.value;
const lastMainRoute = ref<StartPage>(initialMainRoute ?? readStoredStartPage());

watch(
	() => route.name,
	(name) => {
		if (getStartPageOptions().some((option) => option.value === name)) {
			lastMainRoute.value = name as StartPage;
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

function onNavIconClick(target: 'settings' | 'sync'): void {
	if (route.name === target) {
		router.push({ name: lastMainRoute.value });
		return;
	}

	router.push({ name: target });
}
</script>
