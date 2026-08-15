<style lang="scss" module>
.fab {
	box-shadow: 0 0.25rem 0.75rem rgb(var(--v-theme-on-surface) / 25%);
}
</style>

<template>
	<v-btn
		:class="$style.fab"
		:icon="mdiPlus"
		color="primary"
		variant="flat"
		size="large"
		:aria-label="t('form.add')"
		@click="dialogOpen = true"
	/>

	<todo-form v-model="dialogOpen" @submit="handleSubmit" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiPlus } from '@mdi/js';
import TodoForm from '@/components/TodoForm.vue';
import { useTodosStore, type TodoDraft } from '@/stores/todos';

const { t } = useI18n();
const store = useTodosStore();

const dialogOpen = ref(false);

async function handleSubmit(draft: TodoDraft): Promise<void> {
	await store.add(draft);
}
</script>
