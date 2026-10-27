<template>
	<VDialog v-model="open" max-width="440" :aria-labelledby="titleId" :aria-describedby="bodyId">
		<VCard variant="elevated">
			<VCardTitle :id="titleId" tag="h2">{{ title }}</VCardTitle>
			<VCardText :id="bodyId">{{ body }}</VCardText>
			<!-- Two long labels side by side do not fit a phone; the second goes below. -->
			<VCardActions class="flex-wrap justify-end">
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
import { useId } from 'vue';
import { useReturnFocus } from '@/composables/useKeepFocus';

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

const titleId = useId();
const bodyId = useId();

useReturnFocus(open);

function choose(key: string): void {
	open.value = false;
	emit('choose', key);
}
</script>
