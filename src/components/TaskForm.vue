<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}
</style>

<template>
	<v-dialog v-model="open" max-width="480">
		<v-card variant="elevated">
			<v-card-title>{{ mode === 'edit' ? t('form.edit') : t('form.add') }}</v-card-title>

			<v-card-text>
				<v-text-field
					v-model="name"
					:label="t('task.name')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="submit"
				/>

				<v-textarea v-model="note" :label="t('task.note')" rows="3" />

				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('task.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('task.urgent')" color="primary" hide-details />
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
import type { TaskDraft } from '@/stores/tasks';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TaskDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'add' },
);

const emit = defineEmits<{ submit: [draft: TaskDraft] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const important = ref(false);
const urgent = ref(false);
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	name.value = props.initial.name ?? '';
	note.value = props.initial.note ?? '';
	important.value = props.initial.important ?? false;
	urgent.value = props.initial.urgent ?? false;
	showErrors.value = false;
});

function submit(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('submit', {
		name: name.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: important.value,
		urgent: urgent.value,
	});

	open.value = false;
}
</script>
