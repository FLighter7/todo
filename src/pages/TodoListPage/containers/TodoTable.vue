<style lang="scss" module>
.doneRow {
	opacity: 0.55;
	text-decoration: line-through;
}
</style>

<template>
	<v-container>
		<v-data-table
			:headers="headers"
			:items="store.items"
			:loading="store.loading"
			:no-data-text="t('list.empty')"
			density="comfortable"
			item-value="id"
			hover
			@click:row="onRowClick"
		>
			<template #[`item.done`]="{ item }">
				<v-checkbox-btn
					:model-value="item.done"
					:aria-label="t('todo.done')"
					@click.stop
					@update:model-value="store.toggleDone(item.id)"
				/>
			</template>

			<template #[`item.title`]="{ item }">
				<span :class="item.done ? $style.doneRow : undefined">{{ item.title }}</span>
			</template>

			<template #[`item.period`]="{ item }">{{ t(`period.${item.period}`) }}</template>

			<template #[`item.important`]="{ item }">
				<v-icon v-if="item.important" :icon="mdiCheck" />
			</template>

			<template #[`item.urgent`]="{ item }">
				<v-icon v-if="item.urgent" :icon="mdiCheck" />
			</template>

			<template #[`item.created`]="{ item }">{{ formatDate(item.created) }}</template>

			<template #[`item.actions`]="{ item }">
				<v-btn
					:icon="mdiDeleteOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('todo.actions')"
					@click.stop="store.remove(item.id)"
				/>
			</template>
		</v-data-table>

		<todo-form v-model="dialogOpen" :initial="initialDraft" mode="edit" @submit="handleSubmit" />
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataTableHeader } from 'vuetify';
import { mdiCheck, mdiDeleteOutline } from '@mdi/js';
import TodoForm from '@/components/TodoForm.vue';
import type { Todo } from '@/types/todo';
import { useTodosStore, type TodoDraft } from '@/stores/todos';

const { t, locale } = useI18n();
const store = useTodosStore();

const dialogOpen = ref(false);
const editing = ref<Todo | null>(null);

const initialDraft = computed<Partial<TodoDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { title, note, period, important, urgent } = editing.value;

	return { title, note, period, important, urgent };
});

function onRowClick(_event: Event, context: { item: Todo }): void {
	editing.value = context.item;
	dialogOpen.value = true;
}

async function handleSubmit(draft: TodoDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await store.update(editing.value.id, draft);
	editing.value = null;
}

const headers = computed<DataTableHeader[]>(() => [
	{ title: t('todo.done'), key: 'done', sortable: false, width: 56 },
	{ title: t('todo.title'), key: 'title' },
	{ title: t('todo.period'), key: 'period' },
	{ title: t('todo.important'), key: 'important' },
	{ title: t('todo.urgent'), key: 'urgent' },
	{ title: t('todo.created'), key: 'created' },
	{ title: t('todo.actions'), key: 'actions', sortable: false, align: 'end' },
]);

function formatDate(value: string): string {
	return new Date(value).toLocaleString(locale.value);
}
</script>
