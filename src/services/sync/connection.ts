import type { Todo } from '@/types/todo';
import { decodeSignal, encodeSignal } from './signal';

/** Data channel messages cap at 256 KB; stay well clear and fail loudly. */
const MAX_PAYLOAD_BYTES = 200_000;

const CHANNEL_LABEL = 'todo-sync';
const GATHER_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 30_000;

export class SyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SyncError';
	}
}

export interface SyncConnection {
	/** Initiator: build the code the other device scans. */
	createOffer(): Promise<string>;
	/** Responder: take their offer, return the code they scan back. */
	acceptOffer(code: string): Promise<string>;
	/** Initiator: take the answer and finish the handshake. */
	acceptAnswer(code: string): Promise<void>;
	/** Sends our records and resolves with theirs. */
	exchange(records: Todo[]): Promise<Todo[]>;
	close(): void;
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

export function createSyncConnection(): SyncConnection {
	// No STUN or TURN: sync is meant for two devices on the same network, and
	// an ICE server would be an internet dependency this app does not have.
	const peer = new RTCPeerConnection({ iceServers: [] });

	let channel: RTCDataChannel | null = null;
	const channelReady = new Promise<RTCDataChannel>((resolve, reject) => {
		const timer = setTimeout(
			() => reject(new SyncError('The other device did not connect in time')),
			CONNECT_TIMEOUT_MS,
		);

		const settle = (ready: RTCDataChannel): void => {
			clearTimeout(timer);
			resolve(ready);
		};

		peer.addEventListener('datachannel', (event) => {
			channel = event.channel;
			if (channel.readyState === 'open') settle(channel);
			else channel.addEventListener('open', () => settle(event.channel));
		});

		// The initiator's own channel resolves through this too.
		const watchLocal = (): void => {
			if (!channel) return;
			if (channel.readyState === 'open') settle(channel);
			else channel.addEventListener('open', () => settle(channel as RTCDataChannel));
		};

		queueMicrotask(watchLocal);
	});

	async function createOffer(): Promise<string> {
		channel = peer.createDataChannel(CHANNEL_LABEL);
		channel.addEventListener('open', () => {});

		await peer.setLocalDescription(await peer.createOffer());
		await waitForGathering(peer);

		return encodeSignal({ type: 'offer', sdp: peer.localDescription?.sdp ?? '' });
	}

	async function acceptOffer(code: string): Promise<string> {
		const signal = decodeSignal(code);
		if (signal.type !== 'offer') {
			throw new SyncError('That code is an answer, not an invitation');
		}

		await peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
		await peer.setLocalDescription(await peer.createAnswer());
		await waitForGathering(peer);

		return encodeSignal({ type: 'answer', sdp: peer.localDescription?.sdp ?? '' });
	}

	async function acceptAnswer(code: string): Promise<void> {
		const signal = decodeSignal(code);
		if (signal.type !== 'answer') {
			throw new SyncError('That code is an invitation, not an answer');
		}

		await peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
	}

	async function exchange(records: Todo[]): Promise<Todo[]> {
		const open = await channelReady;
		const payload = JSON.stringify({ records });

		if (payload.length > MAX_PAYLOAD_BYTES) {
			throw new SyncError('The list is too large to send in one go');
		}

		const incoming = new Promise<Todo[]>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new SyncError('The other device sent nothing')),
				CONNECT_TIMEOUT_MS,
			);

			open.addEventListener('message', (event: MessageEvent<string>) => {
				clearTimeout(timer);
				try {
					const parsed = JSON.parse(event.data) as { records?: unknown };
					if (!Array.isArray(parsed.records)) {
						reject(new SyncError('The other device sent something unexpected'));
						return;
					}

					resolve(parsed.records as Todo[]);
				} catch {
					reject(new SyncError('The other device sent something unexpected'));
				}
			});
		});

		open.send(payload);

		return incoming;
	}

	function close(): void {
		channel?.close();
		peer.close();
	}

	return { createOffer, acceptOffer, acceptAnswer, exchange, close };
}
