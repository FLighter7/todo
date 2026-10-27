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
		<h3 class="text-title-small mt-4">{{ t('task.completions.label') }}</h3>
		<p v-if="doneCount > 0" class="text-body-small text-medium-emphasis">
			{{ t('task.completions.doneCount', { n: doneCount }, { plural: doneCount }) }}
		</p>
		<div v-for="entry in occurrences" :key="entry.start" :class="$style.row">
			<span>{{ formatWallClock(entry.start, locale) }}</span>
			<!-- Each button names its date: heard on its own, "Skip" says nothing of which one. -->
			<template v-if="entry.state === 'pending'">
				<VBtn
					:icon="mdiCheckCircleOutline"
					variant="text"
					density="comfortable"
					:aria-label="
						t('task.completions.markDone', { date: formatWallClock(entry.start, locale) })
					"
					@click="emit('toggle-done', entry.start, true)"
				/>
				<VBtn
					:icon="mdiCloseCircleOutline"
					variant="text"
					density="comfortable"
					:aria-label="t('task.completions.skip', { date: formatWallClock(entry.start, locale) })"
					@click="emit('toggle-skip', entry.start, true)"
				/>
			</template>
			<VBtn
				v-else-if="entry.state === 'done'"
				:icon="mdiCheckCircle"
				variant="text"
				density="comfortable"
				color="primary"
				:aria-label="
					t('task.completions.markPending', { date: formatWallClock(entry.start, locale) })
				"
				@click="emit('toggle-done', entry.start, false)"
			/>
			<VBtn
				v-else
				:icon="mdiCloseCircle"
				variant="text"
				density="comfortable"
				:aria-label="t('task.completions.unskip', { date: formatWallClock(entry.start, locale) })"
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
