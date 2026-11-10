import { ItemType, Status, type Completion, type Dream, type Task } from '@/types';
import type { Pairing } from '@flighter7/workspace-client';

export function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		type: ItemType.Task,
		name: 'Buy milk',
		created: '2026-11-01T10:00:00.000Z',
		updated: '2026-11-01T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

export function makeDream(overrides: Partial<Dream> = {}): Dream {
	return {
		id: 'dream-1',
		type: ItemType.Dream,
		name: 'See the sea',
		created: '2026-11-01T10:00:00.000Z',
		updated: '2026-11-01T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

export function mark(occurrence: string, at: string, done = true): Completion {
	return { occurrence, done, at };
}

export function makePairing(overrides: Partial<Pairing> = {}): Pairing {
	return {
		serverId: 'S1',
		name: 'Desk',
		device: 'dev1',
		token: 'tok1',
		password: 'a'.repeat(24),
		fingerprint: 'AA:BB',
		port: 47800,
		hosts: ['a.local', '192.168.1.5'],
		lastEtag: null,
		lastSyncAt: null,
		...overrides,
	};
}
