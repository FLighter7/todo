<style lang="scss" module>
.page {
	max-width: 520px;
	margin-inline: auto;
}
</style>

<template>
	<v-container :class="$style.page">
		<v-list>
			<v-list-subheader>{{ t('settings.startPage') }}</v-list-subheader>
			<v-btn-toggle
				v-model="startPage"
				mandatory
				variant="outlined"
				divided
				class="mx-4 mb-4"
				@update:model-value="persistStartPage($event)"
			>
				<v-btn value="list" :prepend-icon="mdiViewListOutline">{{ t('nav.list') }}</v-btn>
				<v-btn value="matrix" :prepend-icon="mdiViewGridOutline">{{ t('nav.matrix') }}</v-btn>
			</v-btn-toggle>

			<v-list-item
				:to="{ name: 'sync' }"
				:title="t('sync.title')"
				:prepend-icon="mdiSync"
				:append-icon="mdiChevronRight"
			/>

			<v-list-subheader>{{ t('backup.title') }}</v-list-subheader>

			<backup-actions @notify="emit('notify', $event)" />
		</v-list>
	</v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiChevronRight, mdiSync, mdiViewGridOutline, mdiViewListOutline } from '@mdi/js';
import BackupActions from '@/containers/BackupActions.vue';
import { persistStartPage, readStoredStartPage, type StartPage } from '@/router';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();

const startPage = ref<StartPage>(readStoredStartPage());
</script>
