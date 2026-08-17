import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, Status, type Dream, type Goal, type Task } from '@/types';
import {
	SYNC_SCHEMA,
	SyncConnection,
	SyncError,
	type SyncDataPayload,
	type SyncSettingsPayload,
} from './SyncConnection';

/**
 * Stand-ins for the WebRTC objects the vitest `node` environment does not
 * provide at all. They only implement what `SyncConnection` actually calls:
 * enough to drive a real `createOffer()` and land on an "open" channel
 * without waiting on any real network gathering.
 */
class FakeDataChannel extends EventTarget {
	readyState: RTCDataChannelState = 'open';
	readonly sent: string[] = [];

	send(data: string): void {
		this.sent.push(data);
	}

	close(): void {
		this.readyState = 'closed';
	}

	/** Test helper: simulate the other device's reply arriving. */
	receive(data: string): void {
		this.dispatchEvent(new FakeMessageEvent(data));
	}
}

class FakeMessageEvent extends Event {
	constructor(public readonly data: string) {
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

function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
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
		dreams: [makeDream()],
		goals: [makeGoal()],
		tasks: [makeTask()],
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
			dreams: [makeDream({ id: 'remote-dream' })],
			goals: [makeGoal({ id: 'remote-goal' })],
			tasks: [makeTask({ id: 'remote-task' })],
		});

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(incoming));

		await expect(exchangePromise).resolves.toEqual(incoming);
	});

	it('rejects the whole exchange when an incoming task has an invalid status', async () => {
		const { connection, channel } = await makeConnection();
		const malformed = {
			...makePayload(),
			tasks: [{ ...makeTask(), status: 'not-a-status' }],
		};

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(malformed));

		await expect(exchangePromise).rejects.toThrow(SyncError);
		await expect(exchangePromise).rejects.toThrow('The other device sent something unexpected');
	});

	it('rejects the whole exchange when an incoming dream is missing its id', async () => {
		const { connection, channel } = await makeConnection();
		const dreamWithoutId: Partial<Dream> = makeDream();
		delete dreamWithoutId.id;
		const malformed = { ...makePayload(), dreams: [dreamWithoutId] };

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(malformed));

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('still rejects on a schema mismatch, ahead of any record validation', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(makePayload({ schema: SYNC_SCHEMA + 1 })));

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
		channel.receive(JSON.stringify(incoming));

		await expect(exchangePromise).resolves.toEqual(incoming);
	});

	it('rejects when the incoming settings are invalid', async () => {
		const { connection, channel } = await makeConnection();
		const malformed = { ...makeSettingsPayload(), settings: { general: { theme: 'blue' } } };

		const exchangePromise = connection.exchange(makeSettingsPayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(malformed));

		await expect(exchangePromise).rejects.toThrow(SyncError);
	});

	it('rejects when the other device picked a different sync mode', async () => {
		const { connection, channel } = await makeConnection();

		const exchangePromise = connection.exchange(makePayload());
		await flushMicrotasks();
		channel.receive(JSON.stringify(makeSettingsPayload()));

		await expect(exchangePromise).rejects.toThrow(SyncError);
		await expect(exchangePromise).rejects.toThrow(/different/);
	});
});
