<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}
</style>

<template>
	<v-dialog v-model="open" max-width="480">
		<v-card>
			<v-card-title>{{ mode === 'edit' ? t('form.edit') : t('form.add') }}</v-card-title>

			<v-card-text>
				<v-text-field
					v-model="title"
					:label="t('todo.title')"
					:error-messages="titleError"
					autofocus
					@keyup.enter="submit"
				/>

				<v-textarea v-model="note" :label="t('todo.note')" rows="3" />

				<v-select v-model="period" :label="t('todo.period')" :items="periodItems" />

				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('todo.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('todo.urgent')" color="primary" hide-details />
				</div>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn variant="text" @click="open = false">{{ t('form.cancel') }}</v-btn>
				<v-btn color="primary" variant="flat" @click="submit">{{ t('form.save') }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TodoPeriod } from '@/types/todo';
import type { TodoDraft } from '@/stores/todos';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TodoDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'add' },
);

const emit = defineEmits<{ submit: [draft: TodoDraft] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const title = ref('');
const note = ref('');
const period = ref<TodoPeriod>('one-time');
const important = ref(false);
const urgent = ref(false);
const showErrors = ref(false);

const periodItems = computed(() => [
	{ title: t('period.one-time'), value: 'one-time' satisfies TodoPeriod },
	{ title: t('period.periodic'), value: 'periodic' satisfies TodoPeriod },
]);

const titleError = computed(() =>
	showErrors.value && title.value.trim() === '' ? t('form.titleRequired') : '',
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	title.value = props.initial.title ?? '';
	note.value = props.initial.note ?? '';
	period.value = props.initial.period ?? 'one-time';
	important.value = props.initial.important ?? false;
	urgent.value = props.initial.urgent ?? false;
	showErrors.value = false;
});

function submit(): void {
	if (title.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('submit', {
		title: title.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		period: period.value,
		important: important.value,
		urgent: urgent.value,
	});

	open.value = false;
}
</script>
