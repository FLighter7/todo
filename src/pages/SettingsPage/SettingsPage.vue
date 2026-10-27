<style lang="scss" module>
.container {
	padding-bottom: 32px;
}

// Six tabs share the page, and Vuetify's 90px minimum per tab would leave a phone
// room for barely four. They split the width by their own labels instead, and
// scroll once the screen is too narrow for all six.
.tabs {
	:global(.v-tab.v-tab.v-btn) {
		min-width: 0;
		padding-inline: 0.75rem;
	}
}
</style>

<template>
	<VContainer :class="$style.container">
		<VTabs v-model="activeTab" color="primary" grow :class="$style.tabs">
			<VTab :id="tabId('general')" value="general">{{ t('settings.general') }}</VTab>
			<VTab v-for="page in PAGE_TABS" :id="tabId(page)" :key="page" :value="page">
				{{ t(`nav.${page}`) }}
			</VTab>
		</VTabs>

		<div role="tabpanel" :aria-labelledby="tabId(activeTab)">
			<GeneralSettings v-if="activeTab === 'general'" @notify="emit('notify', $event)" />
			<PageSettings v-else :page="activeTab" />
		</div>
	</VContainer>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import type { AppPage } from '@/types';
import GeneralSettings from './containers/GeneralSettings.vue';
import PageSettings from './containers/PageSettings.vue';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();

// The user's order. A hidden page keeps its tab: switching it back on happens there.
const PAGE_TABS: AppPage[] = ['tasks', 'matrix', 'goals', 'dreams', 'groups'];

const activeTab = ref<'general' | AppPage>('general');

const idPrefix = useId();

function tabId(tab: 'general' | AppPage): string {
	return `${idPrefix}-${tab}`;
}
</script>
