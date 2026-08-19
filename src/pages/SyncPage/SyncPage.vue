<style lang="scss" module>
.page {
	max-width: 520px;
	margin-inline: auto;
}
</style>

<template>
	<VContainer :class="$style.page">
		<VTabs v-model="activeTab" color="primary" class="mb-4">
			<VTab value="qr">{{ t('sync.tabQr') }}</VTab>
			<VTab value="server" :disabled="isBusy">{{ t('sync.tabServer') }}</VTab>
		</VTabs>

		<SyncFlow v-if="activeTab === 'qr'" ref="syncFlowRef" />
		<p v-else class="text-medium-emphasis">{{ t('sync.serverStub') }}</p>
	</VContainer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SyncFlow from './containers/SyncFlow.vue';

const { t } = useI18n();

const activeTab = ref<'qr' | 'server'>('qr');
const syncFlowRef = ref<InstanceType<typeof SyncFlow> | null>(null);

const isBusy = computed(() => syncFlowRef.value?.busy ?? false);
</script>
