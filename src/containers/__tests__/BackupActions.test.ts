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
	backupFile: { download: vi.fn(), readText: vi.fn(), canShare: vi.fn(), share: vi.fn() },
}));

const download = vi.mocked(backupFile.download);
const readText = vi.mocked(backupFile.readText);
const canShare = vi.mocked(backupFile.canShare);
const share = vi.mocked(backupFile.share);

/** Hands the component a chosen file; `readText` is mocked to return `text`. */
async function chooseFile(wrapper: ReturnType<typeof mount>, text: string): Promise<void> {
	readText.mockResolvedValue(text);
	const fileInput = wrapper.get('input[type="file"]');
	Object.defineProperty(fileInput.element, 'files', {
		value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
		configurable: true,
	});
	await fileInput.trigger('change');
	await flushPromises();
}

async function loadEmptyStores(): Promise<void> {
	await loadItems();
}

beforeEach(() => {
	setActivePinia(createPinia());
	download.mockReset();
	readText.mockReset();
	canShare.mockReset().mockReturnValue(false);
	share.mockReset();
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
		expect(wrapper.text()).toContain('Records on this device: 3');

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
				scheme: 'contrast',
				accent: '#D81B60',
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
		// Unlike a sync accept, a restore takes how the app looks along with the rest.
		expect(settings.general.fontScale).toBe(1.25);
		expect(settings.general.scheme).toBe('contrast');
		expect(settings.general.accent).toBe('#D81B60');
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

		const failure = new Error('quota exceeded');
		vi.spyOn(items, 'replaceAll').mockRejectedValue(failure);
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

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
			'Could not restore from the file: something unexpected went wrong',
		]);
		expect(logged).toHaveBeenCalledWith(failure);
		logged.mockRestore();
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
		expect(wrapper.emitted('notify')?.[0][0]).toBe('Could not read the file: it is not valid JSON');
	});
});

describe('BackupActions share', () => {
	it('offers sharing only where the browser can share a file', async () => {
		await loadEmptyStores();

		const without = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		expect(without.text()).not.toContain('Share a copy');

		canShare.mockReturnValue(true);
		const withShare = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		expect(withShare.text()).toContain('Share a copy');
	});

	it('shares a backup of every item, and says nothing when the sheet is closed', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.add(ItemType.Task, { name: 'Buy milk', important: false, urgent: false });
		canShare.mockReturnValue(true);
		share.mockRejectedValue(new DOMException('closed', 'AbortError'));

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		await clickButtonByText(wrapper, 'Share a copy');
		await flushPromises();

		expect(share).toHaveBeenCalledTimes(1);
		expect(share.mock.calls[0][0].items.map((item) => item.name)).toEqual(['Buy milk']);
		expect(wrapper.emitted('notify')).toBeUndefined();
	});

	it('says so when sharing fails for another reason', async () => {
		await loadEmptyStores();
		canShare.mockReturnValue(true);
		share.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		await clickButtonByText(wrapper, 'Share a copy');
		await flushPromises();

		expect(wrapper.emitted('notify')?.at(-1)).toEqual(['Could not share the file.']);
	});
});

describe('BackupActions merge', () => {
	const fileTask = {
		id: 'task-file',
		type: ItemType.Task,
		name: 'From the other phone',
		created: '2026-08-06T10:00:00.000Z',
		updated: '2026-08-06T10:00:00.000Z',
		status: Status.Opened,
		important: false,
		urgent: false,
	} as const;

	it("keeps the records here, adds the file's and leaves the settings alone", async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		const settings = useSettingsStore();
		settings.setTheme('dark');
		await items.add(ItemType.Task, { name: 'Here', important: false, urgent: false });

		const incoming = backupService.create([fileTask], {
			general: { ...settings.general, theme: 'light' },
			dreams: settings.dreams,
			goals: settings.goals,
			groups: settings.groups,
			tasks: settings.tasks,
		});

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		await chooseFile(wrapper, JSON.stringify(incoming));
		await clickButtonByText(wrapper, 'Merge');
		await flushPromises();

		expect(items.records.map((record) => record.name).sort()).toEqual([
			'From the other phone',
			'Here',
		]);
		expect(settings.general.theme).toBe('dark');
		expect(wrapper.emitted('notify')?.at(-1)).toEqual([
			'Merged with the file. New records: 1, updated: 0.',
		]);
	});

	it('says when the file brings nothing new', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		await items.replaceAll([fileTask]);

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		await chooseFile(wrapper, JSON.stringify(backupService.create([fileTask])));
		await clickButtonByText(wrapper, 'Merge');
		await flushPromises();

		expect(wrapper.emitted('notify')?.at(-1)).toEqual([
			'The file holds nothing this device does not have already.',
		]);
	});

	it('notifies mergeFailed when the merge throws', async () => {
		await loadEmptyStores();
		const items = useItemsStore();
		vi.spyOn(items, 'mergeIn').mockRejectedValue(new Error('boom'));
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		const wrapper = mount(BackupActions, { global: { plugins: [vuetify, i18n] } });
		await chooseFile(wrapper, JSON.stringify(backupService.create([fileTask])));
		await clickButtonByText(wrapper, 'Merge');
		await flushPromises();

		expect(wrapper.emitted('notify')?.at(-1)).toEqual([
			'Could not merge the file: something unexpected went wrong',
		]);
		logged.mockRestore();
	});
});
