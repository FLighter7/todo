<template>
	<entity-dialog
		v-model="open"
		:title="t('goal.title')"
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
				<v-select
					v-model="dreamId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('goal.dreamLabel')"
				/>
				<deadline-field v-model="deadline" />
			</template>
			<template v-else>
				<div class="text-h6">{{ name }}</div>
				<p v-if="note" class="text-body-2 mt-2">{{ note }}</p>
				<p v-if="dreamName" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('goal.dreamLabel') }}: {{ dreamName }}
				</p>
				<p v-if="deadline" class="text-body-2 mt-2 text-medium-emphasis">
					{{ t('goal.deadline.label') }}: {{ formatDeadline(deadline, locale, t) }}
				</p>
			</template>
		</template>
	</entity-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import DeadlineField from './DeadlineField.vue';
import { formatDeadline } from '@/utils/deadline';
import type { Deadline } from '@/types';
import type { GoalDraft } from '@/stores/goals';

const props = withDefaults(
	defineProps<{
		initial?: Partial<GoalDraft>;
		mode?: 'add' | 'edit';
		dreamOptions: Array<{ value: string; title: string }>;
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: GoalDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t, locale } = useI18n();

const name = ref('');
const note = ref('');
const dreamId = ref('');
const deadline = ref<Deadline | undefined>(undefined);
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

const selectItems = computed(() => [
	{ value: '', title: t('goal.noDream') },
	...props.dreamOptions,
]);

const dreamName = computed(
	() => selectItems.value.find((item) => item.value === dreamId.value)?.title,
);

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.initial.name ?? '';
		note.value = props.initial.note ?? '';
		dreamId.value = props.initial.dreamId ?? '';
		deadline.value = props.initial.deadline;
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
		dreamId: dreamId.value === '' ? undefined : dreamId.value,
		deadline: deadline.value,
	});
	open.value = false;
}
</script>
