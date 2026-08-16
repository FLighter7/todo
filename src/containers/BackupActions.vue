<style lang="scss" module>
.hidden {
	display: none;
}
</style>

<template>
	<v-list-item :prepend-icon="mdiDownloadOutline" :title="t('backup.export')" @click="exportFile" />
	<v-list-item :prepend-icon="mdiUploadOutline" :title="t('backup.import')" @click="pickFile" />

	<input
		ref="fileInput"
		type="file"
		accept="application/json,.json"
		:class="$style.hidden"
		@change="onFileChosen"
	/>

	<v-dialog v-model="confirmOpen" max-width="440">
		<v-card variant="elevated">
			<v-card-title>{{ t('backup.confirmTitle') }}</v-card-title>

			<v-card-text>
				<p>
					{{ t('backup.confirmBody', { incoming: incomingCount, current: currentCount }) }}
				</p>
				<p v-if="exportedAt" class="text-medium-emphasis mt-2">
					{{ t('backup.exportedAt', { date: exportedAt }) }}
				</p>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="cancelImport">{{ t('form.cancel') }}</v-btn>
				<v-btn color="error" variant="flat" @click="confirmImport">{{ t('backup.replace') }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiDownloadOutline, mdiUploadOutline } from '@mdi/js';
import type { Backup } from '@/services/backup/BackupService';
import { BackupFormatError, backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');
const pending = ref<Backup | null>(null);
const confirmOpen = ref(false);

const incomingCount = computed(() => {
	const backup = pending.value;

	return backup === null ? 0 : backup.dreams.length + backup.goals.length + backup.tasks.length;
});

const currentCount = computed(
	() => dreams.records.length + goals.records.length + tasks.records.length,
);

const exportedAt = computed(() => {
	const raw = pending.value?.exportedAt;
	if (!raw || Number.isNaN(Date.parse(raw))) {
		return '';
	}

	return new Date(raw).toLocaleString(locale.value);
});

function exportFile(): void {
	// records, not active: a backup that omitted closed records would resurrect
	// everything ever finished or abandoned on the next restore.
	backupFile.download(backupService.create(dreams.records, goals.records, tasks.records));
	emit('notify', t('backup.exported'));
}

function pickFile(): void {
	fileInput.value?.click();
}

async function onFileChosen(event: Event): Promise<void> {
	const input = event.target as HTMLInputElement;
	const file = input.files?.[0];
	// Reset immediately so choosing the same file twice still fires a change.
	input.value = '';
	if (!file) {
		return;
	}

	try {
		// Parse before touching anything: a broken file must not cost the data.
		pending.value = backupService.parse(await backupFile.readText(file));
		confirmOpen.value = true;
	} catch (error) {
		const reason = error instanceof BackupFormatError ? error.message : String(error);
		emit('notify', t('backup.invalid', { reason }));
	}
}

function cancelImport(): void {
	pending.value = null;
	confirmOpen.value = false;
}

async function confirmImport(): Promise<void> {
	const backup = pending.value;
	if (!backup) {
		return;
	}

	confirmOpen.value = false;
	pending.value = null;

	await dreams.replaceAll(backup.dreams);
	await goals.replaceAll(backup.goals);
	await tasks.replaceAll(backup.tasks);

	emit('notify', t('backup.restored', { count: incomingTotal(backup) }));
}

function incomingTotal(backup: Backup): number {
	return backup.dreams.length + backup.goals.length + backup.tasks.length;
}
</script>
