<style lang="scss" module>
.root {
	display: flex;
	align-items: center;
	flex: 1 1 0%;
	min-width: 0;
}

.tabs {
	display: flex;
	flex: 1 1 0%;
	min-width: 0;

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
		<SortMenu />
	</VContainer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import SortMenu from '@/containers/SortMenu.vue';

const model = defineModel<'active' | 'history'>({ required: true });

const { t } = useI18n();
</script>
