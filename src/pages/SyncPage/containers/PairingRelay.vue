<style lang="scss" module>
// The title keeps the card title's look; it is a heading so that the dialog has
// a name and a screen reader a place to start.
.heading {
	font: inherit;
	margin: 0;
	white-space: normal;
}

.view {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	outline: none;

	// The gaps space the lines; a paragraph's own margins would double them.
	p {
		margin: 0;
	}
}

// As large as the dialog allows: the other device's camera reads it from a
// distance, and a phone's screen is small enough already.
.qr {
	align-self: center;
	max-width: 24rem;
}

.actions {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;

	// A label wraps instead of running out of its button on a phone at a large
	// text size.
	:global(.v-btn) {
		height: auto;
		min-height: var(--v-btn-height);
		padding-block: 0.5rem;
	}

	:global(.v-btn__content) {
		white-space: normal;
	}
}
</style>

<template>
	<VDialog v-model="open" max-width="480" scrollable :aria-labelledby="titleId">
		<VCard variant="elevated">
			<VCardTitle class="d-flex align-center">
				<h2 :id="titleId" :class="$style.heading">{{ t('sync.server.relay.title') }}</h2>
				<VSpacer />
				<!-- Escape, the scrim and Back close it too, but a touch screen reader user
				needs something to find. -->
				<VBtn :icon="mdiClose" variant="text" :aria-label="t('form.close')" @click="open = false" />
			</VCardTitle>

			<VCardText>
				<div v-if="code" ref="codeView" :class="$style.view" tabindex="-1">
					<VAlert v-if="foreign" type="info" variant="tonal">
						{{ t('sync.server.relay.foreign', { name: code.name }) }}
					</VAlert>

					<QrCode
						:class="$style.qr"
						:value="code.text"
						:label="t('sync.server.relay.qrLabel', { name: code.name })"
					/>
					<p>{{ t('sync.server.relay.show') }}</p>
					<p class="text-medium-emphasis">{{ t('sync.server.relay.expiry') }}</p>

					<div :class="$style.actions">
						<VBtn
							v-if="canShare"
							color="primary"
							size="large"
							:prepend-icon="mdiShareVariantOutline"
							@click="share"
						>
							{{ t('sync.server.relay.share') }}
						</VBtn>
						<VBtn
							:color="canShare ? undefined : 'primary'"
							:variant="canShare ? 'tonal' : 'elevated'"
							size="large"
							:prepend-icon="mdiContentCopy"
							@click="copy"
						>
							{{ t('sync.server.relay.copy') }}
						</VBtn>
						<VBtn variant="text" size="large" @click="scanAnother">
							{{ t('sync.server.relay.scanAnother') }}
						</VBtn>
					</div>
					<p v-if="notice" class="text-medium-emphasis">{{ notice }}</p>
				</div>

				<div v-else ref="scanView" :class="$style.view" tabindex="-1">
					<p>{{ t('sync.server.relay.intro') }}</p>
					<VAlert v-if="refused" type="error" variant="tonal">{{ refused }}</VAlert>
					<SyncScanner @code="onCode" />
				</div>
			</VCardText>
		</VCard>
	</VDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { mdiClose, mdiContentCopy, mdiShareVariantOutline } from '@mdi/js';
import { parsePairingCode } from '@flighter7/workspace-client';
import QrCode from '../QrCode.vue';
import SyncScanner from '../SyncScanner.vue';
import { useServerSyncStore } from '@/stores/serverSync';
import { useAnnouncerStore } from '@/stores/announcer';
import { useErrorReason } from '@/composables/useErrorReason';
import { useReturnFocus } from '@/composables/useKeepFocus';

/** A code read here to be passed on, never to pair with. */
interface RelayedCode {
	text: string;
	serverId: string;
	name: string;
}

const open = defineModel<boolean>({ required: true });

const { t } = useI18n();
const errorReason = useErrorReason();
const store = useServerSyncStore();
const announcer = useAnnouncerStore();
const titleId = useId();
const codeView = useTemplateRef<HTMLElement>('codeView');
const scanView = useTemplateRef<HTMLElement>('scanView');

/**
 * The code being passed on. It lives in this dialog only: it is never stored,
 * and closing the dialog forgets it. It still carries a valid one-time secret
 * for its 10 minutes, and this device has no use for it.
 */
const code = shallowRef<RelayedCode | null>(null);
/** Why the last code read could not be passed on. */
const refused = ref('');
/** What Copy or Share last did, for the eye; the announcer says it too. */
const notice = ref('');
/** The text the camera last read and could not use: it sees it again on every frame. */
let lastRefused = '';

useReturnFocus(open);

watch(open, (isOpen) => {
	if (isOpen) return;
	code.value = null;
	refused.value = '';
	notice.value = '';
	lastRefused = '';
});

/** A code for some other server is passed on all the same, with a word about it. */
const foreign = computed(
	() => code.value !== null && store.serverId !== null && code.value.serverId !== store.serverId,
);

/** Share is offered only where the browser has it for text: AirDrop, Quick Share and the like. */
const canShare = computed(
	() =>
		code.value !== null &&
		typeof navigator.share === 'function' &&
		(typeof navigator.canShare !== 'function' || navigator.canShare({ text: code.value.text })),
);

/** The view swaps under the focused control; the focus goes to the top of the new one. */
async function focusView(view: Readonly<typeof codeView>): Promise<void> {
	await nextTick();
	view.value?.focus();
}

function say(text: string): void {
	notice.value = text;
	announcer.announce(text);
}

function onCode(text: string, source: 'camera' | 'paste'): void {
	if (source === 'camera' && text === lastRefused) return;

	try {
		const parsed = parsePairingCode(text);
		code.value = { text: text.trim(), serverId: parsed.serverId, name: parsed.name };
		refused.value = '';
		notice.value = '';
		lastRefused = '';
		announcer.announce(t('sync.server.relay.ready', { name: parsed.name }));
		void focusView(codeView);
	} catch (error) {
		lastRefused = text;
		refused.value = t('sync.server.relay.refused', { reason: errorReason(error) });
		announcer.announce(refused.value);
	}
}

async function share(): Promise<void> {
	if (!code.value) return;

	try {
		await navigator.share({ text: code.value.text });
	} catch (error) {
		// Closing the share sheet without picking anyone is not a failure.
		if (error instanceof DOMException && error.name === 'AbortError') return;
		say(t('sync.server.relay.shareFailed'));
	}
}

async function copy(): Promise<void> {
	if (!code.value) return;

	try {
		await navigator.clipboard.writeText(code.value.text);
		say(t('sync.server.relay.copied'));
	} catch {
		say(t('sync.server.relay.copyFailed'));
	}
}

function scanAnother(): void {
	code.value = null;
	notice.value = '';
	void focusView(scanView);
}
</script>
