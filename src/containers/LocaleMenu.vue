<style lang="scss" module>
.list {
	max-height: 320px;
	overflow-y: auto;
}

.flag {
	width: 24px;
	height: 18px;
	margin-inline-end: 16px;
	object-fit: cover;
	border-radius: 2px;
}
</style>

<template>
	<VBtn
		:icon="mdiTranslate"
		variant="text"
		:aria-label="t('app.toggleLanguage')"
		@click="open = true"
	/>

	<VDialog v-model="open" max-width="360" :aria-labelledby="titleId">
		<VCard variant="elevated">
			<VCardTitle :id="titleId" tag="h2">{{ t('settings.language') }}</VCardTitle>

			<VList :class="$style.list">
				<VListItem
					v-for="code in SUPPORTED_LOCALES"
					:key="code"
					:active="locale === code"
					:aria-current="locale === code ? 'true' : undefined"
					:lang="code"
					color="primary"
					:title="LOCALE_NAMES[code]"
					:append-icon="locale === code ? mdiCheck : undefined"
					@click="select(code)"
				>
					<template #prepend>
						<img :src="LOCALE_FLAGS[code]" :class="$style.flag" alt="" />
					</template>
				</VListItem>
			</VList>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiTranslate } from '@mdi/js';
import { type AppLocale, LOCALE_FLAGS, LOCALE_NAMES, SUPPORTED_LOCALES } from '@/i18n';
import { useSettingsStore } from '@/stores/settings';
import { useReturnFocus } from '@/composables/useKeepFocus';

const { t, locale } = useI18n();
const settings = useSettingsStore();

const open = ref(false);
const titleId = useId();

useReturnFocus(open);

function select(code: AppLocale): void {
	settings.setLocale(code);
	open.value = false;
}

// Reactive, not just from select(): this makes every write path -- setLocale,
// replaceAll (backup import, sync accept) -- apply live, not only a click
// through this menu's own list.
watch(
	() => settings.general.locale,
	(code) => {
		locale.value = code;
	},
	{ immediate: true },
);
</script>
