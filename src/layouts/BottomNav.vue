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
				:to="{ name: 'dreams' }"
				:class="$style.link"
				variant="text"
				stacked
				size="small"
				:prepend-icon="mdiShimmer"
				:color="route.name === 'dreams' ? 'primary' : undefined"
			>
				{{ t('nav.dreams') }}
			</VBtn>

			<VBtn
				:to="{ name: 'goals' }"
				:class="$style.link"
				variant="text"
				stacked
				size="small"
				:prepend-icon="mdiBullseyeArrow"
				:color="route.name === 'goals' ? 'primary' : undefined"
			>
				{{ t('nav.goals') }}
			</VBtn>

			<div :class="$style.fabWrap">
				<QuickAddFab />
			</div>

			<VBtn
				:to="{ name: 'tasks' }"
				:class="$style.link"
				variant="text"
				stacked
				size="small"
				:prepend-icon="mdiFormatListBulleted"
				:color="route.name === 'tasks' ? 'primary' : undefined"
			>
				{{ t('nav.tasks') }}
			</VBtn>

			<VBtn
				:to="{ name: 'matrix' }"
				:class="$style.link"
				variant="text"
				stacked
				size="small"
				:prepend-icon="mdiViewGridOutline"
				:color="route.name === 'matrix' ? 'primary' : undefined"
			>
				{{ t('nav.matrix') }}
			</VBtn>
		</div>
	</nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiBullseyeArrow, mdiFormatListBulleted, mdiShimmer, mdiViewGridOutline } from '@mdi/js';
import QuickAddFab from '@/containers/QuickAddFab.vue';

const { t } = useI18n();
const route = useRoute();
</script>
