<style lang="scss" module>
.main {
	padding-bottom: calc(4rem + env(safe-area-inset-bottom));

	:global(.v-main__scroller) {
		scrollbar-gutter: stable both-edges;
	}
}

.appBar {
	:global(.v-toolbar__content) {
		padding-inline: env(safe-area-inset-left) env(safe-area-inset-right);
	}
}

.toolbarExtension {
	display: flex;
	align-items: center;
	width: 100%;
	height: 100%;
}

.snackbar {
	// Vuetify's snackbar is at least 344px wide, more than a 320px screen holds.
	:global(.v-snackbar__wrapper) {
		min-width: 0;
	}
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
	color: inherit;
	text-decoration: none;
}
</style>

<template>
	<VApp>
		<VAppBar :class="$style.appBar" density="comfortable" extension-height="56">
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

			<RouterLink to="/" :class="$style.logo">TODO</RouterLink>

			<template #append>
				<ThemeMenu />
				<LocaleMenu />
			</template>

			<template v-if="showPageToolbar" #extension>
				<div :class="$style.toolbarExtension">
					<EntityTabs v-model="entityTabs.tab" />
				</div>
			</template>
		</VAppBar>

		<VMain scrollable :class="$style.main">
			<!-- Focusable from code only: where the focus goes when a list empties under it. -->
			<h1 class="d-sr-only" tabindex="-1">{{ pageTitle }}</h1>

			<VAlert
				v-if="!store.persistent"
				type="warning"
				variant="tonal"
				class="ma-4"
				:text="t('storage.unavailable')"
			/>

			<RouterView @notify="notice = $event" />

			<!-- The live region below says the text; the snackbar's own region would say it twice. -->
			<VSnackbar
				v-model="snackbarOpen"
				:class="$style.snackbar"
				:color="snackbarColor"
				location="top"
				:timeout="snackbarTimeout"
			>
				<span aria-hidden="true">{{ snackbarText }}</span>
				<template #actions>
					<VBtn @click="snackbarOpen = false">{{ t('form.close') }}</VBtn>
				</template>
			</VSnackbar>
		</VMain>

		<div class="d-sr-only" role="status">{{ announcer.message }}</div>

		<BottomNav />
	</VApp>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useLocale } from 'vuetify';
import { mdiCogOutline, mdiSync } from '@mdi/js';
import BottomNav from './BottomNav.vue';
import LocaleMenu from '@/containers/LocaleMenu.vue';
import ThemeMenu from '@/containers/ThemeMenu.vue';
import { getStartPageOptions, readStoredStartPage, type StartPage } from '@/router';
import { storagePersistence } from '@/repositories/StoragePersistence';
import EntityTabs from '@/components/EntityTabs.vue';
import { useStorageStore } from '@/stores/storage';
import { useItemsStore } from '@/stores/items';
import { useEntityTabsStore } from '@/stores/entityTabs';
import { useAnnouncerStore } from '@/stores/announcer';

/** Routes whose page container has an Active/History toggle to host in the app-bar extension. */
const PAGES_WITH_TOOLBAR = ['tasks', 'groups', 'goals', 'dreams'];

const { t, locale } = useI18n();
const vuetifyLocale = useLocale();
const store = useStorageStore();
const items = useItemsStore();
const entityTabs = useEntityTabsStore();
const announcer = useAnnouncerStore();
const route = useRoute();
const router = useRouter();

const notice = ref('');

const showPageToolbar = computed(() => PAGES_WITH_TOOLBAR.includes(String(route.name)));

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
	void items.load();
	void storagePersistence.request();
});

// Vuetify keeps its own locale for built-in strings, so it has to follow ours. So
// does the document's language, which picks the screen reader's voice and the
// browser's hyphenation.
watch(
	locale,
	(value) => {
		vuetifyLocale.current.value = value;
		document.documentElement.lang = value;
	},
	{ immediate: true },
);

const pageTitle = computed(() => (route.meta.titleKey === undefined ? '' : t(route.meta.titleKey)));

watchEffect(() => {
	document.title = pageTitle.value === '' ? 'TODO' : `${pageTitle.value} – TODO`;
});

// A page change moves no focus, so it is said instead.
watch(
	() => route.name,
	() => announcer.announce(pageTitle.value),
);

// One snackbar for both kinds of message: store errors carry an i18n key,
// everything else arrives already translated.
const snackbarText = computed(() => (store.lastError === null ? notice.value : t(store.lastError)));

const snackbarColor = computed(() => (store.lastError === null ? undefined : 'error'));

// A notice goes by itself; an error stays until it is dismissed.
const snackbarTimeout = computed(() => (store.lastError === null ? 5000 : -1));

watch(snackbarText, (text) => {
	if (text !== '') {
		announcer.announce(text);
	}
});

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
