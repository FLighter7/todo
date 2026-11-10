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

// The current page is marked by more than its colour, which alone gave it 1.3:1
// against the others: a bar above its icon, and a heavier label. The bar is drawn
// in the text colour, so a forced-colours theme keeps it.
.current {
	font-weight: 700;

	&::before {
		content: '';
		position: absolute;
		top: 0.25rem;
		inset-inline: 30%;
		height: 0.1875rem;
		border-radius: 9999px;
		background-color: currentColor;
	}
}

.fabWrap {
	position: relative;
	top: -1.25rem;
}
</style>

<template>
	<nav :class="$style.bar" :aria-label="t('nav.label')">
		<div :class="$style.row">
			<VBtn
				v-for="link in before"
				:key="link.name"
				:to="{ name: link.name }"
				:class="[$style.link, route.name === link.name && $style.current]"
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
				:class="[$style.link, route.name === link.name && $style.current]"
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
import QuickAddFab from '@/containers/QuickAddFab.vue';
import { PAGE_ICONS } from '@/router';
import { useSettingsStore } from '@/stores/settings';
import type { AppPage } from '@/types';

interface NavLink {
	name: AppPage;
	icon: string;
	labelKey: string;
}

// Each side of the add button, in the order the user chose.
const LEFT_LINKS: NavLink[] = [
	{ name: 'dreams', icon: PAGE_ICONS.dreams, labelKey: 'nav.dreams' },
	{ name: 'goals', icon: PAGE_ICONS.goals, labelKey: 'nav.goals' },
	{ name: 'groups', icon: PAGE_ICONS.groups, labelKey: 'nav.groups' },
];
const RIGHT_LINKS: NavLink[] = [
	{ name: 'tasks', icon: PAGE_ICONS.tasks, labelKey: 'nav.tasks' },
	{ name: 'matrix', icon: PAGE_ICONS.matrix, labelKey: 'nav.matrix' },
];

const { t } = useI18n();
const route = useRoute();
const settings = useSettingsStore();

const shownLeft = computed(() => LEFT_LINKS.filter((link) => settings.general.pages[link.name]));
const shownRight = computed(() => RIGHT_LINKS.filter((link) => settings.general.pages[link.name]));

// The add button stands right before Tasks and the matrix, so every page keeps
// its side however many are shown. Only when nothing is left on its left does
// the first page on its right move over, so the button never leads the bar.
// With every page off it stands alone, and Tasks is reached only as the start page.
const before = computed(() =>
	shownLeft.value.length > 0 ? shownLeft.value : shownRight.value.slice(0, 1),
);
const after = computed(() =>
	shownLeft.value.length > 0 ? shownRight.value : shownRight.value.slice(1),
);
</script>
