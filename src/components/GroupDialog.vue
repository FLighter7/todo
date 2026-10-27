<template>
	<EntityDialog
		v-model="open"
		:title="t('group.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<VTextField
				v-if="editing"
				v-model="name"
				:label="t('entity.name')"
				aria-required="true"
				:error-messages="nameError"
				autofocus
				@keyup.enter="onSave"
			/>
			<div v-else class="text-title-large">{{ name }}</div>
		</template>
	</EntityDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import type { GroupDraft } from '@/types';

const props = withDefaults(
	defineProps<{
		initial?: Partial<GroupDraft>;
		mode?: 'add' | 'edit';
	}>(),
	{ initial: () => ({}), mode: 'edit' },
);

const emit = defineEmits<{ save: [draft: GroupDraft]; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const name = ref('');
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
		showErrors.value = false;
	},
	{ immediate: true },
);

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	emit('save', { name: name.value.trim() });
	open.value = false;
}
</script>
