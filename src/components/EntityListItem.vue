<template>
	<v-list-item @click="emit('click')">
		<template #prepend>
			<v-checkbox-btn
				:model-value="done"
				:aria-label="t('task.done')"
				@click.stop
				@update:model-value="emit('update:done', $event ?? false)"
			/>
		</template>

		<v-list-item-title>{{ name }}</v-list-item-title>
		<v-list-item-subtitle v-if="note">{{ note }}</v-list-item-subtitle>
	</v-list-item>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
	name: string;
	note?: string;
	done: boolean;
}>();

const emit = defineEmits<{
	'update:done': [value: boolean];
	click: [];
}>();

const { t } = useI18n();
</script>
