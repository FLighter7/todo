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
			>
				<template #item="{ item, props: itemProps }">
					<v-list-item v-bind="itemProps" :prepend-icon="item.icon" />
				</template>

				<template #selection="{ item }">
					<v-icon :icon="item.icon" class="mr-2" />
					{{ item.title }}
				</template>
			</v-select>

			<v-list-subheader>{{ t('settings.cleanupDays') }}</v-list-subheader>
			<v-select
				v-model="cleanupDays"
				:items="cleanupDaysItems"
				variant="outlined"
				hide-details
				class="mx-4 mb-4"
			/>

			<v-list-item
				:to="{ name: 'sync' }"
				:title="t('sync.title')"
				:prepend-icon="mdiSync"
				:append-icon="mdiChevronRight"
			/>

			<v-list-subheader>{{ t('backup.title') }}</v-list-subheader>

			<backup-actions @notify="emit('notify', $event)" />

			<template v-for="entity in ENTITIES" :key="entity">
				<v-list-subheader>{{ t(`settings.${entity}`) }}</v-list-subheader>
				<v-btn-toggle
					:model-value="settings[entity].rows"
					mandatory
					color="primary"
					class="mx-4 mb-2"
					@update:model-value="settings.updatePageSettings(entity, { rows: $event })"
				>
					<v-btn :value="1">{{ t('settings.rows1') }}</v-btn>
					<v-btn :value="2">{{ t('settings.rows2') }}</v-btn>
				</v-btn-toggle>
				<v-switch
					:model-value="settings[entity].confirmDone"
					:label="t('settings.confirmDone')"
					color="primary"
					hide-details
					class="mx-4"
					@update:model-value="
						settings.updatePageSettings(entity, { confirmDone: $event ?? false })
					"
				/>
				<v-switch
					:model-value="settings[entity].confirmReopen"
					:label="t('settings.confirmReopen')"
					color="primary"
					hide-details
					class="mx-4 mb-4"
					@update:model-value="
						settings.updatePageSettings(entity, { confirmReopen: $event ?? false })
					"
				/>
			</template>
		</v-list>
	</v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiChevronRight, mdiSync } from '@mdi/js';
import BackupActions from '@/containers/BackupActions.vue';
import { getStartPageOptions, type StartPage } from '@/router';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const settings = useSettingsStore();

const ENTITIES: SettingsEntity[] = ['dreams', 'goals', 'tasks'];

const startPage = computed({
	get: () => settings.general.startPage,
	set: (value: StartPage) => settings.setStartPage(value),
});

const startPageItems = computed(() =>
	getStartPageOptions().map((option) => ({
		title: t(option.labelKey),
		value: option.value,
		icon: option.icon,
	})),
);

const cleanupDays = computed({
	get: () => settings.general.cleanupDays,
	set: (value: 30 | 60 | 90) => settings.setCleanupDays(value),
});

const cleanupDaysItems = computed(() =>
	([30, 60, 90] as const).map((days) => ({
		title: t('settings.cleanupDaysOption', { days }),
		value: days,
	})),
);
</script>
