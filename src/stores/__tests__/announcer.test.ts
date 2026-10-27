import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { useAnnouncerStore } from '../announcer';

describe('useAnnouncerStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	it('puts the text in place on the next tick, after clearing the region', async () => {
		const announcer = useAnnouncerStore();

		announcer.announce('Done: Buy milk');
		expect(announcer.message).toBe('');

		await nextTick();
		expect(announcer.message).toBe('Done: Buy milk');
	});

	it('clears the region between two identical messages, so the second is said too', async () => {
		const announcer = useAnnouncerStore();
		announcer.announce('Saved: Report');
		await nextTick();

		announcer.announce('Saved: Report');
		expect(announcer.message).toBe('');

		await nextTick();
		expect(announcer.message).toBe('Saved: Report');
	});
});
