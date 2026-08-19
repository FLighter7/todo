<style lang="scss" module>
.page {
	max-width: 520px;
	margin-inline: auto;
}
</style>

<template>
	<VContainer :class="$style.page">
		<VList>
			<VListSubheader>{{ t('settings.startPage') }}</VListSubheader>
			<VSelect
				v-model="startPage"
				:items="startPageItems"
				item-title="title"
				item-value="value"
				variant="outlined"
				hide-details
				class="mx-4 mb-4"
			>
				<template #item="{ item, props: itemProps }">
					<VListItem v-bind="itemProps" :prepend-icon="item.icon" />
				</template>

				<template #selection="{ item }">
					<VIcon :icon="item.icon" class="mr-2" />
					{{ item.title }}
				</template>
			</VSelect>

			<VListSubheader>{{ t('settings.cleanupDays') }}</VListSubheader>
			<VSelect
				v-model="cleanupDays"
				:items="cleanupDaysItems"
				variant="outlined"
				:hint="t('settings.cleanupDaysHint')"
				persistent-hint
				class="mx-4 mb-4"
			/>

			<VListSubheader>{{ t('backup.title') }}</VListSubheader>

			<BackupActions @notify="emit('notify', $event)" />

			<template v-for="entity in ENTITIES" :key="entity">
				<VListSubheader>{{ t(`settings.${entity}`) }}</VListSubheader>
				<VBtnToggle
					:model-value="settings[entity].rows"
					mandatory
					color="primary"
					class="mx-4 mb-2"
					@update:model-value="settings.updatePageSettings(entity, { rows: $event === 2 ? 2 : 1 })"
				>
					<VBtn :value="1">{{ t('settings.rows1') }}</VBtn>
					<VBtn :value="2">{{ t('settings.rows2') }}</VBtn>
				</VBtnToggle>
				<VSwitch
					:model-value="settings[entity].confirmDone"
					:label="t('settings.confirmDone')"
					color="primary"
					hide-details
					class="mx-4"
					@update:model-value="
						settings.updatePageSettings(entity, { confirmDone: $event ?? false })
					"
				/>
				<VSwitch
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
		</VList>
	</VContainer>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
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
