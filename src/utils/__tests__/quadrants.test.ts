import { describe, expect, it } from 'vitest';
import { ItemType, Status, type Task } from '@/types';
import { QUADRANT_KEYS, quadrantFlags, quadrantOf } from '../quadrants';

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		type: ItemType.Task,
		id: 'task-1',
		name: 'File the report',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
		...overrides,
	};
}

describe('quadrantOf', () => {
	it('maps important and urgent to do', () => {
		expect(quadrantOf(makeTask({ important: true, urgent: true }))).toBe('do');
	});

	it('maps important and not urgent to schedule', () => {
		expect(quadrantOf(makeTask({ important: true, urgent: false }))).toBe('schedule');
	});

	it('maps not important and urgent to delegate', () => {
		expect(quadrantOf(makeTask({ important: false, urgent: true }))).toBe('delegate');
	});

	it('maps not important and not urgent to eliminate', () => {
		expect(quadrantOf(makeTask({ important: false, urgent: false }))).toBe('eliminate');
	});
});

describe('quadrantFlags', () => {
	it('is the inverse of quadrantOf for every quadrant', () => {
		for (const key of QUADRANT_KEYS) {
			expect(quadrantOf(makeTask(quadrantFlags(key)))).toBe(key);
		}
	});
});
