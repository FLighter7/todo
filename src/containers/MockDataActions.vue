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
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import ConfirmDialog from '@/components/ConfirmDialog.vue';

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();

const confirmOpen = ref(false);

const currentCount = computed(
	() => dreams.records.length + goals.records.length + tasks.records.length,
);

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
 * Not atomic across the three `replaceAll` calls -- the same accepted
 * limitation `BackupActions.vue`'s `confirmImport` already lives with. Never
 * touches `useSettingsStore()`: sample data replaces dreams/goals/tasks only,
 * the user's `AppSettings` are out of scope for this feature entirely.
 */
async function generateAndReplace(): Promise<void> {
	const result = mockDataService.generate(resolveLocale());

	try {
		await dreams.replaceAll(result.dreams);
		await goals.replaceAll(result.goals);
		await tasks.replaceAll(result.tasks);
		emit(
			'notify',
			t('mockData.generated', {
				count: result.dreams.length + result.goals.length + result.tasks.length,
			}),
		);
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		emit('notify', t('mockData.failed', { reason }));
	}
}
</script>
