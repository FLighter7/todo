import { describe, expect, it } from 'vitest';
import { Status, type Item, type Task } from '@/types';
import { planServerMerge, sameRecords } from '../planServerMerge';
import { makeDream, makeTask, mark } from './fixtures';

const NOW = new Date('2026-11-07T12:00:00.000Z');
const EARLIER = '2026-11-05T10:00:00.000Z';
const LATER = '2026-11-06T10:00:00.000Z';
const FORTY_FIVE_DAYS_AGO = '2026-09-23T12:00:00.000Z';

function byId(items: Item[]): Record<string, Item> {
	return Object.fromEntries(items.map((item) => [item.id, item]));
}

describe('planServerMerge', () => {
	it('an empty server takes everything local', () => {
		const local = [makeTask(), makeDream()];

		const plan = planServerMerge([], local, 30, NOW);

		expect(plan.write).toBe(true);
		expect(sameRecords(plan.result, local)).toBe(true);
		expect(plan.localChanged).toBe(false);
	});

	it('a newer server record replaces the local one', () => {
		const server = [makeTask({ name: 'Buy oat milk', updated: LATER })];
		const local = [makeTask({ updated: EARLIER })];

		const plan = planServerMerge(server, local, 30, NOW);

		expect(plan.write).toBe(false);
		expect(plan.localChanged).toBe(true);
		expect(plan.result).toEqual(server);
	});

	it('a newer local record is written', () => {
		const server = [makeTask({ updated: EARLIER })];
		const local = [makeTask({ name: 'Buy oat milk', updated: LATER })];

		const plan = planServerMerge(server, local, 30, NOW);

		expect(plan.write).toBe(true);
		expect(plan.localChanged).toBe(false);
		expect(plan.result).toEqual(local);
	});

	it('a tie on updated keeps the server version', () => {
		const server = [makeTask({ name: 'From the server', updated: LATER })];
		const local = [makeTask({ name: 'From this device', updated: LATER })];

		const plan = planServerMerge(server, local, 30, NOW);

		expect((plan.result[0] as Task).name).toBe('From the server');
		expect(plan.write).toBe(false);
		expect(plan.localChanged).toBe(true);
	});

	it('a tie on a completion mark keeps the server version', () => {
		const at = '2026-11-07T09:30:00.000Z';
		const server = [makeTask({ completions: [mark('2026-11-07T09:00', at, true)] })];
		const local = [makeTask({ completions: [mark('2026-11-07T09:00', at, false)] })];

		const plan = planServerMerge(server, local, 30, NOW);

		expect((plan.result[0] as Task).completions).toEqual([mark('2026-11-07T09:00', at, true)]);
		expect(plan.write).toBe(false);
	});

	it('completions from both sides are kept', () => {
		const seventh = mark('2026-11-07T09:00', '2026-11-07T09:30:00.000Z');
		const fourteenth = mark('2026-11-14T09:00', '2026-11-07T10:30:00.000Z');
		const server = [makeTask({ completions: [seventh] })];
		const local = [makeTask({ completions: [fourteenth] })];

		const plan = planServerMerge(server, local, 30, NOW);

		expect((plan.result[0] as Task).completions).toEqual([seventh, fourteenth]);
		expect(plan.write).toBe(true);
		expect(plan.localChanged).toBe(true);
	});

	it('garbage collection alone never causes a write', () => {
		const closed = makeTask({
			id: 'closed',
			status: Status.Done,
			updated: FORTY_FIVE_DAYS_AGO,
		});
		const open = makeTask();
		const server = [closed, open];
		const local = [open];

		const plan = planServerMerge(server, local, 30, NOW);

		expect(plan.write).toBe(false);
		expect(plan.result.map((item) => item.id)).toEqual(['task-1']);
		expect(plan.localChanged).toBe(false);
	});

	it('the 30/90-day pair settles', () => {
		const closed = makeTask({ id: 'closed', status: Status.Done, updated: FORTY_FIVE_DAYS_AGO });
		const shared = makeDream();
		let server: Item[] = [shared, closed];
		// A has long since swept the closed task by its 30-day window; B keeps it for 90.
		let a: Item[] = [shared];
		let b: Item[] = [shared, closed];
		const writes: string[] = [];

		const sync = (name: string, local: Item[], days: number): Item[] => {
			const plan = planServerMerge(server, local, days, NOW);
			if (plan.write) {
				server = plan.result;
				writes.push(name);
			}
			return plan.result;
		};

		// A makes an unrelated edit and writes, sweeping the closed task by its window.
		a = [...a, makeTask({ id: 'new', updated: LATER })];
		a = sync('A', a, 30);
		expect(byId(server).closed).toBeUndefined();

		// B restores it once.
		b = sync('B', b, 90);
		expect(byId(server).closed).toBeDefined();
		expect(writes).toEqual(['A', 'B']);

		// From then on, neither writes.
		for (let round = 0; round < 3; round++) {
			a = sync('A', a, 30);
			b = sync('B', b, 90);
		}
		expect(writes).toEqual(['A', 'B']);
		expect(byId(a).closed).toBeUndefined();
		expect(byId(b).closed).toBeDefined();
		expect(byId(a).new).toBeDefined();
		expect(byId(b).new).toBeDefined();
	});
});

describe('sameRecords', () => {
	it('key order does not matter', () => {
		const task = makeTask({ note: 'semi-skimmed', completions: [mark('2026-11-07T09:00', LATER)] });
		const reordered = Object.fromEntries(Object.entries(task).reverse()) as unknown as Task;
		reordered.completions = [
			Object.fromEntries(Object.entries(task.completions![0]).reverse()) as never,
		];

		expect(sameRecords([task], [reordered])).toBe(true);
	});

	it('list order does not matter', () => {
		expect(sameRecords([makeTask(), makeDream()], [makeDream(), makeTask()])).toBe(true);
	});

	it('a different field or a different length differs', () => {
		expect(sameRecords([makeTask()], [makeTask({ name: 'Other' })])).toBe(false);
		expect(sameRecords([makeTask()], [makeTask(), makeDream()])).toBe(false);
	});
});
