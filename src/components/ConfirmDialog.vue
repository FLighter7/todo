<template>
	<v-dialog v-model="open" max-width="440">
		<v-card variant="elevated">
			<v-card-title>{{ title }}</v-card-title>
			<v-card-text>{{ body }}</v-card-text>
			<v-card-actions>
				<v-spacer />
				<v-btn
					v-for="action in actions"
					:key="action.key"
					:color="action.color"
					variant="text"
					@click="choose(action.key)"
				>
					{{ action.label }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
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
