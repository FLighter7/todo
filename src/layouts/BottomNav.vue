<style lang="scss" module>
.bar {
	position: fixed;
	inset-inline: 0;
	bottom: 0;
	z-index: 1005;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 2rem;
	height: 4rem;
	padding-inline: 1rem;
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
		<v-btn
			:to="{ name: 'list' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewListOutline"
			:color="route.name === 'list' ? 'primary' : undefined"
		>
			{{ t('nav.list') }}
		</v-btn>

		<div :class="$style.fabWrap">
			<quick-add-fab />
		</div>

		<v-btn
			:to="{ name: 'matrix' }"
			variant="text"
			stacked
			size="small"
			:prepend-icon="mdiViewGridOutline"
			:color="route.name === 'matrix' ? 'primary' : undefined"
		>
			{{ t('nav.matrix') }}
		</v-btn>
	</nav>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import QuickAddFab from '@/containers/QuickAddFab.vue';

const { t } = useI18n();
const route = useRoute();
</script>
