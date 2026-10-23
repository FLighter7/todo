<style lang="scss" module>
.section {
	border: 1px solid rgb(var(--v-theme-outline));
	border-radius: 4px;
	padding: 0;
	margin: 0;
}

.section + .section {
	margin-top: 4px;
}

.legend {
	margin-left: 8px;
	font-size: 0.875rem;
	color: rgb(var(--v-theme-on-surface-variant));
	padding-inline: 0.25rem;
}
</style>

<template>
	<fieldset :class="$style.section">
		<legend :class="$style.legend">{{ label }}</legend>
		<slot />
	</fieldset>
</template>

<script setup lang="ts">
defineProps<{ label: string }>();
</script>
