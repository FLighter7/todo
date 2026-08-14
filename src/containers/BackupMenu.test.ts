// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import vuetify from '@/plugins/vuetify';
import { i18n } from '@/i18n';
import { clickButtonByText } from '@/vitestHelpers';
import { backupService } from '@/services/backup/BackupService';
import { backupFile } from '@/services/backup/BackupFile';
import { useTodosStore } from '@/stores/todos';
import { InMemoryRepository } from '@/repositories/InMemoryRepository';
import BackupMenu from './BackupMenu.vue';

vi.mock('@/services/backup/BackupFile', () => ({
	backupFile: { download: vi.fn(), readText: vi.fn() },
}));

const download = vi.mocked(backupFile.download);
const readText = vi.mocked(backupFile.readText);

beforeEach(() => {
	setActivePinia(createPinia());
	download.mockReset();
	readText.mockReset();
});

describe('BackupMenu export', () => {
	it('downloads a backup built from the current items and notifies', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([]));
		await store.add({ title: 'Buy milk', period: 'one-time', important: false, urgent: false });

		const wrapper = mount(BackupMenu, { global: { plugins: [vuetify, i18n] } });

		await clickButtonByText(wrapper, ''); // opens the v-menu (icon-only activator button)
		await clickButtonByText(wrapper, 'Export to a file');

		expect(download).toHaveBeenCalledTimes(1);
		expect(download.mock.calls[0][0].todos).toHaveLength(1);
		expect(wrapper.emitted('notify')).toEqual([['Backup saved.']]);
	});
});

describe('BackupMenu import', () => {
	it('shows a confirmation with counts and replaces the list on confirm', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([]));
		await store.add({ title: 'Old task', period: 'one-time', important: false, urgent: false });

		const incoming = backupService.create([
			{
				id: 'new-1',
				title: 'Imported task',
				created: '2026-08-06T10:00:00.000Z',
				updated: '2026-08-06T10:00:00.000Z',
				period: 'one-time',
				important: false,
				urgent: false,
				done: false,
				deleted: false,
			},
		]);
		readText.mockResolvedValue(JSON.stringify(incoming));

		const wrapper = mount(BackupMenu, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['irrelevant, readText is mocked'], 'backup.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(wrapper.text()).toContain('Tasks in the file: 1');
		expect(wrapper.text()).toContain('Tasks to be deleted: 1');

		await clickButtonByText(wrapper, 'Replace');
		await flushPromises();

		expect(store.items.map((t) => t.id)).toEqual(['new-1']);
		expect(wrapper.emitted('notify')?.at(-1)).toEqual(['Restored from the file. Tasks: 1.']);
	});

	it('notifies with the reason and does not touch the store when the file is invalid', async () => {
		const store = useTodosStore();
		await store.load(async () => new InMemoryRepository([]));
		await store.add({ title: 'Untouched', period: 'one-time', important: false, urgent: false });

		readText.mockResolvedValue('not json at all');

		const wrapper = mount(BackupMenu, { global: { plugins: [vuetify, i18n] } });

		const fileInput = wrapper.get('input[type="file"]');
		Object.defineProperty(fileInput.element, 'files', {
			value: [new File(['nope'], 'bad.json')],
			configurable: true,
		});
		await fileInput.trigger('change');
		await wrapper.vm.$nextTick();

		expect(store.items.map((t) => t.title)).toEqual(['Untouched']);
		expect(wrapper.emitted('notify')?.[0][0]).toContain('Could not read the file');
	});
});
