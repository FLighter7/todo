import { parseItem, parseSettings, type AppSettings, type Item } from '@/types';
import { syncSignal } from './SyncSignal';

/**
 * The largest single data channel message this sends. A payload goes out as
 * UTF-8 bytes in pieces of this size, so the list has no size cap of its own.
 * 16 KiB is the size every browser pair has carried reliably; larger messages
 * are where implementations have disagreed.
 */
export const MAX_MESSAGE_BYTES = 16 * 1024;

/** Stop queueing pieces once this much waits to go out, resume at the low mark. */
const BUFFER_HIGH_BYTES = 1024 * 1024;
const BUFFER_LOW_BYTES = 256 * 1024;

const CHANNEL_LABEL = 'todo-sync';
const GATHER_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 30_000;

/**
 * Raised with every field a record gains, since an older device would drop the
 * field and its next edit would win the merge without it. 5: a dream's, goal's
 * or group's section colour.
 */
export const SYNC_SCHEMA = 5;

export interface SyncDataPayload {
	schema: number;
	kind: 'data';
	items: Item[];
}

export interface SyncSettingsPayload {
	schema: number;
	kind: 'settings';
	settings: AppSettings;
}

export type SyncPayload = SyncDataPayload | SyncSettingsPayload;

/**
 * The text messages around a payload. A header announces how many bytes of
 * payload follow as binary messages; an ack says the other side's payload
 * arrived whole. Both carry the schema, so a device on another version
 * refuses the very first message it reads.
 */
interface HeaderFrame {
	schema: number;
	frame: 'header';
	kind: SyncPayload['kind'];
	bytes: number;
}

interface AckFrame {
	schema: number;
	frame: 'ack';
}

/** A text message as read off the wire, before any of it is trusted. */
type IncomingFrame = Partial<Record<keyof HeaderFrame, unknown>>;

/** What went wrong in a sync, for the interface to say in the user's language. */
export type SyncErrorCode =
	| 'unexpected'
	| 'connectTimeout'
	| 'notAnInvite'
	| 'notAnAnswer'
	| 'sentNothing'
	| 'stoppedSending'
	| 'versionMismatch'
	| 'modeMismatch'
	| 'closedEarly'
	| 'closedWhileSending';

/** The message is English, for a developer; `code` is what the interface translates. */
export class SyncError extends Error {
	constructor(
		message: string,
		readonly code: SyncErrorCode,
	) {
		super(message);
		this.name = 'SyncError';
	}
}

function unexpected(): SyncError {
	return new SyncError('The other device sent something unexpected', 'unexpected');
}

function joinChunks(chunks: Uint8Array[], length: number): Uint8Array {
	const joined = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		joined.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return joined;
}

/** Validates the reassembled payload; throws on anything malformed. */
function readPayload(body: Uint8Array, kind: SyncPayload['kind']): SyncPayload {
	const parsed = JSON.parse(
		new TextDecoder('utf-8', { fatal: true }).decode(body),
	) as Partial<SyncDataPayload> & Partial<SyncSettingsPayload>;

	if (parsed.schema !== SYNC_SCHEMA || parsed.kind !== kind) {
		throw unexpected();
	}

	if (parsed.kind === 'data') {
		if (!Array.isArray(parsed.items)) {
			throw unexpected();
		}

		// Shape-checking the array is not enough: each element still has to be
		// a valid record. This is data from another device, not the user's own
		// file, so a bad record must not reach the merge and garbage-collection
		// steps — parseItem throws on the first invalid one, and the caller
		// turns that into the same full-reject as every other malformed-payload
		// case. What comes back is the parsed copy, not the raw JSON, so fields
		// the parsers do not know never reach storage.
		return { schema: parsed.schema, kind: 'data', items: parsed.items.map(parseItem) };
	}

	return { schema: parsed.schema, kind: 'settings', settings: parseSettings(parsed.settings) };
}

/** Resolves once the channel's send buffer drains to its low mark, or the channel closes. */
function drained(channel: RTCDataChannel): Promise<void> {
	return new Promise((resolve) => {
		const done = (): void => {
			channel.removeEventListener('bufferedamountlow', done);
			channel.removeEventListener('close', done);
			resolve();
		};

		channel.addEventListener('bufferedamountlow', done);
		channel.addEventListener('close', done);
	});
}

