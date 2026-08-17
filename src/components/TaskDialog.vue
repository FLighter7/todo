<style lang="scss" module>
.flags {
	display: flex;
	gap: 1.5rem;
}

.chips {
	display: flex;
	gap: 0.5rem;
	margin-top: 0.5rem;
}
</style>

<template>
	<entity-dialog
		v-model="open"
		:title="t('task.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<template v-if="editing">
				<v-text-field
					v-model="name"
					:label="t('entity.name')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="onSave"
				/>
				<v-textarea v-model="note" :label="t('entity.note')" rows="3" />
				<div :class="$style.flags">
					<v-switch v-model="important" :label="t('task.important')" color="primary" hide-details />
					<v-switch v-model="urgent" :label="t('task.urgent')" color="primary" hide-details />
				</div>
				<v-select
					v-model="goalId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('task.goalLabel')"
				/>
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
				<p v-if="goalName" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('task.goalLabel') }}: {{ goalName }}
				</p>
				<div v-if="important || urgent" :class="$style.chips">
					<v-chip v-if="important" size="small" color="primary">{{ t('task.important') }}</v-chip>
					<v-chip v-if="urgent" size="small" color="primary">{{ t('task.urgent') }}</v-chip>
				</div>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import type { TaskDraft } from '@/stores/tasks';

const props = withDefaults(
	defineProps<{
		initial?: Partial<TaskDraft>;
		mode?: 'add' | 'edit';
		goalOptions: Array<{ value: string; title: string }>;
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: TaskDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const important = ref(false);
const urgent = ref(false);
const goalId = ref('');
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

const selectItems = computed(() => [{ value: '', title: t('task.noGoal') }, ...props.goalOptions]);

const goalName = computed(
	() => selectItems.value.find((item) => item.value === goalId.value)?.title,
);

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.initial.name ?? '';
		note.value = props.initial.note ?? '';
		important.value = props.initial.important ?? false;
		urgent.value = props.initial.urgent ?? false;
		goalId.value = props.initial.goalId ?? '';
		showErrors.value = false;
	},
	{ immediate: true },
);

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	const trimmedNote = note.value.trim();

	emit('save', {
		name: name.value.trim(),
		note: trimmedNote === '' ? undefined : trimmedNote,
		important: important.value,
		urgent: urgent.value,
		goalId: goalId.value === '' ? undefined : goalId.value,
	});
	open.value = false;
}
</script>
