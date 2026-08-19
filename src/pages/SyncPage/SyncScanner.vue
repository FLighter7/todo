<style lang="scss" module>
.wrap {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.video {
	width: 100%;
	max-width: 360px;
	align-self: center;
	border-radius: 8px;
	background: #000000;
}
</style>

<template>
	<div :class="$style.wrap">
		<video v-show="cameraOn" ref="video" :class="$style.video" muted playsinline />

		<VAlert v-if="cameraError" type="info" variant="tonal" :text="t('sync.cameraFailed')" />
		<p v-else-if="cameraOn" class="text-center text-medium-emphasis">{{ t('sync.scanning') }}</p>

		<VTextarea
			v-model="pasted"
			:label="t('sync.orPaste')"
			rows="2"
			auto-grow
			hide-details
			class="mt-2"
		/>
		<VBtn :disabled="pasted.trim() === ''" variant="tonal" @click="submitPasted">
			{{ t('sync.paste') }}
		</VBtn>
	</div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import QrScanner from 'qr-scanner';

const emit = defineEmits<{ code: [value: string] }>();

const { t } = useI18n();
const video = useTemplateRef<HTMLVideoElement>('video');
const pasted = ref('');
const cameraOn = ref(false);
const cameraError = ref(false);

let scanner: QrScanner | null = null;

onMounted(async () => {
	if (!video.value) {
		return;
	}

	try {
		scanner = new QrScanner(video.value, (result) => emit('code', result.data), {
			highlightScanRegion: true,
			maxScansPerSecond: 5,
		});
		await scanner.start();
		cameraOn.value = true;
	} catch {
		// No camera, no permission, or an insecure origin. Pasting still works,
		// and on a desktop without a webcam it is the normal path anyway.
		cameraError.value = true;
		scanner?.destroy();
		scanner = null;
	}
});

onBeforeUnmount(() => {
	scanner?.destroy();
	scanner = null;
});

function submitPasted(): void {
	emit('code', pasted.value.trim());
	pasted.value = '';
}
</script>
