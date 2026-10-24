import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ItemType, DEFAULT_SETTINGS, Status, type Dream, type Goal, type Task } from '@/types';
import {
	MAX_MESSAGE_BYTES,
	SYNC_SCHEMA,
	SyncConnection,
	SyncError,
	type SyncDataPayload,
	type SyncSettingsPayload,
} from '../SyncConnection';

/**
 * Stand-ins for the WebRTC objects the vitest `node` environment does not
 * provide at all. They only implement what `SyncConnection` actually calls:
 * enough to drive a real `createOffer()` and land on an "open" channel
 * without waiting on any real network gathering.
 */
class FakeDataChannel extends EventTarget {
	readyState: RTCDataChannelState = 'open';
	binaryType: BinaryType = 'blob';
	bufferedAmount = 0;
	bufferedAmountLowThreshold = 0;
	readonly sent: Array<string | ArrayBuffer> = [];
	/** Set by `link`: the other device's channel, which receives what this one sends. */
	peer: FakeDataChannel | null = null;

	send(data: string | ArrayBufferView): void {
		if (this.readyState !== 'open') {
			throw new DOMException('The channel is not open', 'InvalidStateError');
		}

		const message =
			typeof data === 'string'
				? data
				: new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice().buffer;
		this.sent.push(message);

		const peer = this.peer;
		if (peer) queueMicrotask(() => peer.receive(message));
	}

	close(): void {
		if (this.readyState === 'closed') return;
		this.readyState = 'closed';
		this.dispatchEvent(new Event('close'));
		this.peer?.close();
	}

	/** Test helper: simulate a message from the other device arriving. */
	receive(data: string | ArrayBuffer): void {
		if (this.readyState === 'open') this.dispatchEvent(new FakeMessageEvent(data));
	}
}

class FakeMessageEvent extends Event {
	constructor(public readonly data: string | ArrayBuffer) {
		super('message');
	}
}

const createdPeers: FakePeerConnection[] = [];

class FakePeerConnection extends EventTarget {
	iceGatheringState: RTCIceGatheringState = 'complete';
	dataChannel: FakeDataChannel | null = null;

	constructor() {
		super();
		createdPeers.push(this);
	}

	createDataChannel(): FakeDataChannel {
		this.dataChannel = new FakeDataChannel();
		return this.dataChannel;
	}

	async createOffer(): Promise<RTCSessionDescriptionInit> {
		return { type: 'offer', sdp: 'fake-sdp' };
	}

	async setLocalDescription(): Promise<void> {}

	close(): void {}
}

