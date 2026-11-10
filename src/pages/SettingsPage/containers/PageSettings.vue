<template>
	<div class="py-2">
		<VSwitch
			:model-value="settings.general.pages[page]"
			:label="t('settings.showPage')"
			color="primary"
			hide-details
			class="mx-4 mb-2"
			@update:model-value="settings.setPageVisible(page, $event === true)"
		/>

		<!-- The matrix has nothing to set but whether it is shown. -->
		<template v-if="entity !== undefined">
			<!-- A group has no note, so its list has no second row to offer. -->
			<VBtnToggle
				v-if="entity !== 'groups'"
				:model-value="settings[entity].rows"
				:disabled="hidden"
				mandatory
				color="primary"
				class="mx-4 mb-2"
				@update:model-value="update({ rows: $event === 2 ? 2 : 1 })"
			>
				<VBtn :value="1" :aria-pressed="settings[entity].rows === 1">
					{{ t('settings.rows1') }}
				</VBtn>
				<VBtn :value="2" :aria-pressed="settings[entity].rows === 2">
					{{ t('settings.rows2') }}
				</VBtn>
			</VBtnToggle>
			<VSwitch
				:model-value="settings[entity].confirmDone"
				:label="t('settings.confirmDone')"
				:disabled="hidden"
				color="primary"
				hide-details
				class="mx-4"
				@update:model-value="update({ confirmDone: $event ?? false })"
			/>
			<VSwitch
				:model-value="settings[entity].confirmReopen"
				:label="t('settings.confirmReopen')"
				:disabled="hidden"
				color="primary"
				hide-details
				class="mx-4 mb-4"
				@update:model-value="update({ confirmReopen: $event ?? false })"
			/>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useSettingsStore, type SettingsEntity } from '@/stores/settings';
import { isPageHidden, type AppPage, type PageSettings } from '@/types';

const props = defineProps<{ page: AppPage }>();

const { t } = useI18n();
const settings = useSettingsStore();

const entity = computed<SettingsEntity | undefined>(() =>
	props.page === 'matrix' ? undefined : props.page,
);

// A hidden page's preferences stay in the document, ready for when it is
// switched back on, so they stay in view too, only out of reach. With every
// page off Tasks is still open, so its own stay within reach.
const hidden = computed(() => isPageHidden(settings, props.page));

function update(patch: Partial<PageSettings>): void {
	if (entity.value !== undefined) {
		settings.updatePageSettings(entity.value, patch);
	}
}
</script>
