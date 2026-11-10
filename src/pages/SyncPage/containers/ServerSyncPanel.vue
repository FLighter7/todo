<style lang="scss" module>
.panel {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	outline: none;

	// The gaps space the lines; a paragraph's own margins would double them.
	p {
		margin: 0;
	}
}

.actions {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.lines {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	overflow-wrap: anywhere;
}
</style>

<template>
	<div ref="panel" :class="$style.panel" tabindex="-1">
		<template v-if="store.status === 'unpaired'">
			<p>{{ t('sync.server.intro') }}</p>
			<p class="text-medium-emphasis">{{ t('sync.server.pairHint') }}</p>

			<div v-if="pairing">
				<p class="text-center">{{ t('sync.server.pairing') }}</p>
				<VProgressLinear indeterminate class="mt-2" />
			</div>

			<VAlert v-if="pairError" type="error" variant="tonal">
				{{ t('sync.server.pairFailed', { reason: pairError }) }}
			</VAlert>

			<SyncScanner v-show="!pairing" @code="onCode" />
		</template>

		<template v-else>
			<div :class="$style.lines">
				<p class="text-title-medium">{{ t('sync.server.serverName', { name: serverName }) }}</p>
				<p>{{ stateLine }}</p>
				<p v-if="store.status === 'unreachable'" class="text-medium-emphasis">
					{{ t('sync.server.unreachableHint') }}
				</p>
				<p class="text-medium-emphasis">{{ lastSyncLine }}</p>
			</div>

			<div :class="$style.actions">
				<VBtn v-if="canPairAgain" color="primary" size="large" @click="pairAgain">
					{{ t('sync.server.pairAgain') }}
				</VBtn>
				<VBtn
					v-else
					color="primary"
					size="large"
					:disabled="store.status === 'syncing' || store.status === 'connecting'"
					@click="syncNow"
				>
					{{ t('sync.server.syncNow') }}
				</VBtn>
				<VBtn variant="tonal" size="large" @click="disconnect">
					{{ t('sync.server.disconnect') }}
				</VBtn>
			</div>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import SyncScanner from '../SyncScanner.vue';
import { BLOCKED_RETRY_MS, WorkspaceError } from '@flighter7/workspace-client';
import { useServerSyncStore, type ServerSyncError } from '@/stores/serverSync';
import { useAnnouncerStore } from '@/stores/announcer';
import { useErrorReason } from '@/composables/useErrorReason';
import { dateTimeFormat } from '@/utils/intl';

/** Errors only a new pairing cures. */
const PAIR_AGAIN: ReadonlySet<ServerSyncError['code']> = new Set<ServerSyncError['code']>([
	'serverChanged',
	'badToken',
	'unknownApp',
]);

const { t, locale } = useI18n();
const errorReason = useErrorReason();
const store = useServerSyncStore();
const announcer = useAnnouncerStore();
const panel = useTemplateRef<HTMLElement>('panel');

const pairing = ref(false);
const pairError = ref('');
/**
 * The code the last failed pairing used, and when the camera may try it
 * again. The camera sees the same code on every frame, so it would retry a
 * refused one forever; a pasted code is the user asking again, and always
 * goes through. A code refused as `blocked` is still good — the server
 * consumed nothing — so the camera tries it again once a minute, as sync
 * does; any other refusal is final for that code.
 */
let failed: { code: string; retryAt: number | null } | null = null;

function cameraMayTry(text: string): boolean {
	if (!failed || failed.code !== text) return true;

	return failed.retryAt !== null && Date.now() >= failed.retryAt;
}

const serverName = computed(() => store.serverName ?? '');

const canPairAgain = computed(
	() => store.status === 'error' && store.error !== null && PAIR_AGAIN.has(store.error.code),
);

const stateLine = computed(() => {
	switch (store.status) {
		case 'error':
			return t('sync.server.state.error', { reason: errorReason(store.error) });
		case 'paused':
			return store.error?.code === 'blocked'
				? t('sync.server.state.blocked')
				: t('sync.server.state.paused', { reason: errorReason(store.error) });
		case 'connecting':
		case 'syncing':
		case 'connected':
		case 'unreachable':
			return t(`sync.server.state.${store.status}`);
		default:
			return '';
	}
});

const lastSyncLine = computed(() => {
	if (!store.lastSyncAt) return t('sync.server.neverSynced');
	const time = dateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(
		new Date(store.lastSyncAt),
	);

	return t('sync.server.lastSync', { time });
});

/**
 * A sync that stops or pauses on its own moves no focus, so it is said — once:
 * a paused sync passes through Connecting on every retry, and saying the same
 * line each time would only repeat it.
 */
let announced = '';
watch(
	() => store.status,
	(status) => {
		if (status === 'syncing' || status === 'connected' || status === 'unpaired') announced = '';
		if (status !== 'error' && status !== 'paused') return;
		if (stateLine.value === announced) return;
		announced = stateLine.value;
		announcer.announce(announced);
	},
);

/** The view swaps under the focused button; the focus goes to the top of the new one. */
async function focusPanel(): Promise<void> {
	await nextTick();
	panel.value?.focus();
}

async function onCode(text: string, source: 'camera' | 'paste'): Promise<void> {
	if (pairing.value) return;
	if (source === 'camera' && !cameraMayTry(text)) return;

	pairing.value = true;
	pairError.value = '';
	announcer.announce(t('sync.server.pairing'));
	try {
		await store.pair(text);
		failed = null;
		announcer.announce(t('sync.server.paired', { name: serverName.value }));
		await focusPanel();
	} catch (error) {
		const blocked = error instanceof WorkspaceError && error.code === 'blocked';
		failed = { code: text, retryAt: blocked ? Date.now() + BLOCKED_RETRY_MS : null };
		pairError.value = errorReason(error);
		announcer.announce(t('sync.server.pairFailed', { reason: pairError.value }));
	} finally {
		pairing.value = false;
	}
}

function syncNow(): void {
	// Asked for, so a failure is said again even when it is the same one.
	announced = '';
	void store.syncNow();
}

async function disconnect(): Promise<void> {
	await store.disconnect();
	announcer.announce(t('sync.server.disconnected'));
	await focusPanel();
}

/** Forgets the pairing this device can no longer use and shows the scanner. */
async function pairAgain(): Promise<void> {
	await store.disconnect();
	await focusPanel();
}
</script>
