<style lang="scss" module>
.hidden {
	display: none;
}
</style>

<template>
	<VListItem
		role="button"
		:prepend-icon="mdiDownloadOutline"
		:title="t('backup.export')"
		@click="exportFile"
	/>
	<VListItem
		role="button"
		:prepend-icon="mdiUploadOutline"
		:title="t('backup.import')"
		@click="pickFile"
	/>

	<input
		ref="fileInput"
		type="file"
		accept="application/json,.json"
		:aria-label="t('backup.import')"
		:class="$style.hidden"
		@change="onFileChosen"
	/>

	<VDialog v-model="confirmOpen" max-width="440" :aria-labelledby="titleId">
		<VCard variant="elevated">
			<VCardTitle :id="titleId" tag="h2">{{ t('backup.confirmTitle') }}</VCardTitle>

			<VCardText>
				<p>
					{{ t('backup.confirmBody', { incoming: incomingCount, current: currentCount }) }}
				</p>
				<p v-if="exportedAt" class="text-medium-emphasis mt-2">
					{{ t('backup.exportedAt', { date: exportedAt }) }}
				</p>
			</VCardText>

			<VCardActions class="flex-wrap justify-end">
				<VBtn variant="text" @click="cancelImport">{{ t('form.cancel') }}</VBtn>
				<VBtn color="error" variant="flat" @click="confirmImport">{{ t('backup.replace') }}</VBtn>
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { computed, ref, useId, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiDownloadOutline, mdiUploadOutline } from '@mdi/js';
import type { Backup } from '@/services/backup/BackupService';
import { BackupFormatError, backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import { useReturnFocus } from '@/composables/useKeepFocus';

const emit = defineEmits<{ notify: [message: string] }>();

const { t, locale } = useI18n();
const items = useItemsStore();
const settings = useSettingsStore();

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');
const pending = ref<Backup | null>(null);
const confirmOpen = ref(false);
const titleId = useId();

useReturnFocus(confirmOpen);

const incomingCount = computed(() => {
	const backup = pending.value;

	return backup === null ? 0 : backup.items.length;
});

const currentCount = computed(() => items.records.length);

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
	backupFile.download(
		backupService.create(items.records, {
			general: settings.general,
			dreams: settings.dreams,
			goals: settings.goals,
			groups: settings.groups,
			tasks: settings.tasks,
		}),
	);
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

	// The items swap in as one IndexedDB transaction, so a failed write leaves
	// the old list on disk rather than a mix. Settings are a separate document
	// in localStorage and follow only once the items are in. Note what this
	// catch actually reaches: the items store's persist() already swallows
	// ordinary IndexedDB write failures itself and reports them through
	// storageState.noteWriteFailure() rather than throwing, so replaceAll()
	// resolves normally even when the underlying write failed. This only
	// catches something that throws before persist() gets involved - a genuine
	// bug, since parse() has already validated the backup.
	try {
		await items.replaceAll(backup.items);
		if (backup.settings) {
			settings.replaceAll(backup.settings);
		}

		emit('notify', t('backup.restored', { count: incomingTotal(backup) }));
	} catch (error) {
		const reason = error instanceof Error ? error.message : String(error);
		emit('notify', t('backup.restoreFailed', { reason }));
	}
}

function incomingTotal(backup: Backup): number {
	return backup.items.length;
}
</script>
