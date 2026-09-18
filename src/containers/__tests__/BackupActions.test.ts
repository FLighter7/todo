// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { Status } from '@/types';
import { backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useDreamsStore } from '@/stores/dreams';
import { useGoalsStore } from '@/stores/goals';
import { useTasksStore } from '@/stores/tasks';
import { useSettingsStore } from '@/stores/settings';
import { EntityMemoryRepository } from '@/repositories/EntityMemoryRepository';
import BackupActions from '../BackupActions.vue';

vi.mock('@/services/backup/BackupFile', () => ({
	backupFile: { download: vi.fn(), readText: vi.fn() },
}));

const download = vi.mocked(backupFile.download);
const readText = vi.mocked(backupFile.readText);

async function loadEmptyStores(): Promise<void> {
	await useDreamsStore().load(async () => new EntityMemoryRepository([]));
	await useGoalsStore().load(async () => new EntityMemoryRepository([]));
	await useTasksStore().load(async () => new EntityMemoryRepository([]));
}

beforeEach(() => {
	setActivePinia(createPinia());
	download.mockReset();
	readText.mockReset();
});

describe('BackupActions export', () => {
	it('downloads a backup built from all three collections and notifies', async () => {
		await loadEmptyStores();
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await dreams.add({ name: 'Visit Japan' });
		await goals.add({ name: 'Save for the trip' });
		await tasks.add({ name: 'Buy milk', important: false, urgent: false });

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Export to a file');

		expect(download).toHaveBeenCalledTimes(1);
		const backup = download.mock.calls[0][0];
		expect(backup.version).toBe(3);
		expect(backup.dreams).toHaveLength(1);
		expect(backup.goals).toHaveLength(1);
		expect(backup.tasks).toHaveLength(1);
		expect(wrapper.emitted('notify')).toEqual([['Backup saved.']]);
	});

	it('includes the current settings in the export', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Export to a file');

		const backup = download.mock.calls[0][0];
		expect(backup.settings!.general.theme).toBe('dark');
	});
});

describe('BackupActions import', () => {
	it('shows a confirmation with counts and replaces all three collections on confirm', async () => {
		await loadEmptyStores();
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await dreams.add({ name: 'Old dream' });
		await goals.add({ name: 'Old goal' });
		await tasks.add({ name: 'Old task', important: false, urgent: false });

		const incoming = backupService.create(
			[
				{
					id: 'dream-1',
					name: 'Imported dream',
					created: '2026-08-06T10:00:00.000Z',
					updated: '2026-08-06T10:00:00.000Z',
					status: Status.Opened,
				},
			],
			[
				{
					id: 'goal-1',
					name: 'Imported goal',
					created: '2026-08-06T10:00:00.000Z',
					updated: '2026-08-06T10:00:00.000Z',
					status: Status.Opened,
				},
			],
			[
				{
					id: 'task-1',
					name: 'Imported task',
					created: '2026-08-06T10:00:00.000Z',
					updated: '2026-08-06T10:00:00.000Z',
					status: Status.Opened,
					important: false,
					urgent: false,
				},
			],
		);
		readText.mockResolvedValue(JSON.stringify(incoming));

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('Records in the file: 3');
		expect(wrapper.text()).toContain('Records to be deleted: 3');

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(dreams.records.map((r) => r.id)).toEqual(['dream-1']);
		expect(goals.records.map((r) => r.id)).toEqual(['goal-1']);
		expect(tasks.records.map((r) => r.id)).toEqual(['task-1']);
		expect(wrapper.emitted('notify')?.at(-1)).toEqual(['Restored from the file. Records: 3.']);
	});

	it('replaces local settings when the backup includes them', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const incoming = backupService.create([], [], [], {
			general: { theme: 'light', locale: 'ru', startPage: 'matrix', cleanupDays: 90 },
			dreams: { rows: 2, confirmDone: true, confirmReopen: true, sortOrder: 'az' },
			goals: { rows: 2, confirmDone: true, confirmReopen: true, sortOrder: 'az' },
			tasks: { rows: 2, confirmDone: true, confirmReopen: true, sortOrder: 'az' },
		});
		readText.mockResolvedValue(JSON.stringify(incoming));

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(settings.general.theme).toBe('light');
		expect(settings.general.locale).toBe('ru');
		expect(settings.dreams.rows).toBe(2);
	});

	it('leaves local settings untouched when the backup has none', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const incoming = backupService.create([], [], []);
		readText.mockResolvedValue(JSON.stringify(incoming));

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(settings.general.theme).toBe('dark');
	});

	it('notifies restoreFailed and stops instead of continuing when a replaceAll call rejects', async () => {
		await loadEmptyStores();
		const dreams = useDreamsStore();
		const goals = useGoalsStore();
		const tasks = useTasksStore();
		await tasks.add({ name: 'Old task', important: false, urgent: false });

		const incoming = backupService.create(
			[
				{
					id: 'dream-1',
					name: 'Imported dream',
					created: '2026-08-06T10:00:00.000Z',
					updated: '2026-08-06T10:00:00.000Z',
					status: Status.Opened,
				},
			],
			[],
			[],
		);
		readText.mockResolvedValue(JSON.stringify(incoming));

		// dreams.replaceAll runs first and is left to succeed for real; goals is
		// the second of the three calls, and rejecting it is what proves the
		// third (tasks) never runs and the user hears about the failure.
		vi.spyOn(goals, 'replaceAll').mockRejectedValue(new Error('quota exceeded'));
		const tasksReplaceAll = vi.spyOn(tasks, 'replaceAll');

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(dreams.records.map((r) => r.id)).toEqual(['dream-1']);
		expect(tasksReplaceAll).not.toHaveBeenCalled();
		expect(tasks.records.map((t) => t.name)).toEqual(['Old task']);
		expect(wrapper.emitted('notify')?.at(-1)).toEqual([
			'Could not restore from the file: quota exceeded',
		]);
	});

	it('notifies with the reason and does not touch the stores when the file is invalid', async () => {
		await loadEmptyStores();
		const tasks = useTasksStore();
		await tasks.add({ name: 'Untouched', important: false, urgent: false });

		readText.mockResolvedValue('not json at all');

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['nope'], 'bad.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(tasks.records.map((t) => t.name)).toEqual(['Untouched']);
		expect(wrapper.emitted('notify')?.[0][0]).toContain('Could not read the file');
	});
});
