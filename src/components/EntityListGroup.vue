<style lang="scss" module>
.group {
	border: none;
	padding: 0;
	margin: 0 0 1rem;
}

.legend {
	font-size: 0.875rem;
	color: rgb(var(--v-theme-on-surface-variant));
	padding-inline: 0.25rem;
}
</style>

<template>
	<fieldset :class="$style.group">
		<legend :class="$style.legend">{{ label }}</legend>
		<slot />
	</fieldset>
</template>

<script setup lang="ts">
defineProps<{ label: string }>();
</script>
