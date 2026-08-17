import {
	parseDream,
	parseGoal,
	parseSettings,
	parseTask,
	type AppSettings,
	type Dream,
	type Goal,
	type Task,
} from '@/types';
import { syncSignal } from './SyncSignal';

/** Data channel messages cap at 256 KB; stay well clear and fail loudly. */
const MAX_PAYLOAD_BYTES = 200_000;

const CHANNEL_LABEL = 'todo-sync';
const GATHER_TIMEOUT_MS = 5000;
const CONNECT_TIMEOUT_MS = 30_000;

export const SYNC_SCHEMA = 3;

export interface SyncDataPayload {
	schema: number;
	kind: 'data';
	dreams: Dream[];
	goals: Goal[];
	tasks: Task[];
}

export interface SyncSettingsPayload {
	schema: number;
	kind: 'settings';
	settings: AppSettings;
}

export type SyncPayload = SyncDataPayload | SyncSettingsPayload;

export class SyncError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SyncError';
	}
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
				() => reject(new SyncError('The other device did not connect in time')),
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
			throw new SyncError('That code is an answer, not an invitation');
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
			throw new SyncError('That code is an invitation, not an answer');
		}

		await this.peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
	}

	/** Sends our payload and resolves with theirs. */
	async exchange(payload: SyncPayload): Promise<SyncPayload> {
		const open = await this.channelReady;
		const body = JSON.stringify(payload);

		if (body.length > MAX_PAYLOAD_BYTES) {
			throw new SyncError('The list is too large to send in one go');
		}

		const incoming = new Promise<SyncPayload>((resolve, reject) => {
			const timer = setTimeout(
				() => reject(new SyncError('The other device sent nothing')),
				CONNECT_TIMEOUT_MS,
			);

			open.addEventListener('message', (event: MessageEvent<string>) => {
				clearTimeout(timer);
				try {
					const parsed = JSON.parse(event.data) as Partial<SyncDataPayload> &
						Partial<SyncSettingsPayload>;

					// The schema check comes before anything is read. Without it a
					// device on an older build would merge a shape it does not
					// understand and destroy data on both sides.
					if (parsed.schema !== SYNC_SCHEMA) {
						reject(
							new SyncError('The other device runs a different version. Update it and retry.'),
						);
						return;
					}

					// Both sides pick a mode (Data or Settings) before pairing; a
					// mismatch means the two devices are trying to exchange different
					// things over the same connection.
					if (parsed.kind !== payload.kind) {
						reject(
							new SyncError(
								'The other device is set to sync something different. Pick the same mode on both sides and retry.',
							),
						);
						return;
					}

					if (parsed.kind === 'data') {
						if (
							!Array.isArray(parsed.dreams) ||
							!Array.isArray(parsed.goals) ||
							!Array.isArray(parsed.tasks)
						) {
							reject(new SyncError('The other device sent something unexpected'));
							return;
						}

						// Shape-checking the arrays is not enough: each element still has
						// to be a valid record. This is data from another device, not the
						// user's own file, so a bad record must not reach the merge and
						// garbage-collection steps — parseDream/parseGoal/parseTask throw
						// on the first invalid one, and the catch below turns that into
						// the same full-reject as every other malformed-payload case here.
						parsed.dreams.forEach(parseDream);
						parsed.goals.forEach(parseGoal);
						parsed.tasks.forEach(parseTask);

						resolve(parsed as SyncDataPayload);
						return;
					}

					resolve({
						schema: parsed.schema,
						kind: 'settings',
						settings: parseSettings(parsed.settings),
					});
				} catch {
					reject(new SyncError('The other device sent something unexpected'));
				}
			});
		});

		open.send(body);

		return incoming;
	}

	close(): void {
		this.channel?.close();
		this.peer.close();
	}
}
