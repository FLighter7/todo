<template>
	<VListItem @click="emit('click')">
		<template #prepend>
			<VCheckboxBtn
				:model-value="done"
				:aria-label="t('task.done')"
				@click.stop
				@update:model-value="emit('update:done', $event ?? false)"
			/>
		</template>

		<VListItemTitle>{{ name }}</VListItemTitle>
		<VListItemSubtitle v-if="note">{{ note }}</VListItemSubtitle>

		<template v-if="date" #append>
			<span class="text-caption text-medium-emphasis">{{ date }}</span>
		</template>
	</VListItem>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
	name: string;
	note?: string;
	done: boolean;
	date?: string;
}>();

const emit = defineEmits<{
	'update:done': [value: boolean];
	click: [];
}>();

const { t } = useI18n();
</script>
