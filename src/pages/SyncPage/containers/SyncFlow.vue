<style lang="scss" module>
.page {
	max-width: 520px;
	margin-inline: auto;
}

.choices {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}
</style>

<template>
	<v-container :class="$style.page">
		<p class="text-medium-emphasis mb-4">{{ t('sync.intro') }}</p>

		<div v-if="step === 'idle'" :class="$style.choices">
			<v-btn color="primary" size="large" @click="startAsInitiator">
				{{ t('sync.startHere') }}
			</v-btn>
			<v-btn variant="tonal" size="large" @click="startAsResponder">
				{{ t('sync.joinHere') }}
			</v-btn>
		</div>

		<template v-else-if="step === 'show-offer'">
			<p class="mb-3">{{ t('sync.showingCode') }}</p>
			<sync-code :code="ourCode" @copied="notify(t('sync.copied'))" />
			<v-divider class="my-5" />
			<p class="mb-3">{{ t('sync.scanTheirCode') }}</p>
			<sync-scanner @code="onAnswerScanned" />
		</template>

		<template v-else-if="step === 'scan-offer'">
			<p class="mb-3">{{ t('sync.scanInvite') }}</p>
			<sync-scanner @code="onOfferScanned" />
		</template>

		<template v-else-if="step === 'show-answer'">
			<p class="mb-3">{{ t('sync.showAnswer') }}</p>
			<sync-code :code="ourCode" @copied="notify(t('sync.copied'))" />
			<p class="mt-4 text-center text-medium-emphasis">{{ t('sync.waiting') }}</p>
			<v-progress-linear indeterminate class="mt-2" />
		</template>

		<template v-else-if="step === 'working'">
			<p class="text-center">{{ t('sync.connecting') }}</p>
			<v-progress-linear indeterminate class="mt-2" />
		</template>

		<v-alert v-else-if="step === 'done'" type="success" variant="tonal" class="mb-4">
			{{ t('sync.done', { added: result.added, updated: result.updated }) }}
		</v-alert>

		<v-alert v-else-if="step === 'failed'" type="error" variant="tonal" class="mb-4">
			{{ t('sync.failed', { reason: failure }) }}
		</v-alert>

		<v-btn v-if="step !== 'idle'" variant="text" class="mt-4" block @click="reset">
			{{ step === 'done' || step === 'failed' ? t('sync.restart') : t('sync.cancel') }}
		</v-btn>
	</v-container>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SyncCode from '../SyncCode.vue';
import SyncScanner from '../SyncScanner.vue';
import type { EntityBase } from '@/types';
import { SyncConnection, SYNC_SCHEMA } from '@/services/sync/SyncConnection';
import { syncMerger } from '@/services/sync/SyncMerger';
import { collectGarbage, pruneCompletions } from '@/utils';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';

type Step = 'idle' | 'show-offer' | 'scan-offer' | 'show-answer' | 'working' | 'done' | 'failed';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const settings = useSettingsStore();

const step = ref<Step>('idle');
const ourCode = ref('');
const failure = ref('');
const result = ref({ added: 0, updated: 0 });

let connection: SyncConnection | null = null;

function notify(message: string): void {
	emit('notify', message);
}

function reset(): void {
	connection?.close();
	connection = null;
	ourCode.value = '';
	failure.value = '';
	step.value = 'idle';
}

onBeforeUnmount(() => {
	connection?.close();
	connection = null;
});

function fail(error: unknown): void {
	failure.value = error instanceof Error ? error.message : String(error);
	step.value = 'failed';
}

async function startAsInitiator(): Promise<void> {
	try {
		connection = new SyncConnection();
		ourCode.value = await connection.createOffer();
		step.value = 'show-offer';
	} catch (error) {
		fail(error);
	}
}

function startAsResponder(): void {
	connection = new SyncConnection();
	step.value = 'scan-offer';
}

async function onOfferScanned(code: string): Promise<void> {
	try {
		if (!connection) return;
		ourCode.value = await connection.acceptOffer(code);
		step.value = 'show-answer';
		await runExchange();
	} catch (error) {
		fail(error);
	}
}

async function onAnswerScanned(code: string): Promise<void> {
	try {
		if (!connection) return;
		await connection.acceptAnswer(code);
		step.value = 'working';
		await runExchange();
	} catch (error) {
		fail(error);
	}
}

/** Both sides run this; each sends everything it has and merges what arrives. */
async function runExchange(): Promise<void> {
	if (!connection) {
		return;
	}

	try {
		const before = new Map(
			[...dreams.records, ...goals.records, ...tasks.records].map((record) => [
				record.id,
				record.updated,
			]),
		);

		const theirs = await connection.exchange({
			schema: SYNC_SCHEMA,
			kind: 'data',
			dreams: [...dreams.records],
			goals: [...goals.records],
			tasks: [...tasks.records],
		});

		if (theirs.kind !== 'data') {
			throw new Error('Expected data payload but received settings');
		}

		const now = new Date();
		const mergedDreams = sweep(syncMerger.merge([...dreams.records], theirs.dreams), now);
		const mergedGoals = sweep(syncMerger.merge([...goals.records], theirs.goals), now);
		const mergedTasks = sweep(syncMerger.mergeTasks([...tasks.records], theirs.tasks), now).map(
			(task) => pruneCompletions(task, settings.general.cleanupDays, now),
		);

		const merged = [...mergedDreams, ...mergedGoals, ...mergedTasks];

		result.value = {
			added: merged.filter((record) => !before.has(record.id)).length,
			updated: merged.filter((record) => {
				const was = before.get(record.id);
				return was !== undefined && was !== record.updated;
			}).length,
		};

		await dreams.replaceAll(mergedDreams);
		await goals.replaceAll(mergedGoals);
		await tasks.replaceAll(mergedTasks);

		step.value = 'done';
		connection.close();
		connection = null;
	} catch (error) {
		fail(error);
	}
}

/**
 * Collection runs on the merged result rather than after it is written: a
 * record the other device still holds past our window would otherwise land on
 * disk and be swept only on the next load, one write too late.
 */
function sweep<T extends EntityBase>(records: T[], now: Date): T[] {
	return collectGarbage(records, settings.general.cleanupDays, now).keep;
}
</script>
