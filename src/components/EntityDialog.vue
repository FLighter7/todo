<style lang="scss" module>
// The title keeps the card title's look; it is a heading so that the dialog has
// a name and a screen reader a place to start.
.heading {
	font: inherit;
	margin: 0;
}
</style>

<template>
	<VDialog v-model="open" max-width="480" :aria-labelledby="titleId">
		<VCard variant="elevated">
			<VCardTitle class="d-flex align-center">
				<h2 :id="titleId" :class="$style.heading">{{ title }}</h2>
				<VSpacer />
				<VBtn
					v-if="!editing"
					:icon="mdiPencilOutline"
					variant="text"
					:aria-label="t('entity.edit')"
					@click="editing = true"
				/>
				<VBtn
					v-else
					:icon="mdiCheck"
					variant="text"
					:aria-label="t('form.save')"
					@click="emit('save')"
				/>
				<!-- Escape, the scrim and Back close it too, but a touch screen reader user
				needs something to find. -->
				<VBtn :icon="mdiClose" variant="text" :aria-label="t('form.close')" @click="open = false" />
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
import { useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiCheck, mdiClose, mdiDeleteOutline, mdiPencilOutline } from '@mdi/js';
import { useReturnFocus } from '@/composables/useKeepFocus';

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
const titleId = useId();

useReturnFocus(open);

const editing = defineModel<boolean>('editing', { default: false });
editing.value = props.mode === 'add';

watch(open, (isOpen) => {
	if (!isOpen) {
		return;
	}

	editing.value = props.mode === 'add';
});
</script>
