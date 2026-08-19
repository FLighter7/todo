<template>
	<VDialog v-model="open" max-width="440">
		<VCard variant="elevated">
			<VCardTitle>{{ title }}</VCardTitle>
			<VCardText>{{ body }}</VCardText>
			<VCardActions>
				<VSpacer />
				<VBtn
					v-for="action in actions"
					:key="action.key"
					:color="action.color"
					variant="text"
					@click="choose(action.key)"
				>
					{{ action.label }}
				</VBtn>
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
export interface ConfirmAction {
	key: string;
	label: string;
	color?: string;
}

defineProps<{
	title: string;
	body: string;
	actions: ConfirmAction[];
}>();

const emit = defineEmits<{ choose: [key: string] }>();

const open = defineModel<boolean>({ required: true });

function choose(key: string): void {
	open.value = false;
	emit('choose', key);
}
</script>
