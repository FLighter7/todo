<style lang="scss" module>
.tabs {
	display: flex;
	width: 100%;

	:global(.v-btn) {
		flex: 1 1 0%;
	}
}
</style>

<template>
	<VContainer class="py-0">
		<VBtnToggle v-model="model" mandatory color="primary" :class="$style.tabs">
			<VBtn value="active">{{ t('entity.active') }}</VBtn>
			<VBtn value="history">{{ t('entity.history') }}</VBtn>
		</VBtnToggle>
	</VContainer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const model = defineModel<'active' | 'history'>({ required: true });

const { t } = useI18n();
</script>
