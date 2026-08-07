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
import { SyncConnection } from '@/services/sync/SyncConnection';
import { syncMerger } from '@/services/sync/SyncMerger';
import { useTodosStore } from '@/stores/todos';

type Step = 'idle' | 'show-offer' | 'scan-offer' | 'show-answer' | 'working' | 'done' | 'failed';

const emit = defineEmits<{ notify: [message: string] }>();

const { t } = useI18n();
const store = useTodosStore();

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
		const before = new Map(store.records.map((todo) => [todo.id, todo.updated]));
		const theirs = await connection.exchange([...store.records]);
		const merged = syncMerger.merge([...store.records], theirs);

		result.value = {
			added: merged.filter((todo) => !before.has(todo.id)).length,
			updated: merged.filter((todo) => {
				const was = before.get(todo.id);
				return was !== undefined && was !== todo.updated;
			}).length,
		};

		await store.replaceAll(merged);
		step.value = 'done';
		connection.close();
		connection = null;
	} catch (error) {
		fail(error);
	}
}
</script>
