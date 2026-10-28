<template>
	<EntityDialog
		v-model="open"
		:title="t('group.title')"
		:mode="mode"
		@save="onSave"
		@cancel="emit('cancel')"
	>
		<template #default="{ editing }">
			<template v-if="editing">
				<VTextField
					v-model="name"
					:label="t('entity.nameField')"
					:error-messages="nameError"
					autofocus
					@keyup.enter="onSave"
				/>
				<SectionColorField v-model:color="color" v-model:paint-items="paintItems" />
			</template>
			<template v-else>
				<div class="text-title-large">{{ name }}</div>
				<SectionColorSummary :color="color" :paint-items="paintItems" />
			</template>
		</template>
	</EntityDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import EntityDialog from './EntityDialog.vue';
import SectionColorField from './SectionColorField.vue';
import SectionColorSummary from './SectionColorSummary.vue';
import type { GroupDraft, Hex } from '@/types';

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
const color = ref<Hex | undefined>(undefined);
const paintItems = ref(false);
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
		color.value = props.initial.color;
		paintItems.value = props.initial.paintItems ?? false;
		showErrors.value = false;
	},
	{ immediate: true },
);

function onSave(): void {
	if (name.value.trim() === '') {
		showErrors.value = true;
		return;
	}

	emit('save', {
		name: name.value.trim(),
		color: color.value,
		paintItems: color.value !== undefined && paintItems.value ? true : undefined,
	});
	open.value = false;
}
</script>
