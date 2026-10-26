// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText, loadItems } from '@/vitestHelpers';
import { ItemType, Status } from '@/types';
import { backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useItemsStore } from '@/stores/items';
import { useSettingsStore } from '@/stores/settings';
import BackupActions from '../BackupActions.vue';

vi.mock('@/services/backup/BackupFile', () => ({
	backupFile: { download: vi.fn(), readText: vi.fn() },
}));

const download = vi.mocked(backupFile.download);
const readText = vi.mocked(backupFile.readText);

async function loadEmptyStores(): Promise<void> {
	await loadItems();
}

beforeEach(() => {
	setActivePinia(createPinia());
	download.mockReset();
	readText.mockReset();
});

describe('BackupActions export', () => {
	it('downloads a backup built from every item and notifies', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.add(ItemType.Dream, { name: 'Visit Japan' });
		await items.add(ItemType.Goal, { name: 'Save for the trip' });
		await items.add(ItemType.Task, { name: 'Buy milk', important: false, urgent: false });

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, 'Export to a file');

		expect(download).toHaveBeenCalledTimes(1);
		const backup = download.mock.calls[0][0];
		expect(backup.version).toBe(4);
		expect(backup.items.map((item) => item.type).sort()).toEqual([
			ItemType.Task,
			ItemType.Goal,
			ItemType.Dream,
		]);
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
	it('shows a confirmation with counts and replaces every item on confirm', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.add(ItemType.Dream, { name: 'Old dream' });
		await items.add(ItemType.Goal, { name: 'Old goal' });
		await items.add(ItemType.Task, { name: 'Old task', important: false, urgent: false });

		const incoming = backupService.create([
			{
				id: 'dream-1',
				type: ItemType.Dream,
				name: 'Imported dream',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				status: Status.Opened,
			},
			{
				id: 'goal-1',
				type: ItemType.Goal,
				name: 'Imported goal',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				status: Status.Opened,
			},
			{
				id: 'task-1',
				type: ItemType.Task,
				name: 'Imported task',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				status: Status.Opened,
				important: false,
				urgent: false,
			},
		]);
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

		expect(items.records.map((r) => r.id)).toEqual(['dream-1', 'goal-1', 'task-1']);
		expect(wrapper.emitted('notify')?.at(-1)).toEqual(['Restored from the file. Records: 3.']);
	});

	it('replaces local settings when the backup includes them', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const incoming = backupService.create([], {
			general: {
				theme: 'light',
				locale: 'ru',
				startPage: 'matrix',
				cleanupDays: 90,
				fontScale: 1.25,
				pages: { tasks: true, matrix: false, dreams: false, goals: true, groups: false },
			},
			dreams: { rows: 2, confirmDone: true, confirmReopen: true, sortOrder: 'az' },
			goals: { rows: 2, confirmDone: true, confirmReopen: true, sortOrder: 'az' },
			groups: { rows: 1, confirmDone: true, confirmReopen: true, sortOrder: 'za' },
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
		expect(settings.general.fontScale).toBe(1.25);
		expect(settings.general.pages).toEqual({
			tasks: true,
			matrix: false,
			dreams: false,
			goals: true,
			groups: false,
		});
		expect(settings.dreams.rows).toBe(2);
	});

	it('leaves local settings untouched when the backup has none', async () => {
		await loadEmptyStores();
		const settings = useSettingsStore();
		settings.setTheme('dark');

		const incoming = backupService.create([]);
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

	it('notifies restoreFailed and keeps the old list when replaceAll rejects', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.add(ItemType.Task, { name: 'Old task', important: false, urgent: false });

		const incoming = backupService.create([
			{
				id: 'dream-1',
				type: ItemType.Dream,
				name: 'Imported dream',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				status: Status.Opened,
			},
		]);
		readText.mockResolvedValue(JSON.stringify(incoming));

		vi.spyOn(items, 'replaceAll').mockRejectedValue(new Error('quota exceeded'));

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

		expect(items.records.map((t) => t.name)).toEqual(['Old task']);
		expect(wrapper.emitted('notify')?.at(-1)).toEqual([
			'Could not restore from the file: quota exceeded',
		]);
	});

	it('notifies with the reason and does not touch the stores when the file is invalid', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.add(ItemType.Task, { name: 'Untouched', important: false, urgent: false });

		readText.mockResolvedValue('not json at all');

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['nope'], 'bad.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(items.records.map((t) => t.name)).toEqual(['Untouched']);
		expect(wrapper.emitted('notify')?.[0][0]).toContain('Could not read the file');
	});
});
