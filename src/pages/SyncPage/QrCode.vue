<style lang="scss" module>
// Black modules on white in every theme and scheme, the palettes' colours
// deliberately left out: cameras read dark on light best, and a code shown in a
// dark theme is no exception. Forced colours must not repaint it either.
.qr {
	display: block;
	width: 100%;
	height: auto;
	border-radius: 0.5rem;
	forced-color-adjust: none;
}
</style>

<template>
	<svg
		:class="$style.qr"
		role="img"
		:aria-label="label"
		:viewBox="`0 0 ${qr.size} ${qr.size}`"
		shape-rendering="crispEdges"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect :width="qr.size" :height="qr.size" fill="#ffffff" />
		<path :d="modules" fill="#000000" />
	</svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { encode } from 'uqr';

const props = defineProps<{
	/** The text the code carries. */
	value: string;
	/** What a screen reader says for the picture. */
	label: string;
}>();

/** The four modules of white around a code that the QR standard asks for. */
const QUIET_ZONE = 4;

/**
 * The lowest error correction, as the server's page uses: a screen is not
 * scratched or folded, and fewer, larger modules are what a laptop's webcam
 * reads from a phone held up to it.
 */
const qr = computed(() => encode(props.value, { ecc: 'L', border: QUIET_ZONE }));

/** One path for every dark module, a run of them in a row drawn as one rectangle. */
const modules = computed(() => {
	const parts: string[] = [];
	qr.value.data.forEach((row, y) => {
		let x = 0;
		while (x < row.length) {
			if (!row[x]) {
				x++;
				continue;
			}

			const start = x;
			while (x < row.length && row[x]) x++;
			parts.push(`M${start} ${y}h${x - start}v1h${start - x}z`);
		}
	});

	return parts.join('');
});
</script>
