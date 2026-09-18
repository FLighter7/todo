<style lang="scss" module>
.root {
	flex: 1 1 0%;
	min-width: 0;
}

.tabs {
	display: flex;
	width: 100%;

	:global(.v-btn) {
		flex: 1 1 0%;
	}
}
</style>

<template>
	<VContainer class="py-0" :class="$style.root">
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
