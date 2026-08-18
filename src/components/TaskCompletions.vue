<style lang="scss" module>
.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
}
</style>

<template>
	<div>
		<p class="text-subtitle-2 mt-4">{{ t('task.completions.label') }}</p>
		<p v-if="doneCount > 0" class="text-caption text-medium-emphasis">
			{{ t('task.completions.doneCount', { n: doneCount }, { plural: doneCount }) }}
		</p>
		<div v-for="entry in occurrences" :key="entry.start" :class="$style.row">
			<span>{{ formatWallClock(entry.start, locale) }}</span>
			<template v-if="entry.state === 'pending'">
				<v-btn
					:icon="mdiCheckCircleOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('task.completions.markDone')"
					@click="emit('toggle-done', entry.start, true)"
				/>
				<v-btn
					:icon="mdiCloseCircleOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('task.completions.skip')"
					@click="emit('toggle-skip', entry.start, true)"
				/>
			</template>
			<v-btn
				v-else-if="entry.state === 'done'"
				:icon="mdiCheckCircle"
				variant="text"
				density="comfortable"
				color="primary"
				:aria-label="t('task.completions.markPending')"
				@click="emit('toggle-done', entry.start, false)"
			/>
			<v-btn
				v-else
				:icon="mdiCloseCircle"
				variant="text"
				density="comfortable"
				:aria-label="t('task.completions.unskip')"
				@click="emit('toggle-skip', entry.start, false)"
			/>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
	mdiCheckCircle,
	mdiCheckCircleOutline,
	mdiCloseCircle,
	mdiCloseCircleOutline,
} from '@mdi/js';
import { formatWallClock, type OccurrenceEntry } from '@/utils/schedule';

const props = defineProps<{ occurrences: OccurrenceEntry[]; locale: string }>();
const emit = defineEmits<{
	'toggle-done': [occurrence: string, done: boolean];
	'toggle-skip': [occurrence: string, skipped: boolean];
}>();

const { t } = useI18n();

const doneCount = computed(
	() => props.occurrences.filter((entry) => entry.state === 'done').length,
);
</script>