function waitForGathering(peer: RTCPeerConnection): Promise<void> {
	if (peer.iceGatheringState === 'complete') {
		return Promise.resolve();
	}

	return new Promise((resolve) => {
		const done = (): void => {
			if (peer.iceGatheringState === 'complete') {
				peer.removeEventListener('icegatheringstatechange', done);
				resolve();
			}
		};

		peer.addEventListener('icegatheringstatechange', done);
		// No trickle ICE here: the whole description has to fit in one code, so
		// gathering must finish before it is shown. Give up rather than hang.
		setTimeout(resolve, GATHER_TIMEOUT_MS);
	});
}

/**
 * Wraps one WebRTC pairing session. Not a singleton: a fresh instance is
 * created for every sync attempt, since each one owns its own peer
 * connection and data channel.
 */
export class SyncConnection {
	private readonly peer: RTCPeerConnection;
	private channel: RTCDataChannel | null = null;
	private readonly channelReady: Promise<RTCDataChannel>;

	constructor() {
		// No STUN or TURN: sync is meant for two devices on the same network, and
		// an ICE server would be an internet dependency this app does not have.
		this.peer = new RTCPeerConnection({ iceServers: [] });

		this.channelReady = new Promise<RTCDataChannel>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new SyncError('The other device did not connect in time', 'connectTimeout')),
				CONNECT_TIMEOUT_MS,
			);

			const settle = (ready: RTCDataChannel): void => {
				clearTimeout(timer);
				resolve(ready);
			};

			this.peer.addEventListener('datachannel', (event) => {
				this.channel = event.channel;
				if (this.channel.readyState === 'open') settle(this.channel);
				else this.channel.addEventListener('open', () => settle(event.channel));
			});

			// The initiator's own channel resolves through this too.
			const watchLocal = (): void => {
				if (!this.channel) return;
				if (this.channel.readyState === 'open') settle(this.channel);
				else this.channel.addEventListener('open', () => settle(this.channel as RTCDataChannel));
			};

			queueMicrotask(watchLocal);
		});
	}

	/** Initiator: build the code the other device scans. */
	async createOffer(): Promise<string> {
		this.channel = this.peer.createDataChannel(CHANNEL_LABEL);
		this.channel.addEventListener('open', () => {});

		await this.peer.setLocalDescription(await this.peer.createOffer());
		await waitForGathering(this.peer);

		return syncSignal.encode({ type: 'offer', sdp: this.peer.localDescription?.sdp ?? '' });
	}

	/** Responder: take their offer, return the code they scan back. */
	async acceptOffer(code: string): Promise<string> {
		const signal = syncSignal.decode(code);
		if (signal.type !== 'offer') {
			throw new SyncError('That code is an answer, not an invitation', 'notAnInvite');
		}

		await this.peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
		await this.peer.setLocalDescription(await this.peer.createAnswer());
		await waitForGathering(this.peer);

		return syncSignal.encode({ type: 'answer', sdp: this.peer.localDescription?.sdp ?? '' });
	}

	/** Initiator: take the answer and finish the handshake. */
	async acceptAnswer(code: string): Promise<void> {
		const signal = syncSignal.decode(code);
		if (signal.type !== 'answer') {
			throw new SyncError('That code is an invitation, not an answer', 'notAnAnswer');
		}

		await this.peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
	}

	/**
	 * Sends our payload and resolves with theirs.
	 *
	 * Each side sends a header, then its payload as UTF-8 bytes in binary
	 * messages of at most `MAX_MESSAGE_BYTES`, and acks the other side's
	 * payload once all of it has arrived and parsed. The exchange resolves
	 * only when theirs is complete and ours is acked: the caller closes the
	 * connection right after, and closing while our own pieces are still in
	 * flight would cut the other side off mid-list. If the channel closes or
	 * goes quiet after theirs is complete, it resolves anyway — what we
	 * merge depends only on what we received.
	 */
	async exchange(payload: SyncPayload): Promise<SyncPayload> {
		const open = await this.channelReady;
		open.binaryType = 'arraybuffer';
		const body = new TextEncoder().encode(JSON.stringify(payload));

		return new Promise<SyncPayload>((resolve, reject) => {
			let expected: number | null = null;
			const chunks: Uint8Array[] = [];
			let received = 0;
			let theirs: SyncPayload | null = null;
			let acked = false;
			let settled = false;
			let timer: ReturnType<typeof setTimeout> | undefined;

			const finish = (error?: SyncError): void => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				open.removeEventListener('message', onMessage);
				open.removeEventListener('close', onClose);
				if (error) reject(error);
				else resolve(theirs as SyncPayload);
			};

			// Reset by every message either way: while our pieces drain, the other
			// side is busy receiving them and has nothing to send back.
			const armTimer = (): void => {
				clearTimeout(timer);
				timer = setTimeout(() => {
					if (theirs) finish();
					else if (expected === null)
						finish(new SyncError('The other device sent nothing', 'sentNothing'));
					else finish(new SyncError('The other device stopped sending', 'stoppedSending'));
				}, CONNECT_TIMEOUT_MS);
			};

			const onFrame = (frame: IncomingFrame): void => {
				// The schema check comes before anything is read. Without it a
				// device on an older build would merge a shape it does not
				// understand and destroy data on both sides.
				if (frame.schema !== SYNC_SCHEMA) {
					throw new SyncError(
						'The other device runs a different version. Update it and retry.',
						'versionMismatch',
					);
				}

				if (frame.frame === 'ack') {
					acked = true;
					if (theirs) finish();
					return;
				}

				if (frame.frame !== 'header' || expected !== null) {
					throw unexpected();
				}

				// Both sides pick a mode (Data or Settings) before pairing; a
				// mismatch means the two devices are trying to exchange different
				// things over the same connection.
				if (frame.kind !== payload.kind) {
					throw new SyncError(
						'The other device is set to sync something different. Pick the same mode on both sides and retry.',
						'modeMismatch',
					);
				}

				if (!Number.isSafeInteger(frame.bytes) || (frame.bytes as number) <= 0) {
					throw unexpected();
				}

				expected = frame.bytes as number;
			};

			const onChunk = (chunk: Uint8Array): void => {
				if (expected === null || received + chunk.byteLength > expected) {
					throw unexpected();
				}

				chunks.push(chunk);
				received += chunk.byteLength;
				if (received < expected) return;

				theirs = readPayload(joinChunks(chunks, received), payload.kind);
				try {
					open.send(JSON.stringify({ schema: SYNC_SCHEMA, frame: 'ack' } satisfies AckFrame));
				} catch {
					// The channel is already closing; its close event settles this,
					// and theirs is complete, so that settles it successfully.
				}
				if (acked) finish();
			};

			const onMessage = (event: MessageEvent<string | ArrayBuffer>): void => {
				armTimer();
				try {
					if (typeof event.data === 'string') onFrame(JSON.parse(event.data));
					else onChunk(new Uint8Array(event.data));
				} catch (error) {
					finish(error instanceof SyncError ? error : unexpected());
				}
			};

			const onClose = (): void => {
				if (theirs) finish();
				else
					finish(
						new SyncError('The connection closed before the other device finished', 'closedEarly'),
					);
			};

			const send = async (): Promise<void> => {
				const header: HeaderFrame = {
					schema: SYNC_SCHEMA,
					frame: 'header',
					kind: payload.kind,
					bytes: body.byteLength,
				};
				open.send(JSON.stringify(header));

				open.bufferedAmountLowThreshold = BUFFER_LOW_BYTES;
				for (let offset = 0; offset < body.byteLength; offset += MAX_MESSAGE_BYTES) {
					if (open.bufferedAmount > BUFFER_HIGH_BYTES) await drained(open);
					if (settled) return;
					open.send(body.subarray(offset, offset + MAX_MESSAGE_BYTES));
					armTimer();
				}
			};

			open.addEventListener('message', onMessage);
			open.addEventListener('close', onClose);
			armTimer();
			send().catch(() =>
				finish(new SyncError('The connection closed while sending', 'closedWhileSending')),
			);
		});
	}

	close(): void {
		this.channel?.close();
		this.peer.close();
	}
}
