<template>
	<EntityDialog
		v-model="open"
		:title="t('dream.title')"
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
			</template>
			<template v-else>
				<div class="text-title-large">{{ name }}</div>
				<p v-if="note" class="text-body-medium mt-2">{{ note }}</p>
			</template>
		</template>
	</EntityDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import type { DreamDraft } from '@/types';

const props = withDefaults(
	defineProps<{
		initial?: Partial<DreamDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: DreamDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
const note = ref('');
const showErrors = ref(false);

const nameError = computed(() =>
	showErrors.value && name.value.trim() === '' ? t('form.nameRequired') : '',
);

watch(
	open,
	(isOpen) => {
		if (!isOpen) {
			return;
		}

		name.value = props.initial.name ?? '';
		note.value = props.initial.note ?? '';
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

	emit('save', { name: name.value.trim(), note: trimmedNote === '' ? undefined : trimmedNote });
	open.value = false;
}
</script>
