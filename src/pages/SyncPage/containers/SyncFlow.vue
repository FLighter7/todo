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
	<VContainer :class="$style.page">
		<p class="text-medium-emphasis mb-4">{{ t('sync.intro') }}</p>

		<div v-if="step === 'idle'" :class="$style.choices">
			<VBtnToggle v-model="mode" mandatory color="primary" class="mb-2">
				<VBtn value="data">{{ t('sync.modeData') }}</VBtn>
				<VBtn value="settings">{{ t('sync.modeSettings') }}</VBtn>
			</VBtnToggle>
			<VBtn color="primary" size="large" @click="startAsInitiator">
				{{ t('sync.startHere') }}
			</VBtn>
			<VBtn variant="tonal" size="large" @click="startAsResponder">
				{{ t('sync.joinHere') }}
			</VBtn>
		</div>

		<template v-else-if="step === 'show-offer'">
			<p class="mb-3">{{ t('sync.showingCode') }}</p>
			<SyncCode :code="ourCode" @copied="notify(t('sync.copied'))" />
			<VDivider class="my-5" />
			<p class="mb-3">{{ t('sync.scanTheirCode') }}</p>
			<SyncScanner @code="onAnswerScanned" />
		</template>

		<template v-else-if="step === 'scan-offer'">
			<p class="mb-3">{{ t('sync.scanInvite') }}</p>
			<SyncScanner @code="onOfferScanned" />
		</template>

		<template v-else-if="step === 'show-answer'">
			<p class="mb-3">{{ t('sync.showAnswer') }}</p>
			<SyncCode :code="ourCode" @copied="notify(t('sync.copied'))" />
			<p class="mt-4 text-center text-medium-emphasis">{{ t('sync.waiting') }}</p>
			<VProgressLinear indeterminate class="mt-2" />
		</template>

		<template v-else-if="step === 'working'">
			<p class="text-center">{{ t('sync.connecting') }}</p>
			<VProgressLinear indeterminate class="mt-2" />
		</template>

		<template v-else-if="step === 'confirm-settings'">
			<p class="mb-3">{{ t('sync.confirmSettingsBody') }}</p>
			<div :class="$style.choices">
				<VBtn color="primary" size="large" @click="acceptSettings">
					{{ t('sync.confirmSettingsAccept') }}
				</VBtn>
				<VBtn variant="tonal" size="large" @click="declineSettings">
					{{ t('sync.confirmSettingsDecline') }}
				</VBtn>
			</div>
		</template>

		<VAlert v-else-if="step === 'done'" type="success" variant="tonal" class="mb-4">
			{{
				mode === 'settings'
					? t('sync.settingsDone')
					: t('sync.done', { added: result.added, updated: result.updated })
			}}
		</VAlert>

		<VAlert v-else-if="step === 'failed'" type="error" variant="tonal" class="mb-4">
			{{ t('sync.failed', { reason: failure }) }}
		</VAlert>

		<VBtn v-if="step !== 'idle'" variant="text" class="mt-4" block @click="reset">
			{{ step === 'done' || step === 'failed' ? t('sync.restart') : t('sync.cancel') }}
		</VBtn>
	</VContainer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import SyncCode from '../SyncCode.vue';
import SyncScanner from '../SyncScanner.vue';
import type { AppSettings, ItemBase } from '@/types';
import {
	SyncConnection,
	SYNC_SCHEMA,
	type SyncDataPayload,
	type SyncSettingsPayload,
} from '@/services/sync/SyncConnection';
import { syncMerger } from '@/services/sync/SyncMerger';
import { collectGarbage, pruneTask } from '@/utils';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';

type Step =
	| 'idle'
	| 'show-offer'
	| 'scan-offer'
	| 'show-answer'
	| 'working'
	| 'confirm-settings'
	| 'done'
	| 'failed';
type Mode = 'data' | 'settings';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const dreams = useDreamsStore();
const goals = useGoalsStore();
const tasks = useTasksStore();
const settings = useSettingsStore();

const step = ref<Step>('idle');
const mode = ref<Mode>('data');
const ourCode = ref('');
const failure = ref('');
const result = ref({ added: 0, updated: 0 });
const incomingSettings = ref<AppSettings | null>(null);

/** Whether unmounting right now would silently abort an in-progress pairing. */
const busy = computed(() => !['idle', 'done', 'failed'].includes(step.value));

defineExpose({ busy });

let connection: SyncConnection | null = null;

function notify(message: string): void {
	emit('notify', message);
}

function reset(): void {
	connection?.close();
	connection = null;
	ourCode.value = '';
	failure.value = '';
	incomingSettings.value = null;
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

/** Both sides run this; what they send and how they handle the reply depends on `mode`. */
async function runExchange(): Promise<void> {
	if (!connection) {
		return;
	}

	try {
		if (mode.value === 'settings') {
			const theirs = (await connection.exchange({
				schema: SYNC_SCHEMA,
				kind: 'settings',
				settings: {
					general: settings.general,
					dreams: settings.dreams,
					goals: settings.goals,
					tasks: settings.tasks,
				},
			})) as SyncSettingsPayload;

			incomingSettings.value = theirs.settings;
			step.value = 'confirm-settings';
			connection.close();
			connection = null;
			return;
		}

		const before = new Map(
			[...dreams.records, ...goals.records, ...tasks.records].map((record) => [
				record.id,
				record.updated,
			]),
		);

		const theirs = (await connection.exchange({
			schema: SYNC_SCHEMA,
			kind: 'data',
			dreams: [...dreams.records],
			goals: [...goals.records],
			tasks: [...tasks.records],
		})) as SyncDataPayload;

		const now = new Date();
		const mergedDreams = sweep(syncMerger.merge([...dreams.records], theirs.dreams), now);
		const mergedGoals = sweep(syncMerger.merge([...goals.records], theirs.goals), now);
		const mergedTasks = sweep(syncMerger.mergeTasks([...tasks.records], theirs.tasks), now).map(
			(task) => pruneTask(task, settings.general.cleanupDays, now),
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
 * Settings sync is not a merge: both sides sent their whole document, and
 * each independently decides whether to keep it or take the other side's.
 * The one exception is the text size, which stays this device's own even on
 * accept: what reads well depends on the screen, so a phone taking a
 * desktop's settings should not take its text size too.
 */
function acceptSettings(): void {
	if (incomingSettings.value) {
		const incoming = incomingSettings.value;
		settings.replaceAll({
			...incoming,
			general: { ...incoming.general, fontScale: settings.general.fontScale },
		});
	}
	incomingSettings.value = null;
	step.value = 'done';
}

function declineSettings(): void {
	incomingSettings.value = null;
	step.value = 'done';
}

/**
 * Collection runs on the merged result rather than after it is written: a
 * record the other device still holds past our window would otherwise land on
 * disk and be swept only on the next load, one write too late.
 */
function sweep<T extends ItemBase>(records: T[], now: Date): T[] {
	return collectGarbage(records, settings.general.cleanupDays, now).keep;
}
</script>
