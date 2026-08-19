<template>
	<VDialog v-model="open" max-width="480">
		<VCard variant="elevated">
			<VCardTitle class="d-flex align-center">
				<span>{{ title }}</span>
				<VSpacer />
				<VBtn
					v-if="!editing"
					:icon="mdiPencilOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('entity.edit')"
					@click="editing = true"
				/>
				<VBtn
					v-else
					:icon="mdiCheck"
					variant="text"
					density="comfortable"
					:aria-label="t('form.save')"
					@click="emit('save')"
				/>
			</VCardTitle>

			<VCardText>
				<slot :editing="editing" />
			</VCardText>

			<VCardActions v-if="mode === 'edit'">
				<VBtn color="error" variant="text" :prepend-icon="mdiDeleteOutline" @click="emit('cancel')">
					{{ t('entity.cancelRecord') }}
				</VBtn>
				<VSpacer />
			</VCardActions>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js';

const props = withDefaults(
	defineProps<{
		title: string;
		mode?: 'add' | 'edit';
	}>(),
	{ mode: 'edit' },
);

const emit = defineEmits<{ save: []; cancel: [] }>();

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();

const editing = defineModel<boolean>('editing', { default: false });
editing.value = props.mode === 'add';

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	editing.value = props.mode === 'add';
});
</script>
