// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { i18n } from '@/i18n';
import { Status, type ItemBase } from '@/types';
import { useSettingsStore } from '@/stores/settings';
import { useToggleConfirm, type ToggleableStore } from '../useToggleConfirm';

function makeRecord(overrides: Partial<ItemBase> = {}): ItemBase {
	return {
		id: 'a',
		name: 'Visit Japan',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		...overrides,
	};
}

function makeStore(records: ItemBase[]): ToggleableStore<ItemBase> {
	return {
		records,
		async close(id, status) {
			const record = records.find((candidate) => candidate.id === id);
			if (record) {
				record.status = status;
			}
		},
		async reopen(id) {
			const record = records.find((candidate) => candidate.id === id);
			if (record) {
				record.status = Status.Opened;
			}
		},
	};
}

function useComposableInSetup<T>(setup: () => T): T {
	let result: T;
	const TestComponent = defineComponent({
		setup() {
			result = setup();
			return {};
		},
		template: '<div />',
	});

	mount(TestComponent, { global: { plugins: [i18n] } });
	return result!;
}

beforeEach(() => {
	window.localStorage.clear();
	setActivePinia(createPinia());
});

describe('useToggleConfirm immediate apply', () => {
	it('marks done immediately when confirmDone is off', () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: false });
		const { onToggle } = useComposableInSetup(() =>
			useToggleConfirm(store, 'tasks', ref('active')),
		);

		onToggle('a');

		expect(records[0].status).toBe(Status.Done);
	});

	it('reopens immediately when confirmReopen is off, from the History tab', () => {
		const records = [makeRecord({ status: Status.Done })];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmReopen: false });
		const { onToggle } = useComposableInSetup(() =>
			useToggleConfirm(store, 'tasks', ref('history')),
		);

		onToggle('a');

		expect(records[0].status).toBe(Status.Opened);
	});
});

describe('useToggleConfirm confirmation gate', () => {
	it('opens the confirm dialog instead of applying when confirmDone is on', () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });
		const { onToggle, toggleConfirmOpen, toggleConfirmTitle, toggleConfirmBody } =
			useComposableInSetup(() => useToggleConfirm(store, 'tasks', ref('active')));

		onToggle('a');

		expect(records[0].status).toBe(Status.Opened);
		expect(toggleConfirmOpen.value).toBe(true);
		expect(toggleConfirmTitle.value).toBe('Mark as done?');
		expect(toggleConfirmBody.value).toBe('Mark "Visit Japan" as done?');
	});

	it('applies the pending toggle when the confirm choice is "yes"', async () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });
		const { onToggle, onToggleChoice } = useComposableInSetup(() =>
			useToggleConfirm(store, 'tasks', ref('active')),
		);

		onToggle('a');
		await onToggleChoice('yes');

		expect(records[0].status).toBe(Status.Done);
	});

	it('leaves the record untouched when the confirm choice is "no"', async () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: true });
		const { onToggle, onToggleChoice } = useComposableInSetup(() =>
			useToggleConfirm(store, 'tasks', ref('active')),
		);

		onToggle('a');
		await onToggleChoice('no');

		expect(records[0].status).toBe(Status.Opened);
	});
});

describe('useToggleConfirm History-tab derivation', () => {
	it('reopens a cancelled record checked in the History tab, not marks it done', () => {
		const records = [makeRecord({ status: Status.Cancelled })];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmReopen: false });
		const { onToggle } = useComposableInSetup(() =>
			useToggleConfirm(store, 'tasks', ref('history')),
		);

		onToggle('a');

		expect(records[0].status).toBe(Status.Opened);
	});
});

describe('useToggleConfirm unknown id', () => {
	it('does nothing when the id is not found', () => {
		const records = [makeRecord()];
		const store = makeStore(records);
		useSettingsStore().updatePageSettings('tasks', { confirmDone: false });
		const { onToggle, toggleConfirmOpen } = useComposableInSetup(() =>
			useToggleConfirm(store, 'tasks', ref('active')),
		);

		onToggle('missing');

		expect(records[0].status).toBe(Status.Opened);
		expect(toggleConfirmOpen.value).toBe(false);
	});
});
