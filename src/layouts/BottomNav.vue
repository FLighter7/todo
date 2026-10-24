<style lang="scss" module>
.bar {
	position: fixed;
	inset-inline: 0;
	bottom: 0;
	z-index: 1005;
	padding-bottom: env(safe-area-inset-bottom);
	background-color: rgb(var(--v-theme-surface));
	border-top: 1px solid rgb(var(--v-theme-outline));
}

.row {
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 0.25rem;
	height: 4rem;
	padding-inline: calc(0.5rem + env(safe-area-inset-left)) calc(0.5rem + env(safe-area-inset-right));
}

.link {
	flex: 1 1 0;
	min-width: 0;
	max-width: 4rem;
	// Vuetify fixes a small stacked button at 64px, which matches the 4rem row only
	// at the default text size; filling the row keeps it inside the bar at every size.
	height: 100%;
	padding-inline: 0;
	container-type: inline-size;

	// Five pages and the add button leave a phone too little room for the labels at a
	// large text size, so a label stops growing once it would spill into the next
	// button: its longest translation ("Матрица", "Marzenia") runs about 4.4em, and
	// 22cqi keeps that inside the button's own width. The icons still follow the text
	// size. Without container units the rule is dropped and the label keeps Vuetify's size.
	:global(.v-btn__content) {
		font-size: min(var(--v-btn-size), 22cqi);
	}
}

.fabWrap {
	position: relative;
	top: -1.25rem;
}
</style>

<template>
	<nav :class="$style.bar">
		<div :class="$style.row">
			<VBtn
				v-for="link in before"
				:key="link.name"
				:to="{ name: link.name }"
				:class="$style.link"
				variant="text"
				stacked
				size="small"
				:prepend-icon="link.icon"
				:color="route.name === link.name ? 'primary' : undefined"
			>
				{{ t(link.labelKey) }}
			</VBtn>

			<div :class="$style.fabWrap">
				<QuickAddFab />
			</div>

			<VBtn
				v-for="link in after"
				:key="link.name"
				:to="{ name: link.name }"
				:class="$style.link"
				variant="text"
				stacked
				size="small"
				:prepend-icon="link.icon"
				:color="route.name === link.name ? 'primary' : undefined"
			>
				{{ t(link.labelKey) }}
			</VBtn>
		</div>
	</nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import {
	mdiBullseyeArrow,
	mdiFolderOutline,
	mdiFormatListBulleted,
	mdiShimmer,
	mdiViewGridOutline,
} from '@mdi/js';
import QuickAddFab from '@/containers/QuickAddFab.vue';
import { useSettingsStore } from '@/stores/settings';
import type { OptionalPage } from '@/types';

interface NavLink {
	name: string;
	icon: string;
	labelKey: string;
}

const OPTIONAL_LINKS: Array<NavLink & { name: OptionalPage }> = [
	{ name: 'dreams', icon: mdiShimmer, labelKey: 'nav.dreams' },
	{ name: 'goals', icon: mdiBullseyeArrow, labelKey: 'nav.goals' },
	{ name: 'groups', icon: mdiFolderOutline, labelKey: 'nav.groups' },
];
const TASKS_LINK: NavLink = { name: 'tasks', icon: mdiFormatListBulleted, labelKey: 'nav.tasks' };
const MATRIX_LINK: NavLink = { name: 'matrix', icon: mdiViewGridOutline, labelKey: 'nav.matrix' };

const { t } = useI18n();
const route = useRoute();
const settings = useSettingsStore();

const optional = computed(() => OPTIONAL_LINKS.filter((link) => settings.general.pages[link.name]));

// The add button stands right before Tasks, so Tasks and the matrix keep their
// place however many optional pages are shown. Only once none is left does
// Tasks move to its left, which keeps the button between two pages.
const before = computed(() => (optional.value.length > 0 ? optional.value : [TASKS_LINK]));
const after = computed(() =>
	optional.value.length > 0 ? [TASKS_LINK, MATRIX_LINK] : [MATRIX_LINK],
);
</script>
