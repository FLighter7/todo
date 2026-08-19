<style lang="scss" module>
.bar {
	position: fixed;
	inset-inline: 0;
	bottom: 0;
	z-index: 1005;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.25rem;
	height: 4rem;
	padding-inline: 0.5rem;
	padding-bottom: env(safe-area-inset-bottom);
	background-color: rgb(var(--v-theme-surface));
	border-top: 1px solid rgb(var(--v-theme-outline));
}

.fabWrap {
	position: relative;
	top: -1.25rem;
}
</style>

<template>
	<nav :class="$style.bar">
		<VBtn
			:to="{ name: 'dreams' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiTelescope"
			:color="route.name === 'dreams' ? 'primary' : undefined"
		>
			{{ t('nav.dreams') }}
		</VBtn>

		<VBtn
			:to="{ name: 'goals' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiFlagOutline"
			:color="route.name === 'goals' ? 'primary' : undefined"
		>
			{{ t('nav.goals') }}
		</VBtn>

		<div :class="$style.fabWrap">
			<QuickAddFab />
		</div>

		<VBtn
			:to="{ name: 'tasks' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewListOutline"
			:color="route.name === 'tasks' ? 'primary' : undefined"
		>
			{{ t('nav.tasks') }}
		</VBtn>

		<VBtn
			:to="{ name: 'matrix' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewGridOutline"
			:color="route.name === 'matrix' ? 'primary' : undefined"
		>
			{{ t('nav.matrix') }}
		</VBtn>
	</nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiFlagOutline, mdiTelescope, mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import QuickAddFab from '@/containers/QuickAddFab.vue';

const { t } = useI18n();
const route = useRoute();
</script>
