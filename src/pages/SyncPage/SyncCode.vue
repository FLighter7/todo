<style lang="scss" module>
.wrap {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
}

.canvas {
	width: min(72vw, 320px);
	height: auto;
	image-rendering: pixelated;
	border-radius: 8px;
	// The code must stay readable in dark theme: a QR needs a light quiet zone.
	background: #ffffff;
	padding: 12px;
}
</style>

<template>
	<div :class="$style.wrap">
		<!-- The code itself is for the camera; "Copy code" below hands it over as text. -->
		<canvas ref="canvas" :class="$style.canvas" role="img" :aria-label="t('sync.qrLabel')" />
		<VBtn :prepend-icon="mdiContentCopy" variant="tonal" size="small" @click="copy">
			{{ t('sync.copy') }}
		</VBtn>
	</div>
</template>

<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiContentCopy } from '@mdi/js';
import QRCode from 'qrcode';

const props = defineProps<{ code: string }>();
const emit = defineEmits<{ copied: [] }>();

const { t } = useI18n();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas');

async function draw(): Promise<void> {
	if (!canvas.value || !props.code) {
		return;
	}

	await QRCode.toCanvas(canvas.value, props.code, {
		errorCorrectionLevel: 'L',
		margin: 1,
		width: 320,
	});
}

onMounted(draw);
watch(() => props.code, draw);

async function copy(): Promise<void> {
	await navigator.clipboard.writeText(props.code);
	emit('copied');
}
</script>
