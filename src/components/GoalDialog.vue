<template>
	<EntityDialog
		v-model="open"
		:title="t('goal.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<template v-if="editing">
				<VTextField
					v-model="name"
					:label="t('entity.name')"
					aria-required="true"
					:error-messages="nameError"
					autofocus
					@keyup.enter="onSave"
				/>
				<VTextarea v-model="note" :label="t('entity.note')" rows="3" />
				<VSelect
					v-if="showDream"
					v-model="dreamId"
					:items="selectItems"
					item-title="title"
					item-value="value"
					:label="t('goal.dreamLabel')"
				/>
				<DeadlineField v-model="deadline" />
			</template>
			<template v-else>
				<div class="text-title-large">{{ name }}</div>
				<p v-if="note" class="text-body-medium mt-2">{{ note }}</p>
				<p v-if="showDream && dreamName" class="text-body-medium mt-2 text-medium-emphasis">
					{{ t('goal.dreamLabel') }}: {{ dreamName }}
				</p>
				<p v-if="deadline" class="text-body-medium mt-2 text-medium-emphasis">
					{{ t('goal.deadline.label') }}: {{ formatDeadline(deadline, locale, t) }}
				</p>
			</template>
		</template>
	</EntityDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import DeadlineField from './DeadlineField.vue';
import { formatDeadline } from '@/utils/deadline';
import type { Deadline, GoalDraft } from '@/types';

const props = withDefaults(
	defineProps<{
		initial?: Partial<GoalDraft>;
		mode?: 'add' | 'edit';
		dreamOptions: Array<{ value: string; title: string }>;
		/** False while the Dreams page is switched off in Settings; the goal keeps its link either way. */
		showDream?: boolean;
	}>(),
	{ initial: () => ({}), mode: 'edit', showDream: true },
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
