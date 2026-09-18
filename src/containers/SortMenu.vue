<style lang="scss" module></style>

<template>
	<VMenu>
		<template #activator="{ props: menuProps }">
			<VBtn :icon="mdiSort" variant="text" :aria-label="t('entity.sortLabel')" v-bind="menuProps" />
		</template>

		<VList>
			<VListItem
				v-for="option in options"
				:key="option.value"
				:active="settings[settingsEntity].sortOrder === option.value"
				color="primary"
				:title="t(option.labelKey)"
				:append-icon="settings[settingsEntity].sortOrder === option.value ? mdiCheck : undefined"
				@click="select(option.value)"
			/>
		</VList>
	</VMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { mdiCheck, mdiSort } from '@mdi/js';
import type { SortOrder } from '@/types';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
const route = useRoute();

const options: Array<{ value: SortOrder; labelKey: string }> = [
	{ value: 'newest', labelKey: 'entity.sortNewest' },
	{ value: 'oldest', labelKey: 'entity.sortOldest' },
	{ value: 'az', labelKey: 'entity.sortAz' },
	{ value: 'za', labelKey: 'entity.sortZa' },
];

// Mounted only inside DefaultLayout's `v-if="showPageToolbar"` block, gated
// by the same PAGES_WITH_TOOLBAR check as EntityTabs -- route.name is
// therefore always one of these three. The `?? 'tasks'` fallback exists only
// to satisfy the type checker, never to be hit at runtime.
const settingsEntity = computed<SettingsEntity>(() => {
	const name = String(route.name);
	return name === 'dreams' || name === 'goals' ? name : 'tasks';
});

function select(value: SortOrder): void {
	settings.updatePageSettings(settingsEntity.value, { sortOrder: value });
}
</script>
