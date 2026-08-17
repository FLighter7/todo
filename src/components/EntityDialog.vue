<template>
	<v-dialog v-model="open" max-width="480">
		<v-card variant="elevated">
			<v-card-title class="d-flex align-center">
				<span>{{ title }}</span>
				<v-spacer />
				<v-btn
					v-if="!editing"
					:icon="mdiPencilOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('entity.edit')"
					@click="editing = true"
				/>
				<v-btn
					v-else
					:icon="mdiCheck"
					variant="text"
					density="comfortable"
					:aria-label="t('form.save')"
					@click="emit('save')"
				/>
			</v-card-title>

			<v-card-text>
				<slot :editing="editing" />
			</v-card-text>

			<v-card-actions v-if="mode === 'edit'">
				<v-btn
					color="error"
					variant="text"
					:prepend-icon="mdiDeleteOutline"
					@click="emit('cancel')"
				>
					{{ t('entity.cancelRecord') }}
				</v-btn>
				<v-spacer />
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
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

const editing = ref(props.mode === 'add');

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	editing.value = props.mode === 'add';
});
</script>
