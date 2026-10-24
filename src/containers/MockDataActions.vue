<template>
	<VListItem :prepend-icon="mdiAutoFix" :title="t('mockData.action')" @click="onClick" />

	<ConfirmDialog
		v-model="confirmOpen"
		:title="t('mockData.confirmTitle')"
		:body="t('mockData.confirmBody', { current: currentCount })"
		:actions="confirmActions"
		@choose="onChoose"
	/>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiAutoFix } from '@mdi/js';
import { SUPPORTED_LOCALES, type AppLocale } from '@/i18n';
import { mockDataService } from '@/services/mockData/MockDataService';
import { useItemsStore } from '@/stores/items';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const items = useItemsStore();

const confirmOpen = ref(false);

const currentCount = computed(() => items.records.length);

const confirmActions = computed(() => [
	{ key: 'no', label: t('form.cancel') },
	{ key: 'yes', label: t('mockData.replace'), color: 'error' },
]);

function onClick(): void {
	if (currentCount.value === 0) {
		void generateAndReplace();
		return;
	}

	confirmOpen.value = true;
}

function onChoose(key: string): void {
	if (key === 'yes') {
		void generateAndReplace();
	}
}

function resolveLocale(): AppLocale {
	const current = locale.value;
	return (SUPPORTED_LOCALES as readonly string[]).includes(current) ? (current as AppLocale) : 'en';
}

/**
 * One `replaceAll`, so the sample set swaps in as a single IndexedDB
 * transaction. Never touches `useSettingsStore()`: sample data replaces the
 * items only, the user's `AppSettings` are out of scope for this feature.
 */
async function generateAndReplace(): Promise<void> {
	try {
		const result = mockDataService.generate(resolveLocale());
		const generated = [...result.dreams, ...result.goals, ...result.groups, ...result.tasks];
		await items.replaceAll(generated);
		emit('notify', t('mockData.generated', { count: generated.length }));
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		emit('notify', t('mockData.failed', { reason }));
	}
}
</script>
