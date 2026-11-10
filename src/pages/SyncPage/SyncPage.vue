<style lang="scss" module>
.page {
	max-width: 520px;
	margin-inline: auto;
}
</style>

<template>
	<VContainer :class="$style.page">
		<ServerSyncPanel />
	</VContainer>
</template>

<script setup lang="ts">
import ServerSyncPanel from './containers/ServerSyncPanel.vue';
</script>