function flushMicrotasks(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Drives a real `createOffer()` so `exchange()` finds an open channel. */
async function makeConnection(): Promise<{ connection: SyncConnection; channel: FakeDataChannel }> {
	createdPeers.length = 0;
	const connection = new SyncConnection();
	await connection.createOffer();

	const channel = createdPeers[0]?.dataChannel;
	if (!channel) {
		throw new Error('test setup: FakePeerConnection did not receive a createDataChannel call');
	}

	return { connection, channel };
}

/** Wires two fake channels together, so two real connections talk to each other. */
function link(a: FakeDataChannel, b: FakeDataChannel): void {
	a.peer = b;
	b.peer = a;
}

const encoder = new TextEncoder();

function bytesOf(message: string | ArrayBuffer): number {
	return typeof message === 'string' ? encoder.encode(message).byteLength : message.byteLength;
}

/**
 * Puts a payload on the wire the way the other device does: a header, the
 * payload's UTF-8 bytes in pieces, and the ack for ours.
 */
function receivePayload(
	channel: FakeDataChannel,
	payload: { schema?: unknown; kind?: unknown },
	{ ack = true, bytes }: { ack?: boolean; bytes?: number } = {},
): void {
	const body = encoder.encode(JSON.stringify(payload));
	const header = { schema: payload.schema, frame: 'header', kind: payload.kind };
	channel.receive(JSON.stringify({ ...header, bytes: bytes ?? body.byteLength }));
	for (let offset = 0; offset < body.byteLength; offset += MAX_MESSAGE_BYTES) {
		channel.receive(body.slice(offset, offset + MAX_MESSAGE_BYTES).buffer);
	}

	if (ack) channel.receive(JSON.stringify({ schema: SYNC_SCHEMA, frame: 'ack' }));
}

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		type: ItemType.Dream,
		id: 'dream-1',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeGoal(overrides: Partial<Goal> = {}): Goal {
	return {
		type: ItemType.Goal,
		id: 'goal-1',
		name: 'Save for the trip',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		type: ItemType.Task,
		id: 'task-1',
		name: 'Book flights',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

function makePayload(overrides: Partial<SyncDataPayload> = {}): SyncDataPayload {
	return {
		schema: SYNC_SCHEMA,
		kind: 'data',
		items: [makeDream(), makeGoal(), makeTask()],
		...overrides,
	};
}

function makeSettingsPayload(overrides: Partial<SyncSettingsPayload> = {}): SyncSettingsPayload {
	return {
		schema: SYNC_SCHEMA,
		kind: 'settings',
		settings: DEFAULT_SETTINGS,
		...overrides,
	};
}

describe('SyncConnection.exchange', () => {
	beforeEach(() => {
		vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves with a fully-formed incoming payload', async () => {
		const { connection, channel } = await makeConnection();
		const incoming = makePayload({
			items: [
				makeDream({ id: 'remote-dream' }),
				makeGoal({ id: 'remote-goal' }),
				makeTask({ id: 'remote-task' }),
			],
		});

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, incoming);

		await expect(exchangePromise).resolves.toEqual(incoming);
	});

	it('rejects the whole exchange when an incoming task has an invalid status', async () => {
		const { connection, channel } = await makeConnection();
		const malformed = {
			...makePayload(),
			items: [{ ...makeTask(), status: 'not-a-status' }],
		};

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, malformed);

		await expect(exchangePromise).rejects.toThrow(SyncError);
		await expect(exchangePromise).rejects.toThrow('The other device sent something unexpected');
	});

	it('rejects the whole exchange when an incoming dream is missing its id', async () => {
		const { connection, channel } = await makeConnection();
		const dreamWithoutId: Partial<Dream> = makeDream();
		delete dreamWithoutId.id;
		const malformed = { ...makePayload(), items: [dreamWithoutId] };

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, malformed);

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('rejects the whole exchange when an incoming item has an unknown type', async () => {
		const { connection, channel } = await makeConnection();
		const malformed = { ...makePayload(), items: [{ ...makeDream(), type: 9 }] };

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, malformed);

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('rejects a payload without an items list', async () => {
		const { connection, channel } = await makeConnection();
		const versionThreeShape = {
			schema: SYNC_SCHEMA,
			kind: 'data',
			dreams: [],
			goals: [],
			tasks: [],
		};

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, versionThreeShape);

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('hands back the parsed records, without fields the parsers do not know', async () => {
		const { connection, channel } = await makeConnection();
		const incoming = { ...makePayload(), items: [{ ...makeDream(), smuggled: 'value' }] };

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, incoming);

		const received = await exchangePromise;
		expect(received.kind === 'data' && received.items[0]).not.toHaveProperty('smuggled');
	});

	it('still rejects on a schema mismatch, ahead of any record validation', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makePayload({ schema: SYNC_SCHEMA + 1 }));

		await expect(exchangePromise).rejects.toThrow(/different version/);
	});
});

describe('SyncConnection.exchange settings payloads', () => {
	beforeEach(() => {
		vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('resolves with a fully-formed incoming settings payload', async () => {
		const { connection, channel } = await makeConnection();
		const incoming = makeSettingsPayload({
			settings: { ...DEFAULT_SETTINGS, general: { ...DEFAULT_SETTINGS.general, theme: 'dark' } },
		});

		const exchangePromise = connection.exchange(makeSettingsPayload());
		await flushMicrotasks();
		receivePayload(channel, incoming);

		await expect(exchangePromise).resolves.toEqual(incoming);
	});

	it('rejects when the incoming settings are invalid', async () => {
		const { connection, channel } = await makeConnection();
		const malformed = { ...makeSettingsPayload(), settings: { general: { theme: 'blue' } } };

		const exchangePromise = connection.exchange(makeSettingsPayload());
		await flushMicrotasks();
		receivePayload(channel, malformed);

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('rejects when the other device picked a different sync mode', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makeSettingsPayload());

		await expect(exchangePromise).rejects.toThrow(SyncError);
		await expect(exchangePromise).rejects.toThrow(/different/);
	});
});

describe('SyncConnection.exchange on the wire', () => {
	beforeEach(() => {
		vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	/** Well past the old one-message cap of 200 000, and multi-byte throughout. */
	function makeLargeList(prefix: string): Task[] {
		return Array.from({ length: 2000 }, (_, index) =>
			makeTask({
				id: `${prefix}-${index}`,
				name: `Купить продукты на неделю и не забыть хлеб — ${index}`,
				note: 'Заметка на кириллице, чтобы каждый символ занимал два байта',
			}),
		);
	}

	function isSettled(promise: Promise<unknown>): Promise<boolean> {
		let settled = false;
		promise.then(
			() => (settled = true),
			() => (settled = true),
		);
		return flushMicrotasks().then(() => settled);
	}

	it('carries a large list both ways, in messages no larger than MAX_MESSAGE_BYTES', async () => {
		const a = await makeConnection();
		const b = await makeConnection();
		link(a.channel, b.channel);
		const ours = makePayload({ items: makeLargeList('a') });
		const theirs = makePayload({ items: makeLargeList('b') });
		expect(encoder.encode(JSON.stringify(ours)).byteLength).toBeGreaterThan(200_000);

		const [atA, atB] = await Promise.all([
			a.connection.exchange(ours),
			b.connection.exchange(theirs),
		]);

		expect(atA).toEqual(theirs);
		expect(atB).toEqual(ours);
		for (const message of [...a.channel.sent, ...b.channel.sent]) {
			expect(bytesOf(message)).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
		}

		// A piece that starts with a UTF-8 continuation byte split a character
		// in two, so the list above did come back from mid-character cuts.
		const pieces = a.channel.sent.filter((message) => typeof message !== 'string');
		expect(pieces.some((piece) => (new Uint8Array(piece)[0] & 0xc0) === 0x80)).toBe(true);
	});

	it('acks the other side once their whole payload has arrived', async () => {
		const { connection, channel } = await makeConnection();

		void connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makePayload(), { ack: false });

		expect(JSON.parse(channel.sent.at(-1) as string)).toEqual({
			schema: SYNC_SCHEMA,
			frame: 'ack',
		});
	});

	it('does not resolve until the other side acks ours', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makePayload(), { ack: false });

		expect(await isSettled(exchangePromise)).toBe(false);

		channel.receive(JSON.stringify({ schema: SYNC_SCHEMA, frame: 'ack' }));
		await expect(exchangePromise).resolves.toEqual(makePayload());
	});

	it('resolves when the channel closes after their payload arrived whole', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makePayload(), { ack: false });
		channel.close();

		await expect(exchangePromise).resolves.toEqual(makePayload());
	});

	it('rejects when the channel closes before their payload arrived whole', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makePayload(), { ack: false, bytes: 1_000_000 });
		channel.close();

		await expect(exchangePromise).rejects.toThrow(/closed before/);
	});

	it('rejects more bytes than the header announced', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		receivePayload(channel, makePayload(), { bytes: 10 });

		await expect(exchangePromise).rejects.toThrow('The other device sent something unexpected');
	});

	it('rejects payload bytes that arrive before any header', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(encoder.encode(JSON.stringify(makePayload())).buffer);

		await expect(exchangePromise).rejects.toThrow('The other device sent something unexpected');
	});

	it('refuses the one-message format of an older build as a different version', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify({ schema: 3, kind: 'data', dreams: [], goals: [], tasks: [] }));

		await expect(exchangePromise).rejects.toThrow(/different version/);
	});

	it('holds further pieces while the send buffer is full', async () => {
		const { connection, channel } = await makeConnection();
		channel.bufferedAmount = 2 * 1024 * 1024;
		const ours = makePayload({ items: makeLargeList('a') });
		const pieces = Math.ceil(encoder.encode(JSON.stringify(ours)).byteLength / MAX_MESSAGE_BYTES);

		void connection.exchange(ours);
		await flushMicrotasks();
		expect(channel.sent).toHaveLength(1);

		channel.bufferedAmount = 0;
		channel.dispatchEvent(new Event('bufferedamountlow'));
		await flushMicrotasks();
		expect(channel.sent).toHaveLength(1 + pieces);
	});
});
