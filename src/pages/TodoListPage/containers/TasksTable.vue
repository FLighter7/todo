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
			:items="visible"
			:loading="store.loading"
			:no-data-text="t('list.empty')"
			density="comfortable"
			item-value="id"
			hover
			@click:row="onRowClick"
		>
			<template #[`item.done`]="{ item }">
				<v-checkbox-btn
					:model-value="item.status === Status.Done"
					:aria-label="t('task.done')"
					@click.stop
					@update:model-value="onDoneChanged(item)"
				/>
			</template>

			<template #[`item.name`]="{ item }">
				<span :class="item.status === Status.Done ? $style.doneRow : undefined">
					{{ item.name }}
				</span>
			</template>

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
					:aria-label="t('task.cancel')"
					@click.stop="store.close(item.id, Status.Cancelled)"
				/>
			</template>
		</v-data-table>

		<task-form v-model="dialogOpen" :initial="initialDraft" mode="edit" @submit="handleSubmit" />
	</v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DataTableHeader } from 'vuetify';
import { mdiCheck, mdiDeleteOutline } from '@mdi/js';
import TaskForm from '@/components/TaskForm.vue';
import { Status, type Task } from '@/types';
import { useTasksStore, type TaskDraft } from '@/stores/tasks';

const { t, locale } = useI18n();
const store = useTasksStore();

const dialogOpen = ref(false);
const editing = ref<Task | null>(null);

/**
 * Cancelled tasks are what the old `deleted` flag used to hide; done tasks
 * stay visible and struck through, exactly as before. The History tab that
 * gives cancelled records a home of their own arrives in stage 5.
 */
const visible = computed(() => store.records.filter((task) => task.status !== Status.Cancelled));

const initialDraft = computed<Partial<TaskDraft>>(() => {
	if (editing.value === null) {
		return {};
	}

	const { name, note, important, urgent } = editing.value;

	return { name, note, important, urgent };
});

function onRowClick(_event: Event, context: { item: Task }): void {
	editing.value = context.item;
	dialogOpen.value = true;
}

async function handleSubmit(draft: TaskDraft): Promise<void> {
	if (editing.value === null) {
		return;
	}

	await store.update(editing.value.id, draft);
	editing.value = null;
}

async function onDoneChanged(task: Task): Promise<void> {
	if (task.status === Status.Done) {
		await store.reopen(task.id);
		return;
	}

	await store.close(task.id, Status.Done);
}

const headers = computed<DataTableHeader[]>(() => [
	{ title: t('task.done'), key: 'done', sortable: false, width: 56 },
	{ title: t('task.name'), key: 'name' },
	{ title: t('task.important'), key: 'important' },
	{ title: t('task.urgent'), key: 'urgent' },
	{ title: t('task.created'), key: 'created' },
	{ title: t('task.actions'), key: 'actions', sortable: false, align: 'end' },
]);

function formatDate(value: string): string {
	return new Date(value).toLocaleString(locale.value);
}
</script>
