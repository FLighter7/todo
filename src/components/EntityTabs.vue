<style lang="scss" module>
.tabs {
	position: sticky;
	top: 0;
	z-index: 1;
	display: flex;
	width: 100%;
	background-color: rgb(var(--v-theme-background));

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
