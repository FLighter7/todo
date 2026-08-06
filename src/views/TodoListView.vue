<style lang="scss" module>
.fab {
	position: fixed;
	right: 1rem;
	bottom: calc(1rem + env(safe-area-inset-bottom));
}

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
				<v-icon v-if="item.important" icon="mdi-check" />
			</template>

			<template #[`item.urgent`]="{ item }">
				<v-icon v-if="item.urgent" icon="mdi-check" />
			</template>

			<template #[`item.created`]="{ item }">{{ formatDate(item.created) }}</template>

			<template #[`item.actions`]="{ item }">
				<v-btn
					icon="mdi-delete-outline"
					variant="text"
					density="comfortable"
					:aria-label="t('todo.actions')"
					@click.stop="store.remove(item.id)"
				/>
			</template>
		</v-data-table>

		<v-btn
			:class="$style.fab"
			icon="mdi-plus"
			color="primary"
			size="large"
			:aria-label="t('form.add')"
			@click="openAdd"
		/>

		<todo-form
			v-model="dialogOpen"
			:initial="initialDraft"
			:mode="editing === null ? 'add' : 'edit'"
			@submit="handleSubmit"
		/>
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataTableHeader } from 'vuetify';
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

function openAdd(): void {
	editing.value = null;
	dialogOpen.value = true;
}

function openEdit(todo: Todo): void {
	editing.value = todo;
	dialogOpen.value = true;
}

function onRowClick(_event: Event, context: { item: Todo }): void {
	openEdit(context.item);
}

async function handleSubmit(draft: TodoDraft): Promise<void> {
	if (editing.value === null) {
		await store.add(draft);
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
