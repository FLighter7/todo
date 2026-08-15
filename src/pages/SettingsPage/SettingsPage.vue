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
			<v-select
				v-model="startPage"
				:items="startPageItems"
				item-title="title"
				item-value="value"
				variant="outlined"
				hide-details
				class="mx-4 mb-4"
				@update:model-value="persistStartPage($event)"
			>
				<template #item="{ item, props: itemProps }">
					<v-list-item v-bind="itemProps" :prepend-icon="item.icon" />
				</template>

				<template #selection="{ item }">
					<v-icon :icon="item.icon" class="mr-2" />
					{{ item.title }}
				</template>
			</v-select>

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
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiChevronRight, mdiSync } from '@mdi/js';
import BackupActions from '@/containers/BackupActions.vue';
import { getStartPageOptions, persistStartPage, readStoredStartPage, type StartPage } from '@/router';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();

const startPage = ref<StartPage>(readStoredStartPage());

const startPageItems = computed(() =>
	getStartPageOptions().map((option) => ({
		title: t(option.labelKey),
		value: option.value,
		icon: option.icon,
	})),
);
</script>
